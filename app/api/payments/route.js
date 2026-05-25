import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json({ payments: [] });
    }

    const requestUrl = new URL(request.url);
    const paypalOrderId = String(
      requestUrl.searchParams.get("paypalOrderId") || ""
    );
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    if (paypalOrderId) {
      const payment = await db.collection("payments").findOne({
        userId: session.user.userId,
        paypalOrderId,
      });

      if (!payment) {
        return Response.json(
          { error: "Pagamento nao encontrado." },
          { status: 404 }
        );
      }

      return Response.json({
        payment: {
          _id: payment._id.toString(),
          provider: payment.provider,
          plan: payment.plan,
          planLabel: payment.planLabel,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt || null,
        },
      }, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const payments = await db
      .collection("payments")
      .find({ userId: session.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return Response.json({
      payments: payments.map((payment) => ({
        _id: payment._id.toString(),
        provider: payment.provider,
        plan: payment.plan,
        planLabel: payment.planLabel,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt || null,
      })),
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ERRO GET /api/payments:", error);

    return Response.json(
      { error: "Erro ao carregar pagamentos." },
      { status: 500 }
    );
  }
}
