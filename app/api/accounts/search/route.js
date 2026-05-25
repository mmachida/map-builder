import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { normalizeUsername } from "@/lib/accounts";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json({ users: [] }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = normalizeUsername(searchParams.get("query") || "");

    if (!query) {
      return Response.json({ users: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const filter = {
      username: {
        $type: "string",
        ...(query ? { $regex: `^${query}` } : {}),
      },
      usernameConfirmed: true,
    };

    const accounts = await db
      .collection("accounts")
      .find(filter, { projection: { _id: 0, username: 1 } })
      .sort({ username: 1 })
      .limit(15)
      .toArray();

    return Response.json({
      users: accounts.map((account) => ({ username: account.username })),
    });
  } catch (error) {
    console.error("ERRO GET /api/accounts/search:", error);

    return Response.json(
      { error: "Erro ao buscar usuarios." },
      { status: 500 }
    );
  }
}
