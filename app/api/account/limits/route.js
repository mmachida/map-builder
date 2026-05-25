import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getAccountLimits } from "@/lib/accountLimits";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const account = await db.collection("accounts").findOne(
      { user_id: session.user.userId },
      {
        projection: {
          supporter: 1,
          isSupporter: 1,
          supporterStatus: 1,
          mapSlotBonus: 1,
          customIconSlotBonus: 1,
        },
      }
    );

    if (!account) {
      return Response.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    return Response.json({ limits: getAccountLimits(account) });
  } catch (error) {
    console.error("ERRO GET /api/account/limits:", error);

    return Response.json(
      { error: "Erro ao carregar limites da conta." },
      { status: 500 }
    );
  }
}
