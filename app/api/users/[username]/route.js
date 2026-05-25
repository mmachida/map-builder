import clientPromise from "@/lib/mongodb";
import { normalizeUsername } from "@/lib/accounts";
import { stripPrivateAccountFields } from "@/lib/publicData";

function isSupporterAccount(account) {
  return (
    account?.supporter === true ||
    account?.isSupporter === true ||
    account?.supporterStatus === "active"
  );
}

function safeSocialLinks(links) {
  if (!Array.isArray(links)) return [];

  return links
    .slice(0, 5)
    .map((link) => ({
      title: String(link?.title || "").trim(),
      url: String(link?.url || "").trim(),
    }))
    .filter((link) => link.title && link.url);
}

export async function GET(_request, context) {
  try {
    const { username: rawUsername } = await context.params;
    const username = normalizeUsername(rawUsername || "");

    if (!username) {
      return Response.json({ error: "Usuario invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const account = await db.collection("accounts").findOne(
      { username, usernameConfirmed: true },
      {
        projection: {
          _id: 0,
          user_id: 1,
          username: 1,
          createdAt: 1,
          profileTitle: 1,
          profileBio: 1,
          userColor: 1,
          userGlow: 1,
          userCardColor: 1,
          country: 1,
          socialLinks: 1,
          supporter: 1,
          isSupporter: 1,
          supporterStatus: 1,
        },
      }
    );

    if (!account) {
      return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    const isSupporter = isSupporterAccount(account);
    const ownerQuery = {
      $or: [
        { ownerUserId: account.user_id },
        { ownerUsername: account.username },
        { ownerName: account.username },
      ],
    };
    const maps = await db
      .collection("maps")
      .find({
        visibility: "public",
        ...ownerQuery,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();
    const [createdMapsCount, collaboratorMapsCount, customIconsCount, pinsCount] =
      await Promise.all([
        db.collection("maps").countDocuments(ownerQuery),
        db.collection("maps").countDocuments({
          $or: [
            { "editors.userId": account.user_id },
            { "editors.user_id": account.user_id },
            { "editors.username": account.username },
            { "editors.name": account.username },
          ],
        }),
        db.collection("assets").countDocuments(ownerQuery),
        db.collection("pins").countDocuments(ownerQuery),
      ]);

    return Response.json({
      user: {
        username: account.username,
        createdAt: account.createdAt || null,
        profileTitle: account.profileTitle || "",
        profileBio: account.profileBio || "",
        userColor: account.userColor || "#f5d18a",
        userGlow: isSupporter && account.userGlow === true,
        userCardColor:
          isSupporter && account.userCardColor !== "#b98b4a"
            ? account.userCardColor || ""
            : "",
        country: account.country || "",
        socialLinks: safeSocialLinks(account.socialLinks),
        status: isSupporter ? "Supporter" : "Free account",
        supporter: isSupporter,
        stats: {
          createdMaps: createdMapsCount,
          collaboratorMaps: collaboratorMapsCount,
          customIcons: customIconsCount,
          pinsPlaced: pinsCount,
        },
      },
      maps: maps.map((map) => ({
        ...stripPrivateAccountFields(map),
        _id: map._id.toString(),
        tags: Array.isArray(map.tags) ? map.tags : [],
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/users/[username]:", error);

    return Response.json(
      { error: "Erro ao carregar perfil publico." },
      { status: 500 }
    );
  }
}
