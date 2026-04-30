import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function PATCH(request, context) {
  try {
    const { id, assetId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id) || !ObjectId.isValid(assetId)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const asset = await db.collection("assets").findOne({
      _id: new ObjectId(assetId),
      ownerEmail: session.user.email,
    });

    if (!asset) {
      return Response.json(
        { error: "Ícone não encontrado." },
        { status: 404 }
      );
    }

    await db.collection("assets").updateOne(
      {
        _id: new ObjectId(assetId),
        ownerEmail: session.user.email,
      },
      {
        $pull: {
          linkedGroupIds: id,
        },
      }
    );

    await db.collection("pins").updateMany(
      {
        ownerEmail: session.user.email,
        groupId: id,
        iconType: "custom",
        iconImageUrl: asset.imageUrl,
      },
      {
        $set: {
          iconType: "emoji",
          icon: "📍",
          iconImageUrl: "",
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO UNLINK ASSET:", error);

    return Response.json(
      { error: "Erro ao desvincular ícone." },
      { status: 500 }
    );
  }
}