import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";

const MAX_ROUTE_TITLE_LENGTH = 30;
const MAX_ROUTE_DESCRIPTION_LENGTH = 250;

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

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const body = await request.json();

    const update = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();

      if (name.length > MAX_ROUTE_TITLE_LENGTH) {
        return Response.json(
          { error: `O titulo da rota pode ter no maximo ${MAX_ROUTE_TITLE_LENGTH} caracteres.` },
          { status: 400 }
        );
      }

      update.name = name;
    }

    if (body.description !== undefined) {
      const description = body.description.trim();

      if (description.length > MAX_ROUTE_DESCRIPTION_LENGTH) {
        return Response.json(
          { error: `A descricao da rota pode ter no maximo ${MAX_ROUTE_DESCRIPTION_LENGTH} caracteres.` },
          { status: 400 }
        );
      }

      update.description = description;
    }

    if (body.color !== undefined) {
      update.color = body.color;
    }

    if (body.width !== undefined) {
      update.width = Number(body.width);
    }

    if (body.sortOrder !== undefined) {
      update.sortOrder = Number(body.sortOrder);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const route = await db.collection("routes").findOne({
      _id: new ObjectId(id),
    });

    if (!route) {
      return Response.json({ error: "Rota nao encontrada." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, route.mapId, session);

    if (!access.canEditRoutes) {
      return Response.json(
        { error: "Sem permissao para editar rotas." },
        { status: 403 }
      );
    }

    await db.collection("routes").updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: update,
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH ROUTE:", error);

    return Response.json(
      { error: "Erro ao editar rota." },
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
    const route = await db.collection("routes").findOne({
      _id: new ObjectId(id),
    });

    if (!route) {
      return Response.json({ error: "Rota nao encontrada." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, route.mapId, session);

    if (!access.canEditRoutes) {
      return Response.json(
        { error: "Sem permissao para editar rotas." },
        { status: 403 }
      );
    }

    const result = await db.collection("routes").deleteOne({
      _id: new ObjectId(id),
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ROUTE:", error);

    return Response.json(
      { error: "Erro ao deletar rota." },
      { status: 500 }
    );
  }
}
