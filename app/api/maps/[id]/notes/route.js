import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";

const MAX_NOTE_TITLE_LENGTH = 80;
const MAX_NOTE_TEXT_LENGTH = 1000;

function sanitizeNoteBody(body) {
  const x = Number(body.x);
  const y = Number(body.y);
  const width = Number(body.width);
  const height = Number(body.height);

  return {
    title: String(body.title || "").trim().slice(0, MAX_NOTE_TITLE_LENGTH),
    text: String(body.text || "").trim().slice(0, MAX_NOTE_TEXT_LENGTH),
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) ? Math.max(2, width) : 12,
    height: Number.isFinite(height) ? Math.max(2, height) : 10,
  };
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const notes = await db
      .collection("notes")
      .find({ mapId: id })
      .sort({ createdAt: 1 })
      .toArray();

    return Response.json({
      notes: notes.map((note) => ({
        ...stripPrivateAccountFields(note),
        _id: note._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET NOTES:", error);
    return Response.json({ error: "Erro ao buscar notas." }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Você precisa estar logado." }, { status: 401 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const { map, access } = await getMapAccessById(db, id, session);

    if (!map || !access.canEditPins) {
      return Response.json({ error: "Sem permissao para editar notas." }, { status: 403 });
    }

    const noteData = sanitizeNoteBody(body);
    const newNote = {
      mapId: id,
      groupId: map.groupId || "",
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerEmail: session.user.email,
      ...noteData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("notes").insertOne(newNote);

    return Response.json({
      note: {
        ...stripPrivateAccountFields(newNote),
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST NOTES:", error);
    return Response.json({ error: "Erro ao criar nota." }, { status: 500 });
  }
}
