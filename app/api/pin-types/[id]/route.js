import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessForGroup } from "@/lib/mapPermissions";
import { PORTAL_PIN_TYPE } from "@/lib/pinCategories";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

const MAX_CATEGORY_NAME_LENGTH = 15;

function sanitizePinBackgroundColor(value, fallback = "#0f1014") {
  const color = String(value || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color)
    ? color.toLowerCase()
    : fallback;
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
    });

    if (!pinType) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    const groupAccess = await getMapAccessForGroup(db, pinType.groupId, session);

    if (!groupAccess.canManagePinGroups) {
      return Response.json(
        { error: "Sem permissao para gerenciar categorias." },
        { status: 403 }
      );
    }

    const isSystemPortal = pinType.systemType === PORTAL_PIN_TYPE.systemType;
    const newTypeName = isSystemPortal
      ? PORTAL_PIN_TYPE.typeName
      : body.typeName.trim();

    if (!isSystemPortal && newTypeName.length > MAX_CATEGORY_NAME_LENGTH) {
      return Response.json(
        { error: `A categoria pode ter no maximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const newCategory =
      isSystemPortal
        ? PORTAL_PIN_TYPE.category
        :
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : pinType.category || "geral";

    const newIconType = body.iconType || pinType.iconType || "custom";
    const newIcon = newIconType === "custom" ? "" : body.icon || pinType.icon || "📍";
    const newIconImageUrl =
      newIconType === "custom"
        ? body.iconImageUrl || pinType.iconImageUrl || DEFAULT_PIN_ICON_URL
        : "";

    const newIconKey =
      newIconType === "custom"
        ? `custom:${newIconImageUrl}`
        : `emoji:${newIcon}`;
    const newBackgroundColor =
      body.backgroundColor !== undefined
        ? sanitizePinBackgroundColor(body.backgroundColor, pinType.backgroundColor || "#0f1014")
        : pinType.backgroundColor || "#0f1014";

    await db.collection("pinTypes").updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          typeName: newTypeName,
          category: newCategory,
          icon: newIcon,
          iconType: newIconType,
          iconImageUrl: newIconImageUrl,
          iconKey: newIconKey,
          backgroundColor: newBackgroundColor,
          systemType: pinType.systemType || null,
          systemLocked: !!pinType.systemLocked,
          updatedAt: new Date(),
        },
      }
    );

    await db.collection("pins").updateMany(
      {
        groupId: pinType.groupId,
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
          icon: newIcon,
          iconType: newIconType,
          iconImageUrl: newIconImageUrl,
          iconKey: newIconKey,
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
        icon: newIcon,
        iconType: newIconType,
        iconImageUrl: newIconImageUrl,
        iconKey: newIconKey,
        backgroundColor: newBackgroundColor,
        systemType: pinType.systemType || null,
        systemLocked: !!pinType.systemLocked,
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
    });

    if (!pinType) {
      return Response.json(
        { error: "Categoria não encontrada." },
        { status: 404 }
      );
    }

    const groupAccess = await getMapAccessForGroup(db, pinType.groupId, session);

    if (!groupAccess.canManagePinGroups) {
      return Response.json(
        { error: "Sem permissao para gerenciar categorias." },
        { status: 403 }
      );
    }

    if (pinType.systemType === PORTAL_PIN_TYPE.systemType) {
      return Response.json(
        { error: "A categoria Portal nao pode ser deletada." },
        { status: 400 }
      );
    }

    await db.collection("pins").updateMany(
      {
        groupId: pinType.groupId,
        chainRequirements: {
          $elemMatch: {
            $or: [
              { iconKey: pinType.iconKey },
              {
                category: pinType.category || "geral",
                typeName: pinType.typeName,
              },
            ],
          },
        },
      },
      {
        $pull: {
          chainRequirements: {
            $or: [
              { iconKey: pinType.iconKey },
              {
                category: pinType.category || "geral",
                typeName: pinType.typeName,
              },
            ],
          },
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    const deletedPins = await db.collection("pins").deleteMany({
      groupId: pinType.groupId,
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
