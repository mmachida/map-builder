import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({
      _id: new ObjectId(id),
    });

    if (!map) {
      return Response.json(
        { error: "Mapa não encontrado." },
        { status: 404 }
      );
    }

    const isOwner = session?.user?.email === map.ownerEmail;

    return Response.json({
      map: {
        ...map,
        _id: map._id.toString(),
      },
      isOwner,
    });
  } catch (error) {
    console.error("ERRO GET /api/maps/[id]:", error);

    return Response.json(
      { error: error.message || "Erro ao buscar mapa." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { error: "ID inválido." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection("maps").deleteOne({
      _id: new ObjectId(id),
    });

    await db.collection("pins").deleteMany({
      mapId: id,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO DELETE /api/maps/[id]:", error);

    return Response.json(
      { error: error.message || "Erro ao deletar mapa." },
      { status: 500 }
    );
  }
}
