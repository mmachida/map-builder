import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { ensureDefaultPinCategory, SYSTEM_PIN_CATEGORY } from "@/lib/pinCategories";
import { getMapAccessForGroup } from "@/lib/mapPermissions";
import {
  getLinkedCustomIconUrls,
  sanitizePinTypesForLinkedAssets,
} from "@/lib/pinIconFallback";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

const MAX_CATEGORY_NAME_LENGTH = 15;

function getIconKey({ iconType, icon, iconImageUrl }) {
  if (iconType === "custom") {
    return `custom:${iconImageUrl || DEFAULT_PIN_ICON_URL}`;
  }

  return `emoji:${icon || "📍"}`;
}

function sanitizePinBackgroundColor(value) {
  const color = String(value || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#0f1014";
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

    const pinTypes = await db
      .collection("pinTypes")
      .find({
        groupId: id,
      })
      .sort({ createdAt: 1 })
      .toArray();
    const linkedIconUrls = await getLinkedCustomIconUrls(db, id);
    const sanitizedPinTypes = sanitizePinTypesForLinkedAssets(
      pinTypes,
      linkedIconUrls
    );

    return Response.json({
      pinTypes: sanitizedPinTypes.map((type) => ({
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

    const typeName = body.typeName.trim();

    if (typeName.length > MAX_CATEGORY_NAME_LENGTH) {
      return Response.json(
        { error: `A categoria pode ter no maximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    if (!body.category) {
      return Response.json(
        { error: "Categoria obrigatória." },
        { status: 400 }
      );
    }

    if (body.category === SYSTEM_PIN_CATEGORY.value) {
      return Response.json(
        { error: "O grupo System nao aceita categorias manuais." },
        { status: 400 }
      );
    }

    const iconType = body.iconType || "custom";
    const icon = body.icon || "📍";
    const iconImageUrl =
      iconType === "custom" ? body.iconImageUrl || DEFAULT_PIN_ICON_URL : "";
    const iconKey = getIconKey({ iconType, icon, iconImageUrl });

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const groupAccess = await getMapAccessForGroup(db, id, session);

    if (!groupAccess.canManagePinGroups) {
      return Response.json(
        { error: "Sem permissao para gerenciar categorias." },
        { status: 403 }
      );
    }

    const existing = await db.collection("pinTypes").findOne({
      groupId: id,
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
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerEmail: session.user.email,
      ownerName: session.user.username || "USER",
      iconKey,
      iconType,
      icon,
      iconImageUrl,
      backgroundColor: sanitizePinBackgroundColor(body.backgroundColor),
      typeName,
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
