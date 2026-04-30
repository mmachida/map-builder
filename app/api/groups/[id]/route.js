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

    if (!body.name?.trim()) {
      return Response.json(
        { error: "Nome obrigatório." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection("groups").updateOne(
      {
        _id: new ObjectId(id),
        ownerEmail: session.user.email,
      },
      {
        $set: {
          name: body.name.trim(),
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH GROUP:", error);

    return Response.json(
      { error: "Erro ao editar grupo." },
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
      .toArray();

    const mapIds = maps.map((map) => map._id.toString());

    await db.collection("pins").deleteMany({
      mapId: { $in: mapIds },
      ownerEmail: session.user.email,
    });
	
	await db.collection("routes").deleteMany({
	  mapId: { $in: mapIds },
	  ownerEmail: session.user.email,
	});

    await db.collection("maps").deleteMany({
      groupId: id,
      ownerEmail: session.user.email,
    });

    await db.collection("assets").updateMany(
      {
        ownerEmail: session.user.email,
        linkedGroupIds: id,
      },
      {
        $pull: {
          linkedGroupIds: id,
        },
      }
    );

    await db.collection("groups").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO DELETE GROUP:", error);

    return Response.json(
      { error: "Erro ao deletar grupo." },
      { status: 500 }
    );
  }
}