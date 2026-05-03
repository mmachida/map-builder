import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const routes = await db
      .collection("routes")
      .find({ mapId: id })
      .sort({ createdAt: 1 })
      .toArray();

    return Response.json({
      routes: routes.map((route) => ({
        ...route,
        _id: route._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET ROUTES:", error);

    return Response.json(
      { error: "Erro ao buscar rotas." },
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

    if (!body.name?.trim()) {
      return Response.json(
        { error: "Nome da rota obrigatório." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.points) || body.points.length < 2) {
      return Response.json(
        { error: "A rota precisa ter pelo menos 2 pontos." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    if (!map) {
      return Response.json(
        { error: "Mapa não encontrado ou sem permissão." },
        { status: 404 }
      );
    }

    const newRoute = {
      mapId: id,
      groupId: map.groupId || "",
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      name: body.name.trim(),
      description: body.description?.trim() || "",
      points: body.points,
      color: body.color || "#3b82f6",
      width: body.width || 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("routes").insertOne(newRoute);

    return Response.json({
      route: {
        ...newRoute,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST ROUTES:", error);

    return Response.json(
      { error: "Erro ao criar rota." },
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

    const result = await db.collection("routes").deleteMany({
      mapId: id,
      ownerEmail: session.user.email,
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ROUTES:", error);

    return Response.json(
      { error: "Erro ao limpar rotas." },
      { status: 500 }
    );
  }
}