import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccess } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Voce precisa estar logado." }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({ _id: new ObjectId(id) });

    if (!getMapAccess(map, session).canViewEditor) {
      return Response.json({ error: "Mapa nao encontrado." }, { status: 404 });
    }

    const logs = await db
      .collection("mapLogs")
      .find({ mapId: id })
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray();

    return Response.json({
      logs: logs.map((log) => ({
        ...stripPrivateAccountFields(log),
        _id: log._id.toString(),
        createdAt: log.createdAt?.toISOString?.() || log.createdAt,
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/maps/[id]/logs:", error);

    return Response.json(
      { error: error.message || "Erro ao buscar historico." },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Voce precisa estar logado." }, { status: 401 });
    }

    const body = await request.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return Response.json({ error: "Mensagem obrigatoria." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({ _id: new ObjectId(id) });

    if (!getMapAccess(map, session).canViewEditor) {
      return Response.json({ error: "Mapa nao encontrado." }, { status: 404 });
    }

    const log = {
      mapId: id,
      userName: session.user.username || "USER",
      userId: session.user.userId,
      message: message.slice(0, 180),
      createdAt: new Date(),
    };

    const result = await db.collection("mapLogs").insertOne(log);

    const extraLogs = await db
      .collection("mapLogs")
      .find({ mapId: id })
      .sort({ createdAt: -1 })
      .skip(15)
      .project({ _id: 1 })
      .toArray();

    if (extraLogs.length > 0) {
      await db.collection("mapLogs").deleteMany({
        _id: { $in: extraLogs.map((entry) => entry._id) },
      });
    }

    return Response.json({
      log: {
        ...stripPrivateAccountFields(log),
        _id: result.insertedId.toString(),
        createdAt: log.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/maps/[id]/logs:", error);

    return Response.json(
      { error: error.message || "Erro ao salvar historico." },
      { status: 500 }
    );
  }
}
