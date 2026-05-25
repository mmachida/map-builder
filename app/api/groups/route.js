import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getOwnerQuery } from "@/lib/ownership";
import { stripPrivateAccountFields } from "@/lib/publicData";
import { ensureDefaultPinCategory } from "@/lib/pinCategories";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ groups: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const groups = await db
      .collection("groups")
      .find(getOwnerQuery(session))
      .sort({ createdAt: -1 })
      .toArray();
    const groupIds = groups.map((group) => group._id.toString());
    const firstMapsByGroup = new Map();

    if (groupIds.length) {
      const maps = await db
        .collection("maps")
        .find(
          {
            groupId: { $in: groupIds },
            ...getOwnerQuery(session),
          },
          {
            projection: {
              groupId: 1,
              title: 1,
              imageUrl: 1,
              tileData: 1,
              createdAt: 1,
            },
          }
        )
        .sort({ createdAt: 1 })
        .toArray();

      for (const map of maps) {
        if (!firstMapsByGroup.has(map.groupId)) {
          firstMapsByGroup.set(map.groupId, {
            _id: map._id.toString(),
            title: map.title || "",
            imageUrl: map.imageUrl || "",
            tileData: map.tileData || null,
          });
        }
      }
    }

    return Response.json({
      groups: groups.map((group) => ({
        ...stripPrivateAccountFields(group),
        _id: group._id.toString(),
        previewMap: firstMapsByGroup.get(group._id.toString()) || null,
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/groups:", error);

    return Response.json(
      { error: "Erro ao buscar grupos." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const publicUsername = session.user.username || "USER";

    if (!body.name?.trim()) {
      return Response.json(
        { error: "Nome do grupo obrigatório." },
        { status: 400 }
      );
    }

    const newGroup = {
      name: body.name.trim(),
      ownerUserId: session.user.userId,
      ownerUsername: publicUsername,
      ownerEmail: session.user.email,
      ownerName: publicUsername,
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("groups").insertOne(newGroup);
    const groupId = result.insertedId.toString();

    await ensureDefaultPinCategory(db, groupId, session);

    return Response.json({
      group: {
        ...stripPrivateAccountFields(newGroup),
        _id: groupId,
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/groups:", error);

    return Response.json(
      { error: "Erro ao criar grupo." },
      { status: 500 }
    );
  }
}
