import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { ensureAccount } from "@/lib/accounts";
import clientPromise from "@/lib/mongodb";

function applyAccountToToken(token, appAccount) {
  const hasUsername = appAccount.usernameConfirmed === true;
  const isSupporter =
    appAccount.supporter === true ||
    appAccount.isSupporter === true ||
    appAccount.supporterStatus === "active";

  token.userId = appAccount.user_id;
  token.username = hasUsername ? appAccount.username : null;
  token.needsUsername = !hasUsername;
  token.provider = appAccount.provider;
  token.providerUserId = appAccount.provider_user_id;
  token.email = appAccount.email;
  token.banned = appAccount.banned === true;
  token.supporter = isSupporter;

  return token;
}

function bannedRedirectUrl() {
  return "/?loginError=banned";
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
    CredentialsProvider({
      id: "steam",
      name: "Steam",
      credentials: {
        ticket: { label: "Ticket", type: "text" },
      },
      async authorize(credentials) {
        const ticket = String(credentials?.ticket || "");

        if (!ticket) return null;

        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB);
        const tickets = db.collection("steamLoginTickets");

        await tickets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

        const loginTicket = await tickets.findOne({
          ticket,
          usedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
        });

        if (!loginTicket?.steamId) return null;

        await tickets.updateOne(
          { _id: loginTicket._id },
          { $set: { usedAt: new Date() } }
        );

        const appAccount = await ensureAccount({
          provider: "steam",
          providerUserId: loginTicket.steamId,
          email: "",
        });

        if (!appAccount) return null;

        if (appAccount.banned) {
          throw new Error("BANNED");
        }

        return {
          id: appAccount.user_id,
          name: appAccount.username || null,
          email: appAccount.email || "",
          appAccount,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || user?.appAccount) {
        return true;
      }

      const appAccount = await ensureAccount({
        provider: account.provider,
        providerUserId: account.providerAccountId,
        email: profile?.email || user?.email || "",
      });

      if (!appAccount) {
        return false;
      }

      if (appAccount.banned) {
        return bannedRedirectUrl();
      }

      user.appAccount = appAccount;

      return true;
    },
    async jwt({ token, account, profile, user, trigger, session }) {
      if (account && user?.appAccount) {
        return applyAccountToToken(token, user.appAccount);
      }

      if (account) {
        const appAccount = await ensureAccount({
          provider: account.provider,
          providerUserId: account.providerAccountId,
          email: profile?.email || user?.email || token.email,
        });

        if (appAccount) {
          applyAccountToToken(token, appAccount);
        }
      }

      if (trigger === "update" && session?.username) {
        token.username = session.username;
        token.needsUsername = false;
      }

      if (token.userId) {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB_DB);
        const appAccount = await db.collection("accounts").findOne(
          { user_id: token.userId },
          {
            projection: {
              banned: 1,
              bannedAt: 1,
              username: 1,
              usernameConfirmed: 1,
              email: 1,
              supporter: 1,
              isSupporter: 1,
              supporterStatus: 1,
            },
          }
        );

        token.banned = appAccount?.banned === true;
        token.bannedAt = appAccount?.bannedAt || null;

        if (appAccount) {
          const hasUsername = appAccount.usernameConfirmed === true;
          const isSupporter =
            appAccount.supporter === true ||
            appAccount.isSupporter === true ||
            appAccount.supporterStatus === "active";

          token.username = hasUsername ? appAccount.username : null;
          token.needsUsername = !hasUsername;
          token.email = appAccount.email || token.email;
          token.supporter = isSupporter;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId;
      session.user.username = token.username || null;
      session.user.needsUsername = token.needsUsername !== false;
      session.user.name = token.username || null;
      session.user.email = token.email;
      session.user.provider = token.provider || null;
      session.user.providerUserId = token.providerUserId || null;
      session.user.banned = token.banned === true;
      session.user.bannedAt = token.bannedAt || null;
      session.user.supporter = token.supporter === true;

      return session;
    },
  },
};
