import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { deleteAssetStorage, deleteMapStorage } from "@/lib/r2Storage";
import { replaceCustomAssetIconReferences } from "@/lib/pinIconFallback";
import { validateUsername } from "@/lib/accounts";

const PAGE_SIZE = 50;

function isLocalRequest(request) {
  const host = request.headers.get("host") || "";
  const forwardedHost = request.headers.get("x-forwarded-host") || "";
  const target = forwardedHost || host;

  return (
    target.startsWith("localhost") ||
    target.startsWith("127.0.0.1") ||
    target.startsWith("[::1]")
  );
}

function serializeDocument(document) {
  if (!document) return null;

  return {
    ...document,
    _id: document._id?.toString?.() || document._id,
  };
}

function userOwnerQuery(user) {
  return {
    $or: [
      { ownerUserId: user.user_id },
      { ownerUsername: user.username },
      { ownerEmail: user.email },
      { ownerName: user.username },
    ].filter((condition) => Object.values(condition)[0]),
  };
}

function accountMatchesMap(account, map) {
  return Boolean(
    (map.ownerUserId && account.user_id === map.ownerUserId) ||
      (map.ownerUsername && account.username === map.ownerUsername) ||
      (map.ownerEmail && account.email === map.ownerEmail) ||
      (map.ownerName && account.username === map.ownerName)
  );
}

function getMapOwnerLabel(map, accounts) {
  const account = accounts.find((candidate) => accountMatchesMap(candidate, map));

  if (account?.username) {
    return account.username;
  }

  if (map.ownerUsername) {
    return map.ownerUsername;
  }

  if (map.ownerName) {
    return map.ownerName;
  }

  if (map.ownerUserId) {
    return map.ownerUserId;
  }

  if (map.ownerEmail) {
    return map.ownerEmail;
  }

  return "";
}

async function getSummary(db) {
  const [users, maps, pins, routes, notes, groups, assets] = await Promise.all([
    db.collection("accounts").countDocuments(),
    db.collection("maps").countDocuments(),
    db.collection("pins").countDocuments(),
    db.collection("routes").countDocuments(),
    db.collection("notes").countDocuments(),
    db.collection("groups").countDocuments(),
    db.collection("assets").countDocuments(),
  ]);

  return { users, maps, pins, routes, notes, groups, assets };
}

