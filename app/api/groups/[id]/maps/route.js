import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

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
      ownerEmail: session.user.email,
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
        ownerEmail: session.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      maps: maps.map((map) => ({
        ...map,
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
      ownerEmail: session.user.email,
    });

    if (!group) {
      return Response.json(
        { error: "Grupo não encontrado." },
        { status: 404 }
      );
    }

    const newMap = {
      groupId: id,
      title: body.title,
      imageUrl: body.imageUrl,
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      createdAt: new Date(),
    };

    const result = await db.collection("maps").insertOne(newMap);

    return Response.json({
      map: {
        ...newMap,
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