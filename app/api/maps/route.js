import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

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
      .find({ ownerEmail: session.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    const mapsFormatted = maps.map((map) => ({
      ...map,
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

    const newMap = {
      title: body.title,
      imageUrl: body.imageUrl,
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("maps").insertOne(newMap);

    return Response.json({
      map: {
        ...newMap,
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