export async function GET(request) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Local admin is only available on localhost." },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "summary";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const userId = url.searchParams.get("userId") || "";
    const groupId = url.searchParams.get("groupId") || "";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    if (view === "summary") {
      return Response.json({ summary: await getSummary(db) });
    }

    if (view === "users") {
      const skip = (page - 1) * PAGE_SIZE;
      const [total, users] = await Promise.all([
        db.collection("accounts").countDocuments(),
        db
          .collection("accounts")
          .find(
            {},
            {
              projection: {
                user_id: 1,
                username: 1,
                usernameConfirmed: 1,
                provider: 1,
                provider_user_id: 1,
                email: 1,
                banned: 1,
                bannedAt: 1,
                supporter: 1,
                isSupporter: 1,
                supporterStatus: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            }
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .toArray(),
      ]);

      return Response.json({
        users: users.map(serializeDocument),
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      });
    }

    if (view === "maps") {
      const skip = (page - 1) * PAGE_SIZE;
      const [total, maps] = await Promise.all([
        db.collection("maps").countDocuments(),
        db
          .collection("maps")
          .find(
            {},
            {
              projection: {
                title: 1,
                visibility: 1,
                groupId: 1,
                ownerUserId: 1,
                ownerUsername: 1,
                ownerEmail: 1,
                ownerName: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            }
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .toArray(),
      ]);
      const mapIds = maps.map((map) => map._id.toString());
      const groupIds = [
        ...new Set(maps.map((map) => map.groupId).filter(Boolean)),
      ];
      const ownerConditions = [];

      for (const map of maps) {
        if (map.ownerUserId) ownerConditions.push({ user_id: map.ownerUserId });
        if (map.ownerUsername) ownerConditions.push({ username: map.ownerUsername });
        if (map.ownerEmail) ownerConditions.push({ email: map.ownerEmail });
        if (map.ownerName) ownerConditions.push({ username: map.ownerName });
      }

      const [pinCounts, accounts, groups] = await Promise.all([
        db
          .collection("pins")
          .aggregate([
            { $match: { mapId: { $in: mapIds } } },
            { $group: { _id: "$mapId", count: { $sum: 1 } } },
          ])
          .toArray(),
        ownerConditions.length
          ? db
              .collection("accounts")
              .find(
                { $or: ownerConditions },
                {
                  projection: {
                    user_id: 1,
                    username: 1,
                    email: 1,
                    provider: 1,
                  },
                }
              )
              .toArray()
          : [],
        groupIds.length
          ? db
              .collection("groups")
              .find(
                {
                  $or: [
                    { _id: { $in: groupIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } },
                    { _id: { $in: groupIds } },
                  ],
                },
                { projection: { name: 1 } }
              )
              .toArray()
          : [],
      ]);
      const pinCountByMapId = new Map(
        pinCounts.map((entry) => [String(entry._id), entry.count])
      );
      const groupNameById = new Map(
        groups.map((group) => [group._id.toString(), group.name || "Sem nome"])
      );

      return Response.json({
        maps: maps.map((map) => ({
          ...serializeDocument(map),
          pinCount: pinCountByMapId.get(map._id.toString()) || 0,
          groupName: map.groupId
            ? groupNameById.get(String(map.groupId)) || "Grupo nao encontrado"
            : "Sem grupo",
          ownerLabel: getMapOwnerLabel(map, accounts),
          hasLinkedUser: accounts.some((account) => accountMatchesMap(account, map)),
        })),
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      });
    }

    if (view === "user") {
      const user = await db.collection("accounts").findOne({ user_id: userId });

      if (!user) {
        return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
      }

      const ownerQuery = userOwnerQuery(user);
      const [groups, assets, mapCount, pinCount] = await Promise.all([
        db
          .collection("groups")
          .find(ownerQuery)
          .sort({ createdAt: -1 })
          .toArray(),
        db
          .collection("assets")
          .find(ownerQuery)
          .sort({ createdAt: -1 })
          .toArray(),
        db.collection("maps").countDocuments(ownerQuery),
        db.collection("pins").countDocuments(ownerQuery),
      ]);

      return Response.json({
        user: serializeDocument(user),
        groups: groups.map(serializeDocument),
        assets: assets.map((asset) => ({
          ...serializeDocument(asset),
          linkedGroupIds: asset.linkedGroupIds || [],
        })),
        counts: {
          groups: groups.length,
          assets: assets.length,
          maps: mapCount,
          pins: pinCount,
        },
      });
    }

    if (view === "group") {
      const maps = await db
        .collection("maps")
        .find({ groupId })
        .sort({ createdAt: -1 })
        .toArray();

      return Response.json({
        groupId,
        maps: maps.map(serializeDocument),
      });
    }

    return Response.json({ error: "View invalida." }, { status: 400 });
  } catch (error) {
    console.error("ERRO GET /api/local-admin:", error);

    return Response.json(
      { error: "Erro ao carregar dados locais." },
      { status: 500 }
    );
  }
}

async function deleteMapById(db, mapId) {
  if (!ObjectId.isValid(mapId)) {
    return { deletedCount: 0 };
  }

  const map = await db.collection("maps").findOne({ _id: new ObjectId(mapId) });

  if (!map) {
    return { deletedCount: 0 };
  }

  await deleteMapStorage(map);
  await Promise.all([
    db.collection("pins").deleteMany({ mapId }),
    db.collection("routes").deleteMany({ mapId }),
    db.collection("notes").deleteMany({ mapId }),
    db.collection("activityLogs").deleteMany({ mapId }),
    db.collection("maps").deleteOne({ _id: new ObjectId(mapId) }),
  ]);

  return { deletedCount: 1 };
}

async function deleteGroupById(db, groupId) {
  if (!ObjectId.isValid(groupId)) {
    return { deletedCount: 0 };
  }

  const group = await db.collection("groups").findOne({ _id: new ObjectId(groupId) });

  if (!group) {
    return { deletedCount: 0 };
  }

  const maps = await db.collection("maps").find({ groupId }).toArray();
  const mapIds = maps.map((map) => map._id.toString());

  await Promise.all(maps.map((map) => deleteMapStorage(map)));
  await Promise.all([
    db.collection("pins").deleteMany({ mapId: { $in: mapIds } }),
    db.collection("routes").deleteMany({ mapId: { $in: mapIds } }),
    db.collection("notes").deleteMany({ mapId: { $in: mapIds } }),
    db.collection("activityLogs").deleteMany({ mapId: { $in: mapIds } }),
    db.collection("maps").deleteMany({ groupId }),
    db.collection("pinCategories").deleteMany({ groupId }),
    db.collection("pinTypes").deleteMany({ groupId }),
    db.collection("assets").updateMany(
      { linkedGroupIds: groupId },
      { $pull: { linkedGroupIds: groupId }, $set: { updatedAt: new Date() } }
    ),
    db.collection("groups").deleteOne({ _id: new ObjectId(groupId) }),
  ]);

  return { deletedCount: 1 };
}

async function deleteAssetById(db, assetId) {
  if (!ObjectId.isValid(assetId)) {
    return { deletedCount: 0 };
  }

  const asset = await db.collection("assets").findOne({ _id: new ObjectId(assetId) });

  if (!asset) {
    return { deletedCount: 0 };
  }

  await replaceCustomAssetIconReferences({
    db,
    imageUrl: asset.imageUrl,
    deletePins: true,
  });
  await deleteAssetStorage(asset);
  await db.collection("assets").deleteOne({ _id: new ObjectId(assetId) });

  return { deletedCount: 1 };
}

async function setUserBanStatus({ db, userId, banned }) {
  const accounts = db.collection("accounts");
  const currentUser = await accounts.findOne({ user_id: userId });

  if (!currentUser) {
    return { ok: false, error: "Usuario nao encontrado.", status: 404 };
  }

  const now = new Date();
  const accountUpdate = banned
    ? {
        $set: {
          banned: true,
          bannedAt: now,
          updatedAt: now,
        },
      }
    : {
        $set: {
          banned: false,
          updatedAt: now,
        },
        $unset: { bannedAt: "" },
      };

  await accounts.updateOne({ user_id: userId }, accountUpdate);

  if (banned) {
    await db.collection("maps").updateMany(userOwnerQuery(currentUser), {
      $set: {
        visibility: "private",
        updatedAt: now,
      },
    });
  }

  return { ok: true, banned };
}

async function setUserSupporterStatus({ db, userId, supporter }) {
  const accounts = db.collection("accounts");
  const currentUser = await accounts.findOne({ user_id: userId });

  if (!currentUser) {
    return { ok: false, error: "Usuario nao encontrado.", status: 404 };
  }

  const now = new Date();

  if (supporter) {
    await accounts.updateOne(
      { user_id: userId },
      {
        $set: {
          supporter: true,
          supporterStatus: "active",
          supporterUpdatedAt: now,
          updatedAt: now,
        },
      }
    );

    return { ok: true, supporter: true };
  }

  await accounts.updateOne(
    { user_id: userId },
    {
      $set: {
        supporter: false,
        supporterStatus: "free",
        supporterUpdatedAt: now,
        updatedAt: now,
      },
      $unset: { isSupporter: "" },
    }
  );

  return { ok: true, supporter: false };
}

export async function DELETE(request) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Local admin is only available on localhost." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const type = String(body.type || "");
    const id = String(body.id || "");

    if (!type || !id) {
      return Response.json({ error: "Tipo e ID obrigatorios." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    let result;

    if (type === "map") {
      result = await deleteMapById(db, id);
    } else if (type === "group") {
      result = await deleteGroupById(db, id);
    } else if (type === "asset") {
      result = await deleteAssetById(db, id);
    } else {
      return Response.json({ error: "Tipo invalido." }, { status: 400 });
    }

    if (!result.deletedCount) {
      return Response.json({ error: "Conteudo nao encontrado." }, { status: 404 });
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("ERRO DELETE /api/local-admin:", error);

    return Response.json(
      { error: "Erro ao deletar conteudo local." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Local admin is only available on localhost." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const type = String(body.type || "");
    const userId = String(body.userId || "");

    if (!type || !userId) {
      return Response.json({ error: "Acao ou usuario invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    if (type === "banUser" || type === "unbanUser") {
      const result = await setUserBanStatus({
        db,
        userId,
        banned: type === "banUser",
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status || 400 });
      }

      return Response.json({ success: true, banned: result.banned });
    }

    if (type === "setSupporter" || type === "setFreeAccount") {
      const result = await setUserSupporterStatus({
        db,
        userId,
        supporter: type === "setSupporter",
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status || 400 });
      }

      return Response.json({ success: true, supporter: result.supporter });
    }

    if (type !== "renameUser") {
      return Response.json({ error: "Acao invalida." }, { status: 400 });
    }

    const validation = validateUsername(String(body.username || ""));

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const accounts = db.collection("accounts");
    const currentUser = await accounts.findOne({ user_id: userId });

    if (!currentUser) {
      return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    const duplicate = await accounts.findOne({
      username: validation.username,
      user_id: { $ne: userId },
    });

    if (duplicate) {
      return Response.json({ error: "Ja existe um usuario com esse nome." }, { status: 409 });
    }

    const previousUsername = currentUser.username || "";
    const now = new Date();

    await accounts.updateOne(
      { user_id: userId },
      {
        $set: {
          username: validation.username,
          usernameConfirmed: true,
          updatedAt: now,
        },
      }
    );

    const ownershipUpdates = [
      db
        .collection("maps")
        .updateMany(
          { ownerUserId: userId },
          { $set: { ownerUsername: validation.username, updatedAt: now } }
        ),
      db
        .collection("groups")
        .updateMany(
          { ownerUserId: userId },
          { $set: { ownerUsername: validation.username, updatedAt: now } }
        ),
      db
        .collection("assets")
        .updateMany(
          { ownerUserId: userId },
          { $set: { ownerUsername: validation.username, updatedAt: now } }
        ),
    ];

    if (previousUsername) {
      ownershipUpdates.push(
        db
          .collection("maps")
          .updateMany(
            { ownerUsername: previousUsername },
            { $set: { ownerUsername: validation.username, updatedAt: now } }
          ),
        db
          .collection("maps")
          .updateMany(
            { ownerName: previousUsername },
            { $set: { ownerName: validation.username, updatedAt: now } }
          ),
        db
          .collection("groups")
          .updateMany(
            { ownerUsername: previousUsername },
            { $set: { ownerUsername: validation.username, updatedAt: now } }
          ),
        db
          .collection("groups")
          .updateMany(
            { ownerName: previousUsername },
            { $set: { ownerName: validation.username, updatedAt: now } }
          ),
        db
          .collection("assets")
          .updateMany(
            { ownerUsername: previousUsername },
            { $set: { ownerUsername: validation.username, updatedAt: now } }
          ),
        db
          .collection("assets")
          .updateMany(
            { ownerName: previousUsername },
            { $set: { ownerName: validation.username, updatedAt: now } }
          )
      );
    }

    await Promise.all(ownershipUpdates);

    return Response.json({ success: true, username: validation.username });
  } catch (error) {
    console.error("ERRO PATCH /api/local-admin:", error);

    return Response.json(
      { error: "Erro ao renomear usuario local." },
      { status: 500 }
    );
  }
}
