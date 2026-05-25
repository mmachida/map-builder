import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getOwnerQuery } from "@/lib/ownership";
import { stripPrivateAccountFields } from "@/lib/publicData";
import { getAccountLimits } from "@/lib/accountLimits";

const MAP_VISIBILITIES = ["public", "notListed", "private"];

function normalizeMapVisibility(value) {
  return MAP_VISIBILITIES.includes(value) ? value : "private";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ maps: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const maps = await db
      .collection("maps")
      .find(getOwnerQuery(session))
      .sort({ createdAt: -1 })
      .toArray();

    const mapsFormatted = maps.map((map) => ({
      ...stripPrivateAccountFields(map),
      _id: map._id.toString(),
    }));

    return Response.json({ maps: mapsFormatted });
  } catch (error) {
    console.error("ERRO GET /api/maps:", error);

    return Response.json(
      { error: error.message || "Erro ao buscar mapas." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado para criar mapas." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const publicUsername = session.user.username || "USER";

    const newMap = {
      title: body.title,
      description: String(body.description || "").trim(),
      imageUrl: body.imageUrl,
      tileData: body.tileData || null,
      visibility: normalizeMapVisibility(body.visibility),
      ownerUserId: session.user.userId,
      ownerUsername: publicUsername,
      ownerEmail: session.user.email,
      ownerName: publicUsername,
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const [mapCount, account] = await Promise.all([
      db.collection("maps").countDocuments(getOwnerQuery(session)),
      db.collection("accounts").findOne({ user_id: session.user.userId }),
    ]);
    const accountLimits = getAccountLimits(account);

    if (mapCount >= accountLimits.maps) {
      return Response.json(
        {
          error: `Limite de mapas atingido (${mapCount}/${accountLimits.maps}).`,
        },
        { status: 403 }
      );
    }

    const result = await db.collection("maps").insertOne(newMap);

    return Response.json({
      map: {
        ...stripPrivateAccountFields(newMap),
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/maps:", error);

    return Response.json(
      { error: error.message || "Erro ao criar mapa." },
      { status: 500 }
    );
  }
}
