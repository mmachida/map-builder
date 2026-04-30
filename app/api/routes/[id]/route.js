import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

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
      update.name = body.name.trim();
    }

    if (body.color !== undefined) {
      update.color = body.color;
    }

    if (body.width !== undefined) {
      update.width = Number(body.width);
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection("routes").updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: session.user.email,
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

    const result = await db.collection("routes").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
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