import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";
import {
  getLinkedCustomIconUrls,
  sanitizePinsForLinkedAssets,
} from "@/lib/pinIconFallback";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

function sanitizePinBackgroundColor(value) {
  const color = String(value || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#0f1014";
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const map = ObjectId.isValid(id)
      ? await db.collection("maps").findOne({ _id: new ObjectId(id) })
      : null;

    const pins = await db
      .collection("pins")
      .find({ mapId: id })
      .sort({ createdAt: 1 })
      .toArray();
    const linkedIconUrls = await getLinkedCustomIconUrls(db, map?.groupId || "");
    const sanitizedPins = sanitizePinsForLinkedAssets(pins, linkedIconUrls);

    const pinsFormatted = sanitizedPins.map((pin) => ({
      ...stripPrivateAccountFields(pin),
      _id: pin._id.toString(),
    }));

    return Response.json({ pins: pinsFormatted });
  } catch (error) {
    console.error("ERRO GET PINS:", error);

    return Response.json(
      { error: "Erro ao buscar pins." },
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

    const body = await request.json();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const { map, access } = await getMapAccessById(db, id, session);

    if (!map || !access.canEditPins) {
      return Response.json(
        { error: "Mapa não encontrado." },
        { status: 403 }
      );
    }
	
	function getIconKey(iconType, icon, iconImageUrl) {
	  if (iconType === "custom") {
		return `custom:${iconImageUrl || DEFAULT_PIN_ICON_URL}`;
	  }
	  return `emoji:${icon || "📍"}`;
	}

    const pinType = await db.collection("pinTypes").findOne({
      groupId: map.groupId || "",
      typeName: body.typeName || body.name,
      category: body.category || "geral",
    });

    if (!pinType) {
      return Response.json(
        {
          error:
            "Esta categoria nao existe mais. Atualize a pagina antes de criar o pin.",
        },
        { status: 400 }
      );
    }

	const newPin = {
	  mapId: id,
	  groupId: map.groupId || "",
	  ownerUserId: map.ownerUserId || session.user.userId,
	  ownerUsername: map.ownerUsername || session.user.username || "USER",
	  ownerEmail: map.ownerEmail,

	  name: body.name,
	  typeName: body.typeName || body.name,
	  description: body.description || "",
	  backgroundColor: sanitizePinBackgroundColor(body.backgroundColor),

	  icon: body.icon || "📍",
	  iconType: body.iconType || "custom",
	  iconImageUrl:
      (body.iconType || "custom") === "custom"
        ? body.iconImageUrl || DEFAULT_PIN_ICON_URL
        : "",
	  iconKey: getIconKey(
		body.iconType || "custom",
		body.icon || "📍",
		body.iconImageUrl || DEFAULT_PIN_ICON_URL
	  ),

	  category: body.category || "geral",
	  systemType: pinType?.systemType || null,
	  destinationMapId: "",
	  chainRequirements: [],
	  chainDescription: "",
	  x: body.x,
	  y: body.y,
	  createdAt: new Date(),
	};

    const result = await db.collection("pins").insertOne(newPin);

    return Response.json({
      pin: {
        ...stripPrivateAccountFields(newPin),
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST PINS:", error);

    return Response.json(
      { error: "Erro ao criar pin." },
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const { access } = await getMapAccessById(db, id, session);

    if (!access.canEditPins) {
      return Response.json(
        { error: "Sem permissao para editar pins." },
        { status: 403 }
      );
    }

    const result = await db.collection("pins").deleteMany({ mapId: id });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ALL PINS:", error);

    return Response.json(
      { error: "Erro ao limpar pins." },
      { status: 500 }
    );
  }
}
