import clientPromise from "@/lib/mongodb";
import { stripPrivateAccountFields } from "@/lib/publicData";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const pageSize = 20;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const filter = {
      $or: [
        { visibility: "public" },
        { visibility: "Public" },
        { visibility: { $exists: false } },
        { visibility: "" },
        { visibility: null },
      ],
    };

    if (query) {
      const regex = new RegExp(escapeRegExp(query), "i");
      filter.$and = [{ $or: [{ title: regex }, { tags: regex }] }];
    }

    const total = await db.collection("maps").countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);

    const maps = await db
      .collection("maps")
      .find(filter)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    const ownerConditions = [];

    maps.forEach((map) => {
      if (map.ownerUserId) ownerConditions.push({ user_id: map.ownerUserId });
      if (map.ownerUsername) ownerConditions.push({ username: map.ownerUsername });
      if (map.ownerName) ownerConditions.push({ username: map.ownerName });
    });

    const owners = ownerConditions.length
      ? await db
          .collection("accounts")
          .find(
            { $or: ownerConditions },
            {
              projection: {
                _id: 0,
                user_id: 1,
                username: 1,
                userColor: 1,
                userGlow: 1,
                userCardColor: 1,
                supporter: 1,
                isSupporter: 1,
                supporterStatus: 1,
              },
            }
          )
          .toArray()
      : [];

    function findOwner(map) {
      return owners.find(
        (owner) =>
          (map.ownerUserId && owner.user_id === map.ownerUserId) ||
          (map.ownerUsername && owner.username === map.ownerUsername) ||
          (map.ownerName && owner.username === map.ownerName)
      );
    }

    return Response.json({
      page: currentPage,
      pageSize,
      total,
      totalPages,
      maps: maps.map((map) => {
        const owner = findOwner(map);
        const ownerIsSupporter =
          owner?.supporter === true ||
          owner?.isSupporter === true ||
          owner?.supporterStatus === "active";

        return {
          ...stripPrivateAccountFields(map),
          _id: map._id.toString(),
          tags: Array.isArray(map.tags) ? map.tags : [],
          ownerUserColor: owner?.userColor || "",
          ownerUserGlow: ownerIsSupporter && owner?.userGlow === true,
          ownerCardColor:
            ownerIsSupporter && owner?.userCardColor !== "#b98b4a"
              ? owner?.userCardColor || ""
              : "",
        };
      }),
    });
  } catch (error) {
    console.error("ERRO GET /api/library:", error);

    return Response.json(
      { error: "Erro ao buscar mapas publicos." },
      { status: 500 }
    );
  }
}
