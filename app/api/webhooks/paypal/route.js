import clientPromise from "@/lib/mongodb";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { applyPurchasedPlan, getPaymentPlan } from "@/lib/paymentPlans";

function getOrderIdFromLinks(resource) {
  const orderLink = resource?.links?.find(
    (link) =>
      link?.rel === "up" &&
      typeof link?.href === "string" &&
      link.href.includes("/v2/checkout/orders/")
  );

  if (!orderLink?.href) return "";

  return orderLink.href
    .split("/v2/checkout/orders/")[1]
    ?.split(/[/?#]/)[0] || "";
}

function getOrderId(event) {
  const resource = event?.resource || {};

  if (String(event?.event_type || "").startsWith("PAYMENT.CAPTURE.")) {
    return (
      resource.supplementary_data?.related_ids?.order_id ||
      getOrderIdFromLinks(resource) ||
      resource.invoice_id ||
      ""
    );
  }

  return (
    resource.id ||
    resource.supplementary_data?.related_ids?.order_id ||
    getOrderIdFromLinks(resource) ||
    resource.invoice_id ||
    ""
  );
}

function getCaptureId(event) {
  const resource = event?.resource || {};

  return resource.id || "";
}

async function markPaymentPaid({ db, payment, event, now }) {
  if (!payment || payment.status === "paid") return;

  const plan = getPaymentPlan(payment.plan);

  if (!plan) return;

  const payments = db.collection("payments");
  const lock = await payments.updateOne(
    { _id: payment._id, status: { $nin: ["paid", "applying"] } },
    {
      $set: {
        status: "applying",
        updatedAt: now,
      },
    }
  );

  if (lock.matchedCount === 0) return;

  await applyPurchasedPlan({
    accounts: db.collection("accounts"),
    userId: payment.userId,
    plan,
    paidAt: now,
  });

  await payments.updateOne(
    { _id: payment._id },
    {
      $set: {
        status: "paid",
        paypalStatus: "COMPLETED",
        paypalCaptureId: getCaptureId(event),
        paidAt: now,
        updatedAt: now,
      },
    }
  );
}

async function processPayPalEvent({ db, event, now }) {
  const eventType = event?.event_type || "";
  const orderId = getOrderId(event);
  const captureId = getCaptureId(event);
  const payments = db.collection("payments");

  if (!orderId && !captureId) {
    return { processed: false, reason: "missing_order_or_capture_id" };
  }

  const payment = await payments.findOne({
    $or: [
      ...(orderId ? [{ paypalOrderId: orderId }] : []),
      ...(captureId ? [{ paypalCaptureId: captureId }] : []),
    ],
  });

  if (!payment) {
    return { processed: false, reason: "payment_not_found" };
  }

  if (eventType === "CHECKOUT.ORDER.APPROVED") {
    if (payment.status !== "paid") {
      await payments.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "approved",
            paypalStatus: "APPROVED",
            updatedAt: now,
          },
        }
      );
    }

    return { processed: true, status: "approved" };
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    await markPaymentPaid({ db, payment, event, now });
    return { processed: true, status: "paid" };
  }

  if (eventType === "PAYMENT.CAPTURE.DENIED") {
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "denied",
          paypalStatus: "DENIED",
          updatedAt: now,
        },
      }
    );

    return { processed: true, status: "denied" };
  }

  if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
    await payments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "refunded",
          paypalStatus: "REFUNDED",
          refundedAt: now,
          updatedAt: now,
        },
      }
    );

    return { processed: true, status: "refunded" };
  }

  return { processed: false, reason: "event_not_handled" };
}

export async function POST(request) {
  try {
    const event = await request.json();
    const now = new Date();
    const verification = await verifyPayPalWebhook({
      headers: request.headers,
      event,
    });

    if (!verification.skipped && !verification.verified) {
      return Response.json(
        { error: "Webhook do PayPal nao verificado." },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const result = await processPayPalEvent({ db, event, now });

    await db.collection("paypalWebhookEvents").insertOne({
      provider: "paypal",
      eventId: event.id || "",
      eventType: event.event_type || "",
      resourceType: event.resource_type || "",
      resource: event.resource || null,
      verified: verification.verified,
      verificationSkipped: verification.skipped,
      verificationStatus: verification.verificationStatus || null,
      processed: result.processed,
      processResult: result,
      receivedAt: now,
      createdAt: now,
    });

    return Response.json({ received: true, ...result });
  } catch (error) {
    console.error("ERRO POST /api/webhooks/paypal:", error);

    return Response.json(
      { error: "Erro ao receber webhook do PayPal." },
      { status: 500 }
    );
  }
}
