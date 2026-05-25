import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { capturePayPalOrder } from "@/lib/paypal";
import { applyPurchasedPlan, getPaymentPlan } from "@/lib/paymentPlans";

function getCaptureId(captureData) {
  return captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const paypalOrderId = String(body.paypalOrderId || body.orderId || "");

    if (!paypalOrderId) {
      return Response.json(
        { error: "Pedido do PayPal nao informado." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const payments = db.collection("payments");
    const payment = await payments.findOne({
      paypalOrderId,
      userId: session.user.userId,
    });

    if (!payment) {
      return Response.json(
        { error: "Pagamento nao encontrado." },
        { status: 404 }
      );
    }

    if (payment.status === "paid") {
      return Response.json({ success: true, status: "paid" });
    }

    const plan = getPaymentPlan(payment.plan);

    if (!plan) {
      return Response.json(
        { error: "Plano do pagamento nao encontrado." },
        { status: 400 }
      );
    }

    const captureData = await capturePayPalOrder(paypalOrderId);

    if (captureData.status !== "COMPLETED") {
      await payments.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "failed",
            paypalStatus: captureData.status,
            updatedAt: new Date(),
          },
        }
      );

      return Response.json(
        { error: "O pagamento nao foi concluido pelo PayPal." },
        { status: 400 }
      );
    }

    const paidAt = new Date();

    await applyPurchasedPlan({
      accounts: db.collection("accounts"),
      userId: session.user.userId,
      plan,
      paidAt,
    });

    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "paid",
          paypalStatus: captureData.status,
          paypalCaptureId: getCaptureId(captureData),
          captureData,
          paidAt,
          updatedAt: paidAt,
        },
      }
    );

    return Response.json({
      success: true,
      status: "paid",
      plan: plan.id,
    });
  } catch (error) {
    console.error("ERRO POST /api/payments/paypal/capture:", error);

    return Response.json(
      { error: error.message || "Erro ao capturar pagamento." },
      { status: 500 }
    );
  }
}
