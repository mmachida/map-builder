import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

const PROFILE_TITLE_MAX_LENGTH = 60;
const PROFILE_BIO_MAX_LENGTH = 500;
const SOCIAL_LINK_LIMIT = 5;
const SOCIAL_TITLE_MAX_LENGTH = 30;
const SOCIAL_URL_MAX_LENGTH = 220;
const COUNTRY_MAX_LENGTH = 80;

function isSupporterAccount(account) {
  return (
    account?.supporter === true ||
    account?.isSupporter === true ||
    account?.supporterStatus === "active"
  );
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanSocialLinks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, SOCIAL_LINK_LIMIT)
    .map((link) => ({
      title: cleanText(link?.title, SOCIAL_TITLE_MAX_LENGTH),
      url: cleanText(link?.url, SOCIAL_URL_MAX_LENGTH),
    }))
    .filter((link) => link.title || link.url);
}

function normalizeProfile(account) {
  return {
    profileTitle: account?.profileTitle || "",
    profileBio: account?.profileBio || "",
    userColor: account?.userColor || "#f5d18a",
    userGlow: account?.userGlow === true,
    userCardColor: account?.userCardColor || "#b98b4a",
    country: account?.country || "",
    socialLinks: Array.isArray(account?.socialLinks) ? account.socialLinks : [],
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const account = await db.collection("accounts").findOne(
      { user_id: session.user.userId },
      {
        projection: {
          _id: 0,
          profileTitle: 1,
          profileBio: 1,
          userColor: 1,
          userGlow: 1,
          userCardColor: 1,
          country: 1,
          socialLinks: 1,
        },
      }
    );

    if (!account) {
      return Response.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    return Response.json({ profile: normalizeProfile(account) });
  } catch (error) {
    console.error("ERRO GET /api/account/profile:", error);

    return Response.json(
      { error: "Erro ao carregar perfil." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return Response.json(
        { error: "Voce precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const accounts = db.collection("accounts");
    const account = await accounts.findOne({ user_id: session.user.userId });

    if (!account) {
      return Response.json({ error: "Conta nao encontrada." }, { status: 404 });
    }

    const updates = {
      profileTitle: cleanText(body.profileTitle, PROFILE_TITLE_MAX_LENGTH),
      profileBio: cleanText(body.profileBio, PROFILE_BIO_MAX_LENGTH),
      country: cleanText(body.country, COUNTRY_MAX_LENGTH),
      socialLinks: cleanSocialLinks(body.socialLinks),
      updatedAt: new Date(),
    };

    if (isSupporterAccount(account)) {
      const color = String(body.userColor || "").trim();

      if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        updates.userColor = color;
      }

      const cardColor = String(body.userCardColor || "").trim();

      if (/^#[0-9a-fA-F]{6}$/.test(cardColor)) {
        updates.userCardColor = cardColor;
      }

      updates.userGlow = body.userGlow === true;
    }

    await accounts.updateOne(
      { user_id: session.user.userId },
      { $set: updates }
    );

    const savedAccount = await accounts.findOne(
      { user_id: session.user.userId },
      {
        projection: {
          _id: 0,
          profileTitle: 1,
          profileBio: 1,
          userColor: 1,
          userGlow: 1,
          userCardColor: 1,
          country: 1,
          socialLinks: 1,
        },
      }
    );

    return Response.json({ profile: normalizeProfile(savedAccount) });
  } catch (error) {
    console.error("ERRO PATCH /api/account/profile:", error);

    return Response.json(
      { error: "Erro ao salvar perfil." },
      { status: 500 }
    );
  }
}
