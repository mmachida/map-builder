import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { ensureDefaultPinCategory } from "@/lib/pinCategories";

const MAX_GROUP_NAME_LENGTH = 15;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    if (session) {
      await ensureDefaultPinCategory(db, id, session);
    }

    const categories = await db
      .collection("pinCategories")
      .find({
        groupId: id,
      })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray();

    const formatted = categories.map((category, index) => ({
      ...category,
      _id: category._id.toString(),
      sortOrder:
        typeof category.sortOrder === "number"
          ? category.sortOrder
          : index + 1,
    }));

    return Response.json({
      categories: formatted,
    });
  } catch (error) {
    console.error("ERRO GET PIN CATEGORIES:", error);

    return Response.json(
      { error: "Erro ao buscar categorias." },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
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

    if (!body.label?.trim()) {
      return Response.json(
        { error: "Nome da categoria obrigatório." },
        { status: 400 }
      );
    }

    const label = body.label.trim();

    if (label.length > MAX_GROUP_NAME_LENGTH) {
      return Response.json(
        { error: `O grupo pode ter no maximo ${MAX_GROUP_NAME_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const value = slugify(label);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const groupAccess = await getMapAccessForGroup(db, id, session);

    if (!groupAccess.canManagePinGroups) {
      return Response.json(
        { error: "Sem permissao para gerenciar categorias." },
        { status: 403 }
      );
    }

    const existing = await db.collection("pinCategories").findOne({
      groupId: id,
      value,
    });

    if (existing) {
      return Response.json(
        { error: "Essa categoria já existe." },
        { status: 400 }
      );
    }

    const lastCategory = await db
      .collection("pinCategories")
      .find({
        groupId: id,
      })
      .sort({ sortOrder: -1, createdAt: -1 })
      .limit(1)
      .toArray();

    const fallbackSortOrder =
      lastCategory.length > 0 && typeof lastCategory[0].sortOrder === "number"
        ? lastCategory[0].sortOrder + 1
        : 1;

    const sortOrder =
      typeof body.sortOrder === "number" ? body.sortOrder : fallbackSortOrder;

    const newCategory = {
      groupId: id,
      ownerEmail: session.user.email,
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerName: session.user.username || "USER",
      value,
      label,
      sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("pinCategories").insertOne(newCategory);

    return Response.json({
      category: {
        ...newCategory,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST PIN CATEGORY:", error);

    return Response.json(
      { error: "Erro ao criar categoria." },
      { status: 500 }
    );
  }
}
