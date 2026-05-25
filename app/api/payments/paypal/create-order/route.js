import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { createPayPalOrder } from "@/lib/paypal";
import { ensurePaymentIndexes, getPaymentPlan } from "@/lib/paymentPlans";

function getBaseUrl(request) {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin
  );
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado para comprar." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const plan = getPaymentPlan(body.plan);

    if (!plan) {
      return Response.json({ error: "Plano invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const account = await db.collection("accounts").findOne({
      user_id: session.user.userId,
    });

    if (!account) {
      return Response.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    if (
      plan.type === "supporter" &&
      (account.supporter === true ||
        account.isSupporter === true ||
        account.supporterStatus === "active")
    ) {
      return Response.json(
        { error: "Sua conta ja possui Supporter." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(request);
    const order = await createPayPalOrder({
      plan,
      returnUrl: `${baseUrl}/support?paypalStatus=return`,
      cancelUrl: `${baseUrl}/support?paypalStatus=cancelled`,
    });

    const approvalUrl = order.links?.find((link) =>
      ["payer-action", "approve"].includes(link.rel)
    )?.href;

    if (!approvalUrl) {
      throw new Error("PayPal nao retornou o link de aprovacao.");
    }

    const payments = db.collection("payments");
    await ensurePaymentIndexes(payments);

    const now = new Date();

    await payments.insertOne({
      userId: session.user.userId,
      username: session.user.username || account.username || "",
      userEmail: session.user.email || account.email || "",
      provider: "paypal",
      paypalOrderId: order.id,
      plan: plan.id,
      planLabel: plan.label,
      amount: plan.amount,
      currency: plan.currency,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({
      paypalOrderId: order.id,
      approvalUrl,
    });
  } catch (error) {
    console.error("ERRO POST /api/payments/paypal/create-order:", error);

    return Response.json(
      { error: error.message || "Erro ao criar pagamento." },
      { status: 500 }
    );
  }
}
