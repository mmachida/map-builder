import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

function getIconKey({ iconType, icon, iconImageUrl }) {
  if (iconType === "custom") {
    return `custom:${iconImageUrl}`;
  }

  return `emoji:${icon || "📍"}`;
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ pinTypes: [] });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const pinTypes = await db
      .collection("pinTypes")
      .find({
        groupId: id,
        ownerEmail: session.user.email,
      })
      .sort({ createdAt: 1 })
      .toArray();

    return Response.json({
      pinTypes: pinTypes.map((type) => ({
        ...type,
        _id: type._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET PIN TYPES:", error);

    return Response.json(
      { error: "Erro ao buscar tipos de pin." },
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

    if (!body.typeName?.trim()) {
      return Response.json(
        { error: "Tipo obrigatório." },
        { status: 400 }
      );
    }

    if (!body.category) {
      return Response.json(
        { error: "Categoria obrigatória." },
        { status: 400 }
      );
    }

    const iconType = body.iconType || "emoji";
    const icon = body.icon || "📍";
    const iconImageUrl = body.iconImageUrl || "";
    const iconKey = getIconKey({ iconType, icon, iconImageUrl });

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const existing = await db.collection("pinTypes").findOne({
      groupId: id,
      ownerEmail: session.user.email,
      iconKey,
    });

    if (existing) {
      return Response.json({
        pinType: {
          ...existing,
          _id: existing._id.toString(),
        },
      });
    }

    const newPinType = {
      groupId: id,
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      iconKey,
      iconType,
      icon,
      iconImageUrl,
      typeName: body.typeName.trim(),
      category: body.category,
      createdAt: new Date(),
    };

    const result = await db.collection("pinTypes").insertOne(newPinType);

    return Response.json({
      pinType: {
        ...newPinType,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST PIN TYPE:", error);

    return Response.json(
      { error: "Erro ao criar tipo de pin." },
      { status: 500 }
    );
  }
}