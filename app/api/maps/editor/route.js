import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { isOwnerDocument } from "@/lib/ownership";
import { getEditorEntry, normalizeEditorPermission } from "@/lib/mapPermissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return Response.json({ maps: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const userId = session.user.userId;
    const username = session.user.username;
    const editorConditions = [];

    if (userId) {
      editorConditions.push(
        { "editors.userId": userId },
        { "editors.user_id": userId }
      );
    }

    if (username) {
      editorConditions.push(
        { "editors.username": username },
        { "editors.name": username }
      );
    }

    if (editorConditions.length === 0) {
      return Response.json({ maps: [] });
    }

    const maps = await db
      .collection("maps")
      .find({ $or: editorConditions })
      .sort({ createdAt: -1 })
      .toArray();

    const groupIds = [
      ...new Set(
        maps
          .map((map) => map.groupId)
          .filter((id) => id && ObjectId.isValid(id))
      ),
    ];

    const groups = groupIds.length
      ? await db
          .collection("groups")
          .find({ _id: { $in: groupIds.map((id) => new ObjectId(id)) } })
          .project({ name: 1 })
          .toArray()
      : [];

    const groupNames = new Map(
      groups.map((group) => [group._id.toString(), group.name])
    );

    const mapsFormatted = maps
      .filter((map) => !isOwnerDocument(map, session) && map.visibility !== "private")
      .map((map) => {
        const editor = getEditorEntry(map, session);
        const permission = normalizeEditorPermission(editor?.permission);

        return {
          _id: map._id.toString(),
          title: map.title || "Untitled map",
          description: map.description || "",
          imageUrl: map.imageUrl || "",
          groupId: map.groupId || "",
          groupName: groupNames.get(map.groupId) || "",
          ownerUsername: map.ownerUsername || map.ownerName || "owner",
          permission,
          createdAt: map.createdAt || null,
        };
      });

    return Response.json({ maps: mapsFormatted });
  } catch (error) {
    console.error("ERRO GET /api/maps/editor:", error);

    return Response.json(
      { error: error.message || "Erro ao buscar mapas editáveis." },
      { status: 500 }
    );
  }
}
