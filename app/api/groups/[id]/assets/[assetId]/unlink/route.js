import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { replaceCustomAssetIconReferences } from "@/lib/pinIconFallback";
import { getOwnerQuery } from "@/lib/ownership";

export async function PATCH(request, context) {
  try {
    const { id, assetId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id) || !ObjectId.isValid(assetId)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const asset = await db.collection("assets").findOne({
      _id: new ObjectId(assetId),
      ...getOwnerQuery(session),
    });

    if (!asset) {
      return Response.json(
        { error: "Icone nao encontrado." },
        { status: 404 }
      );
    }

    await db.collection("assets").updateOne(
      {
        _id: new ObjectId(assetId),
        ...getOwnerQuery(session),
      },
      {
        $pull: {
          linkedGroupIds: id,
        },
      }
    );

    await replaceCustomAssetIconReferences({
      db,
      ownerEmail: session.user.email,
      imageUrl: asset.imageUrl,
      groupId: id,
      deletePins: true,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO UNLINK ASSET:", error);

    return Response.json(
      { error: "Erro ao desvincular icone." },
      { status: 500 }
    );
  }
}
