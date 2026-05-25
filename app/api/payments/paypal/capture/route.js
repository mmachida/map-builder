import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { capturePayPalOrder, getPayPalOrder } from "@/lib/paypal";
import { applyPurchasedPlan, getPaymentPlan } from "@/lib/paymentPlans";

function getCaptureId(captureData) {
  return captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";
}

function getCompletedCapture(paypalData) {
  return (
    paypalData?.purchase_units
      ?.flatMap((unit) => unit?.payments?.captures || [])
      ?.find((capture) => capture?.status === "COMPLETED") || null
  );
}

function isPayPalDataPaid(paypalData) {
  return (
    paypalData?.status === "COMPLETED" || Boolean(getCompletedCapture(paypalData))
  );
}

function isPayPalBusinessValidationError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("business validation") ||
    message.includes("semantically incorrect") ||
    message.includes("requested action could not be performed")
  );
}

async function markPaymentPaid({ db, payments, payment, plan, paypalData }) {
  const paidAt = new Date();
  const completedCapture = getCompletedCapture(paypalData);
  const lock = await payments.updateOne(
    { _id: payment._id, status: { $nin: ["paid", "applying"] } },
    {
      $set: {
        status: "applying",
        updatedAt: paidAt,
      },
    }
  );

  if (lock.matchedCount === 0) return;

  await applyPurchasedPlan({
    accounts: db.collection("accounts"),
    userId: payment.userId,
    plan,
    paidAt,
  });

  await payments.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: "paid",
        paypalStatus:
          paypalData?.status || completedCapture?.status || "COMPLETED",
        paypalCaptureId:
          completedCapture?.id ||
          getCaptureId(paypalData) ||
          payment.paypalCaptureId ||
          "",
        captureData: paypalData,
        paidAt,
        updatedAt: paidAt,
      },
    }
  );
}

async function getOrderAndMarkIfPaid({
  db,
  payments,
  payment,
  plan,
  paypalOrderId,
}) {
  const orderData = await getPayPalOrder(paypalOrderId);

  if (!isPayPalDataPaid(orderData)) {
    return { paid: false, paypalData: orderData };
  }

  await markPaymentPaid({
    db,
    payments,
    payment,
    plan,
    paypalData: orderData,
  });

  return { paid: true, paypalData: orderData };
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

    let captureData;

    try {
      captureData = await capturePayPalOrder(paypalOrderId);
    } catch (error) {
      const refreshedPayment = await payments.findOne({
        paypalOrderId,
        userId: session.user.userId,
      });

      if (refreshedPayment?.status === "paid") {
        return Response.json({
          success: true,
          status: "paid",
          plan: plan.id,
        });
      }

      if (isPayPalBusinessValidationError(error)) {
        try {
          const orderResult = await getOrderAndMarkIfPaid({
            db,
            payments,
            payment: refreshedPayment || payment,
            plan,
            paypalOrderId,
          });

          if (orderResult.paid) {
            return Response.json({
              success: true,
              status: "paid",
              plan: plan.id,
            });
          }

          await payments.updateOne(
            { _id: payment._id },
            {
              $set: {
                status: "processing",
                paypalStatus: orderResult.paypalData?.status || "PROCESSING",
                updatedAt: new Date(),
              },
            }
          );
        } catch (lookupError) {
          console.error(
            "ERRO AO CONSULTAR PEDIDO PAYPAL APOS CAPTURA AMBIGUA:",
            lookupError
          );
        }

        return Response.json({
          success: true,
          status: "processing",
          message:
            "Pagamento em processamento. O PayPal ainda esta confirmando a compra.",
          plan: plan.id,
        });
      }

      throw error;
    }

    if (!isPayPalDataPaid(captureData)) {
      try {
        const orderResult = await getOrderAndMarkIfPaid({
          db,
          payments,
          payment,
          plan,
          paypalOrderId,
        });

        if (orderResult.paid) {
          return Response.json({
            success: true,
            status: "paid",
            plan: plan.id,
          });
        }

        captureData = orderResult.paypalData || captureData;
      } catch (lookupError) {
        console.error(
          "ERRO AO CONSULTAR PEDIDO PAYPAL EM STATUS NAO COMPLETO:",
          lookupError
        );
      }

      await payments.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "processing",
            paypalStatus: captureData?.status || "PROCESSING",
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({
        success: true,
        status: "processing",
        message:
          "Pagamento em processamento. O PayPal ainda esta confirmando a compra.",
        plan: plan.id,
      });
    }

    await markPaymentPaid({
      db,
      payments,
      payment,
      plan,
      paypalData: captureData,
    });

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
