import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";

const MAX_NOTE_TITLE_LENGTH = 80;
const MAX_NOTE_TEXT_LENGTH = 1000;

function sanitizeNoteBody(body) {
  const update = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) {
    update.title = String(body.title || "").trim().slice(0, MAX_NOTE_TITLE_LENGTH);
  }

  if (body.text !== undefined) {
    update.text = String(body.text || "").trim().slice(0, MAX_NOTE_TEXT_LENGTH);
  }

  ["x", "y", "width", "height"].forEach((field) => {
    if (body[field] === undefined) return;
    const value = Number(body[field]);
    if (!Number.isFinite(value)) return;
    update[field] = field === "width" || field === "height" ? Math.max(2, value) : value;
  });

  return update;
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Você precisa estar logado." }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const note = await db.collection("notes").findOne({ _id: new ObjectId(id) });

    if (!note) {
      return Response.json({ error: "Nota nao encontrada." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, note.mapId, session);

    if (!access.canEditPins) {
      return Response.json({ error: "Sem permissao para editar notas." }, { status: 403 });
    }

    await db.collection("notes").updateOne(
      { _id: new ObjectId(id) },
      { $set: sanitizeNoteBody(body) }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH NOTE:", error);
    return Response.json({ error: "Erro ao atualizar nota." }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Você precisa estar logado." }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const note = await db.collection("notes").findOne({ _id: new ObjectId(id) });

    if (!note) {
      return Response.json({ error: "Nota nao encontrada." }, { status: 404 });
    }

    const { access } = await getMapAccessById(db, note.mapId, session);

    if (!access.canEditPins) {
      return Response.json({ error: "Sem permissao para editar notas." }, { status: 403 });
    }

    const result = await db.collection("notes").deleteOne({ _id: new ObjectId(id) });

    return Response.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("ERRO DELETE NOTE:", error);
    return Response.json({ error: "Erro ao deletar nota." }, { status: 500 });
  }
}
