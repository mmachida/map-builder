import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json({ payments: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
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
    });
  } catch (error) {
    console.error("ERRO GET /api/payments:", error);

    return Response.json(
      { error: "Erro ao carregar pagamentos." },
      { status: 500 }
    );
  }
}
