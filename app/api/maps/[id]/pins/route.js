import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const pins = await db
      .collection("pins")
      .find({ mapId: id })
      .sort({ createdAt: 1 })
      .toArray();

    const pinsFormatted = pins.map((pin) => ({
      ...pin,
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

    const map = await db.collection("maps").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!map) {
      return Response.json(
        { error: "Mapa não encontrado." },
        { status: 404 }
      );
    }
	
	function getIconKey(iconType, icon, iconImageUrl) {
	  if (iconType === "custom") {
		return `custom:${iconImageUrl}`;
	  }
	  return `emoji:${icon || "📍"}`;
	}

	const newPin = {
	  mapId: id,
	  groupId: map.groupId || "",
	  ownerEmail: map.ownerEmail,

	  name: body.name,
	  typeName: body.typeName || body.name,
	  description: body.description || "",

	  icon: body.icon || "📍",
	  iconType: body.iconType || "emoji",
	  iconImageUrl: body.iconImageUrl || "",
	  iconKey: getIconKey(
		body.iconType || "emoji",
		body.icon || "📍",
		body.iconImageUrl || ""
	  ),

	  category: body.category || "geral",
	  x: body.x,
	  y: body.y,
	  createdAt: new Date(),
	};

    const result = await db.collection("pins").insertOne(newPin);

    return Response.json({
      pin: {
        ...newPin,
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

    const result = await db.collection("pins").deleteMany({
      mapId: id,
      ownerEmail: session.user.email,
    });

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
