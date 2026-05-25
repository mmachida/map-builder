import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { deleteAssetStorage, deleteMapStorage } from "@/lib/r2Storage";
import { getOwnerQuery } from "@/lib/ownership";

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (String(body.confirmation || "").trim().toLowerCase() !== "delete") {
      return Response.json(
        { error: "Digite delete para confirmar." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const ownerQuery = getOwnerQuery(session);
    const account = await db.collection("accounts").findOne({
      user_id: session.user.userId,
    });

    if (!account) {
      return Response.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    const [maps, groups, assets] = await Promise.all([
      db.collection("maps").find(ownerQuery).toArray(),
      db.collection("groups").find(ownerQuery).toArray(),
      db.collection("assets").find(ownerQuery).toArray(),
    ]);

    const mapIds = maps.map((map) => map._id.toString());
    const groupIds = groups.map((group) => group._id.toString());

    await Promise.all([
      ...maps.map((map) => deleteMapStorage(map)),
      ...assets.map((asset) => deleteAssetStorage(asset)),
    ]);

    await Promise.all([
      db.collection("pins").deleteMany({
        $or: [{ ownerUserId: session.user.userId }, { mapId: { $in: mapIds } }],
      }),
      db.collection("routes").deleteMany({
        $or: [{ ownerUserId: session.user.userId }, { mapId: { $in: mapIds } }],
      }),
      db.collection("notes").deleteMany({
        $or: [{ ownerUserId: session.user.userId }, { mapId: { $in: mapIds } }],
      }),
      db.collection("mapLogs").deleteMany({ mapId: { $in: mapIds } }),
      db.collection("activityLogs").deleteMany({ mapId: { $in: mapIds } }),
      db.collection("pinCategories").deleteMany({
        $or: [
          { ownerUserId: session.user.userId },
          { groupId: { $in: groupIds } },
        ],
      }),
      db.collection("pinTypes").deleteMany({
        $or: [
          { ownerUserId: session.user.userId },
          { groupId: { $in: groupIds } },
        ],
      }),
      db.collection("maps").deleteMany(ownerQuery),
      db.collection("groups").deleteMany(ownerQuery),
      db.collection("assets").deleteMany(ownerQuery),
      db.collection("maps").updateMany(
        {},
        { $pull: { editors: { userId: session.user.userId } } }
      ),
      db.collection("maps").updateMany(
        {},
        { $pull: { editors: { user_id: session.user.userId } } }
      ),
      db.collection("maps").updateMany(
        {},
        { $pull: { editors: { username: account.username } } }
      ),
      db.collection("maps").updateMany(
        {},
        { $pull: { editors: { name: account.username } } }
      ),
      db.collection("accounts").deleteOne({ user_id: session.user.userId }),
    ]);

    if (account.provider === "steam" && account.provider_user_id) {
      await db.collection("steamLoginTickets").deleteMany({
        steamId: account.provider_user_id,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO DELETE /api/account:", error);

    return Response.json(
      { error: "Erro ao deletar conta." },
      { status: 500 }
    );
  }
}
