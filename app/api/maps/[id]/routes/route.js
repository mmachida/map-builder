import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";

const MAX_ROUTE_TITLE_LENGTH = 30;
const MAX_ROUTE_DESCRIPTION_LENGTH = 250;

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
        ...stripPrivateAccountFields(route),
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

    const routeName = body.name.trim();
    const routeDescription = body.description?.trim() || "";

    if (routeName.length > MAX_ROUTE_TITLE_LENGTH) {
      return Response.json(
        { error: `O titulo da rota pode ter no maximo ${MAX_ROUTE_TITLE_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    if (routeDescription.length > MAX_ROUTE_DESCRIPTION_LENGTH) {
      return Response.json(
        { error: `A descricao da rota pode ter no maximo ${MAX_ROUTE_DESCRIPTION_LENGTH} caracteres.` },
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

    const { map, access } = await getMapAccessById(db, id, session);

    if (!map || !access.canEditRoutes) {
      return Response.json(
        { error: "Mapa não encontrado ou sem permissão." },
        { status: 403 }
      );
    }

    const newRoute = {
      mapId: id,
      groupId: map.groupId || "",
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerEmail: session.user.email,
      ownerName: session.user.username || "USER",
      name: routeName,
      description: routeDescription,
      points: body.points,
      color: body.color || "#3b82f6",
      width: body.width || 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("routes").insertOne(newRoute);

    return Response.json({
      route: {
        ...stripPrivateAccountFields(newRoute),
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

    const { access } = await getMapAccessById(db, id, session);

    if (!access.canEditRoutes) {
      return Response.json(
        { error: "Sem permissao para editar rotas." },
        { status: 403 }
      );
    }

    const result = await db.collection("routes").deleteMany({ mapId: id });

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
