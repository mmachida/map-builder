import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getOwnerQuery } from "@/lib/ownership";
import { stripPrivateAccountFields } from "@/lib/publicData";
import { ensureDefaultPinCategory } from "@/lib/pinCategories";
import { getAccountLimits } from "@/lib/accountLimits";

const MAP_VISIBILITIES = ["public", "notListed", "private"];

function normalizeMapVisibility(value) {
  return MAP_VISIBILITIES.includes(value) ? value : "private";
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ maps: [] });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const group = await db.collection("groups").findOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    if (!group) {
      return Response.json(
        { error: "Grupo não encontrado." },
        { status: 404 }
      );
    }

    const maps = await db
      .collection("maps")
      .find({
        groupId: id,
        ...getOwnerQuery(session),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      maps: maps.map((map) => ({
        ...stripPrivateAccountFields(map),
        _id: map._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/groups/[id]/maps:", error);

    return Response.json(
      { error: "Erro ao buscar mapas do grupo." },
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

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const group = await db.collection("groups").findOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    if (!group) {
      return Response.json(
        { error: "Grupo não encontrado." },
        { status: 404 }
      );
    }

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

    const newMap = {
      groupId: id,
      title: body.title,
      description: String(body.description || "").trim(),
      imageUrl: body.imageUrl,
      tileData: body.tileData || null,
      visibility: normalizeMapVisibility(body.visibility),
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerEmail: session.user.email,
      ownerName: session.user.username || "USER",
      createdAt: new Date(),
    };

    const result = await db.collection("maps").insertOne(newMap);

    await ensureDefaultPinCategory(db, id, session);

    return Response.json({
      map: {
        ...stripPrivateAccountFields(newMap),
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/groups/[id]/maps:", error);

    return Response.json(
      { error: "Erro ao criar mapa." },
      { status: 500 }
    );
  }
}
