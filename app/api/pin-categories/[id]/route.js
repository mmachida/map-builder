import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

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

    const category = await db.collection("pinCategories").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!category) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    const updateData = {
      updatedAt: new Date(),
    };

    // 🔹 RENOMEAR (se enviado)
    if (body.label !== undefined) {
      if (!body.label?.trim()) {
        return Response.json(
          { error: "Nome da categoria obrigatório." },
          { status: 400 }
        );
      }

      const newLabel = body.label.trim();
      const newValue = slugify(newLabel);

      const duplicate = await db.collection("pinCategories").findOne({
        _id: { $ne: new ObjectId(id) },
        groupId: category.groupId,
        ownerEmail: session.user.email,
        value: newValue,
      });

      if (duplicate) {
        return Response.json(
          { error: "Já existe uma categoria com esse nome." },
          { status: 400 }
        );
      }

      updateData.label = newLabel;
      updateData.value = newValue;

      // atualizar pins
      await db.collection("pins").updateMany(
        {
          groupId: category.groupId,
          ownerEmail: session.user.email,
          category: category.value,
        },
        {
          $set: {
            category: newValue,
            updatedAt: new Date(),
          },
        }
      );

      // atualizar pinTypes
      await db.collection("pinTypes").updateMany(
        {
          groupId: category.groupId,
          ownerEmail: session.user.email,
          category: category.value,
        },
        {
          $set: {
            category: newValue,
            updatedAt: new Date(),
          },
        }
      );
    }

    // 🔥 NOVO: SORT ORDER
    if (typeof body.sortOrder === "number") {
      updateData.sortOrder = body.sortOrder;
    }

    await db.collection("pinCategories").updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: session.user.email,
      },
      {
        $set: updateData,
      }
    );

    return Response.json({
      category: {
        ...category,
        _id: category._id.toString(),
        ...updateData,
      },
    });
  } catch (error) {
    console.error("ERRO PATCH PIN CATEGORY:", error);

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

    const category = await db.collection("pinCategories").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!category) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    if (category.value === "geral") {
      return Response.json(
        { error: "A categoria Geral não pode ser deletada." },
        { status: 400 }
      );
    }

    const deletedPins = await db.collection("pins").deleteMany({
      groupId: category.groupId,
      ownerEmail: session.user.email,
      category: category.value,
    });

    const deletedPinTypes = await db.collection("pinTypes").deleteMany({
      groupId: category.groupId,
      ownerEmail: session.user.email,
      category: category.value,
    });

    const deletedCategory = await db.collection("pinCategories").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    return Response.json({
      success: true,
      deletedPins: deletedPins.deletedCount,
      deletedPinTypes: deletedPinTypes.deletedCount,
      deletedCategory: deletedCategory.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE PIN CATEGORY:", error);

    return Response.json(
      { error: "Erro ao deletar categoria." },
      { status: 500 }
    );
  }
}