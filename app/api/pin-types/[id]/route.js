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

    if (!body.typeName?.trim()) {
      return Response.json(
        { error: "Nome da categoria obrigatório." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const pinType = await db.collection("pinTypes").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!pinType) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    const newTypeName = body.typeName.trim();
    const newCategory =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : pinType.category || "geral";

    await db.collection("pinTypes").updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: session.user.email,
      },
      {
        $set: {
          typeName: newTypeName,
          category: newCategory,
          updatedAt: new Date(),
        },
      }
    );

    await db.collection("pins").updateMany(
      {
        groupId: pinType.groupId,
        ownerEmail: session.user.email,
        $or: [
          { iconKey: pinType.iconKey },
          {
            iconType: pinType.iconType,
            icon: pinType.icon,
            iconImageUrl: pinType.iconImageUrl || "",
          },
        ],
      },
      {
        $set: {
          typeName: newTypeName,
          category: newCategory,
          iconKey: pinType.iconKey,
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({
      pinType: {
        ...pinType,
        _id: pinType._id.toString(),
        typeName: newTypeName,
        category: newCategory,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("ERRO PATCH PIN TYPE:", error);

    return Response.json(
      { error: "Erro ao editar categoria." },
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

    const pinType = await db.collection("pinTypes").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!pinType) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    const deletedPins = await db.collection("pins").deleteMany({
      groupId: pinType.groupId,
      ownerEmail: session.user.email,
      $or: [
        { iconKey: pinType.iconKey },
        {
          iconType: pinType.iconType,
          icon: pinType.icon,
          iconImageUrl: pinType.iconImageUrl || "",
        },
      ],
    });

    const deletedPinType = await db.collection("pinTypes").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    return Response.json({
      success: true,
      deletedPins: deletedPins.deletedCount,
      deletedPinType: deletedPinType.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE PIN TYPE:", error);

    return Response.json(
      { error: "Erro ao deletar categoria." },
      { status: 500 }
    );
  }
}