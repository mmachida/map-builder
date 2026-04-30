import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ groups: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const groups = await db
      .collection("groups")
      .find({ ownerEmail: session.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      groups: groups.map((group) => ({
        ...group,
        _id: group._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/groups:", error);

    return Response.json(
      { error: "Erro ao buscar grupos." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return Response.json(
        { error: "Nome do grupo obrigatório." },
        { status: 400 }
      );
    }

    const newGroup = {
      name: body.name.trim(),
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("groups").insertOne(newGroup);

    return Response.json({
      group: {
        ...newGroup,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/groups:", error);

    return Response.json(
      { error: "Erro ao criar grupo." },
      { status: 500 }
    );
  }
}