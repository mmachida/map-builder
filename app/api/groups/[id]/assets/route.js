import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ assets: [] });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const group = await db.collection("groups").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!group) {
      return Response.json({ error: "Grupo não encontrado." }, { status: 404 });
    }

    const assets = await db
      .collection("assets")
      .find({
        ownerEmail: session.user.email,
        linkedGroupIds: id,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      assets: assets.map((asset) => ({
        ...asset,
        _id: asset._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET GROUP ASSETS:", error);

    return Response.json(
      { error: "Erro ao buscar ícones do grupo." },
      { status: 500 }
    );
  }
}