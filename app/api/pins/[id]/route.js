import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";
import { PORTAL_PIN_TYPE, SYSTEM_PIN_CATEGORY } from "@/lib/pinCategories";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

function getIconKey(iconType, icon, iconImageUrl) {
  if (iconType === "custom") {
    return `custom:${iconImageUrl || DEFAULT_PIN_ICON_URL}`;
  }
  return `emoji:${icon || "📍"}`;
}

function sanitizePinBackgroundColor(value) {
  const color = String(value || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#0f1014";
}

function sanitizeChainRequirements(requirements) {
  if (!Array.isArray(requirements)) return [];

  return requirements
    .map((requirement) => ({
      key: String(requirement?.key || requirement?.iconKey || "").trim(),
      category: String(requirement?.category || "geral").trim(),
      groupLabel: String(requirement?.groupLabel || "").trim(),
      typeName: String(requirement?.typeName || requirement?.label || "").trim(),
      icon: String(requirement?.icon || "📍").trim(),
      iconType: requirement?.iconType === "custom" ? "custom" : "emoji",
      iconImageUrl: String(requirement?.iconImageUrl || "").trim(),
      iconKey: String(requirement?.iconKey || requirement?.key || "").trim(),
    }))
    .filter((requirement) => requirement.typeName)
    .slice(0, 100);
}

function sanitizeChainRequirementsV2(requirements) {
  if (!Array.isArray(requirements)) return [];

  if (!requirements.some((requirement) => requirement?.kind === "pin" || requirement?.pinId)) {
    return sanitizeChainRequirements(requirements).map((requirement) => ({
      ...requirement,
      kind: "category",
      pinId: "",
    }));
  }

  return requirements
    .map((requirement) => {
      const kind =
        requirement?.kind === "pin" || requirement?.pinId ? "pin" : "category";
      const pinId = String(requirement?.pinId || "").trim();
      const iconKey = String(requirement?.iconKey || requirement?.key || "").trim();

      return {
        kind,
        pinId,
        key:
          kind === "pin" && pinId
            ? `pin:${pinId}`
            : String(requirement?.key || iconKey).trim(),
        category: String(requirement?.category || "geral").trim(),
        groupLabel: String(requirement?.groupLabel || "").trim(),
        typeName: String(requirement?.typeName || requirement?.label || "").trim(),
        icon: String(requirement?.icon || "\uD83D\uDCCD").trim(),
        iconType: requirement?.iconType === "custom" ? "custom" : "emoji",
        iconImageUrl: String(requirement?.iconImageUrl || "").trim(),
        iconKey,
      };
    })
    .filter((requirement) =>
      requirement.kind === "pin"
        ? ObjectId.isValid(requirement.pinId) && requirement.typeName
        : requirement.typeName
    )
    .slice(0, 100);
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

    const body = await request.json();

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const existingPin = await db.collection("pins").findOne({
      _id: new ObjectId(id),
    });

    if (!existingPin) {
      return Response.json({ error: "Pin nao encontrado." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, existingPin.mapId, session);

    if (!access.canEditPins) {
      return Response.json(
        { error: "Sem permissao para editar pins." },
        { status: 403 }
      );
    }

    const update = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) update.name = body.name;
    if (body.typeName !== undefined || body.name !== undefined) {
      update.typeName = body.typeName || body.name;
    }
    if (body.description !== undefined) update.description = body.description || "";
    if (body.backgroundColor !== undefined) {
      update.backgroundColor = sanitizePinBackgroundColor(body.backgroundColor);
    }

    if (
      body.icon !== undefined ||
      body.iconType !== undefined ||
      body.iconImageUrl !== undefined
    ) {
      update.icon = body.icon || "📍";
      update.iconType = body.iconType || "custom";
      update.iconImageUrl =
        update.iconType === "custom"
          ? body.iconImageUrl || DEFAULT_PIN_ICON_URL
          : "";
      update.iconKey = getIconKey(update.iconType, update.icon, update.iconImageUrl);
    }

    if (body.category !== undefined) update.category = body.category || "geral";
    if (
      body.typeName !== undefined ||
      body.name !== undefined ||
      body.category !== undefined
    ) {
      const nextTypeName = update.typeName || existingPin.typeName || existingPin.name;
      const nextCategory = update.category || existingPin.category || "geral";
      const pinType = await db.collection("pinTypes").findOne({
        groupId: existingPin.groupId || "",
        typeName: nextTypeName,
        category: nextCategory,
      });

      if (!pinType) {
        return Response.json(
          {
            error:
              "Esta categoria nao existe mais. Atualize a pagina antes de editar o pin.",
          },
          { status: 400 }
        );
      }

      update.systemType = pinType?.systemType || null;

      if (!pinType?.systemType) {
        update.destinationMapId = "";
      }
    }
    if (body.destinationMapId !== undefined) {
      const isPortalPin =
        existingPin.systemType === PORTAL_PIN_TYPE.systemType ||
        ((existingPin.category || "geral") === SYSTEM_PIN_CATEGORY.value &&
          (existingPin.typeName || existingPin.name) === PORTAL_PIN_TYPE.typeName);

      if (!isPortalPin) {
        return Response.json(
          { error: "Somente pins Portal podem ter destino." },
          { status: 400 }
        );
      }

      const destinationMapId = String(body.destinationMapId || "").trim();

      if (destinationMapId) {
        if (!ObjectId.isValid(destinationMapId)) {
          return Response.json(
            { error: "Mapa de destino invalido." },
            { status: 400 }
          );
        }

        const destinationMap = await db.collection("maps").findOne({
          _id: new ObjectId(destinationMapId),
          groupId: existingPin.groupId || "",
        });

        if (!destinationMap) {
          return Response.json(
            { error: "Mapa de destino nao encontrado neste grupo." },
            { status: 400 }
          );
        }
      }

      update.destinationMapId = destinationMapId;
    }
    if (body.chainRequirements !== undefined) {
      update.chainRequirements = sanitizeChainRequirementsV2(body.chainRequirements);
    }
    if (body.chainDescription !== undefined) {
      update.chainDescription = String(body.chainDescription || "").trim();
    }
    if (body.x !== undefined) update.x = Number(body.x);
    if (body.y !== undefined) update.y = Number(body.y);

    await db.collection("pins").updateOne(
      {
        _id: new ObjectId(id),
      },
      { $set: update }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH /api/pins/[id]:", error);

    return Response.json(
      { error: "Erro ao atualizar pin." },
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
    const existingPin = await db.collection("pins").findOne({
      _id: new ObjectId(id),
    });

    if (!existingPin) {
      return Response.json({ error: "Pin nao encontrado." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, existingPin.mapId, session);

    if (!access.canEditPins) {
      return Response.json(
        { error: "Sem permissao para editar pins." },
        { status: 403 }
      );
    }

    await db.collection("pins").updateMany(
      {
        mapId: existingPin.mapId,
        "chainRequirements.pinId": id,
      },
      {
        $pull: {
          chainRequirements: { pinId: id },
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    const result = await db.collection("pins").deleteOne({
      _id: new ObjectId(id),
    });

    console.log("PIN DELETADO:", {
      id,
      deletedCount: result.deletedCount,
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE /api/pins/[id]:", error);

    return Response.json(
      { error: "Erro ao deletar pin." },
      { status: 500 }
    );
  }
}
