import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const body = await request.json();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const currentAsset = await db.collection("assets").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!currentAsset) {
      return Response.json(
        { error: "Ícone não encontrado." },
        { status: 404 }
      );
    }

    const oldLinkedGroupIds = currentAsset.linkedGroupIds || [];
    const newLinkedGroupIds = body.linkedGroupIds || [];

    const removedGroupIds = oldLinkedGroupIds.filter(
      (groupId) => !newLinkedGroupIds.includes(groupId)
    );

    const update = {
      name: body.name?.trim() || currentAsset.name,
      linkedGroupIds: newLinkedGroupIds,
      updatedAt: new Date(),
    };

    const result = await db.collection("assets").updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: session.user.email,
      },
      {
        $set: update,
      }
    );

    if (removedGroupIds.length > 0) {
      await db.collection("pins").updateMany(
        {
          ownerEmail: session.user.email,
          groupId: { $in: removedGroupIds },
          iconType: "custom",
          iconImageUrl: currentAsset.imageUrl,
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
    }

    return Response.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("ERRO PATCH ASSET:", error);

    return Response.json(
      { error: "Erro ao atualizar ícone." },
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
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const asset = await db.collection("assets").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!asset) {
      return Response.json(
        { error: "Ícone não encontrado." },
        { status: 404 }
      );
    }

    await db.collection("pins").updateMany(
      {
        ownerEmail: session.user.email,
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

    const result = await db.collection("assets").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ASSET:", error);

    return Response.json(
      { error: "Erro ao deletar ícone." },
      { status: 500 }
    );
  }
}