import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { deleteAssetStorage } from "@/lib/r2Storage";
import { replaceCustomAssetIconReferences } from "@/lib/pinIconFallback";
import { getOwnerQuery } from "@/lib/ownership";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const body = await request.json();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const currentAsset = await db.collection("assets").findOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    if (!currentAsset) {
      return Response.json(
        { error: "Icone nao encontrado." },
        { status: 404 }
      );
    }

    const oldLinkedGroupIds = currentAsset.linkedGroupIds || [];
    const newLinkedGroupIds = body.linkedGroupIds || [];

    const removedGroupIds = oldLinkedGroupIds.filter(
      (groupId) => !newLinkedGroupIds.includes(groupId)
    );

    const nextName = body.name?.trim() || currentAsset.name;
    const duplicateAsset = await db.collection("assets").findOne({
      ...getOwnerQuery(session),
      _id: { $ne: new ObjectId(id) },
      name: { $regex: `^${escapeRegExp(nextName)}$`, $options: "i" },
    });

    if (duplicateAsset) {
      return Response.json(
        { error: "Ja existe um icone customizado com esse nome." },
        { status: 400 }
      );
    }

    const update = {
      name: nextName,
      linkedGroupIds: newLinkedGroupIds,
      updatedAt: new Date(),
    };

    const result = await db.collection("assets").updateOne(
      {
        _id: new ObjectId(id),
        ...getOwnerQuery(session),
      },
      {
        $set: update,
      }
    );

    if (removedGroupIds.length > 0) {
      await Promise.all(
        removedGroupIds.map((groupId) =>
          replaceCustomAssetIconReferences({
            db,
            ownerEmail: session.user.email,
            imageUrl: currentAsset.imageUrl,
            groupId,
            deletePins: true,
          })
        )
      );
    }

    if (removedGroupIds.length > 0) {
      await db.collection("pins").updateMany(
        {
          ...getOwnerQuery(session),
          groupId: { $in: removedGroupIds },
          iconType: "custom",
          iconImageUrl: currentAsset.imageUrl,
        },
        {
          $set: {
            iconType: "custom",
            icon: "📍",
            iconImageUrl: DEFAULT_PIN_ICON_URL,
            updatedAt: new Date(),
          },
        }
      );
    }

    return Response.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("ERRO PATCH ASSET:", error);

    return Response.json(
      { error: "Erro ao atualizar icone." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const asset = await db.collection("assets").findOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    if (!asset) {
      return Response.json(
        { error: "Icone nao encontrado." },
        { status: 404 }
      );
    }

    if ((asset.linkedGroupIds || []).length > 0) {
      return Response.json(
        { error: "Remova o ícone de todos os grupos antes de deletar." },
        { status: 400 }
      );
    }

    await replaceCustomAssetIconReferences({
      db,
      ownerEmail: session.user.email,
      imageUrl: asset.imageUrl,
      deletePins: true,
    });

    await deleteAssetStorage(asset);

    const result = await db.collection("assets").deleteOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ASSET:", error);

    return Response.json(
      { error: "Erro ao deletar icone." },
      { status: 500 }
    );
  }
}
