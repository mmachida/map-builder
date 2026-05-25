import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const USERNAME_MAX_LENGTH = 15;

export function normalizeUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function ensureAccountIndexes(accounts) {
  const indexes = await accounts.indexes();
  const usernameIndex = indexes.find((index) => index.name === "username_1");
  const uniqueEmailIndexes = indexes.filter(
    (index) =>
      index.unique &&
      Object.prototype.hasOwnProperty.call(index.key || {}, "email")
  );

  if (usernameIndex && !usernameIndex.partialFilterExpression) {
    await accounts.dropIndex("username_1");
  }

  for (const index of uniqueEmailIndexes) {
    await accounts.dropIndex(index.name);
  }

  await Promise.all([
    accounts.createIndex({ user_id: 1 }, { unique: true }),
    accounts.createIndex(
      { username: 1 },
      {
        unique: true,
        partialFilterExpression: { username: { $type: "string" } },
      }
    ),
    accounts.createIndex(
      { provider: 1, provider_user_id: 1 },
      { unique: true }
    ),
  ]);
}

export function validateUsername(value) {
  const username = normalizeUsername(value);

  if (!username) {
    return { ok: false, error: "Username obrigatorio." };
  }

  if (username !== value) {
    return { ok: false, error: "Use apenas a-z e 0-9." };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: "Username deve ter ate 15 caracteres." };
  }

  return { ok: true, username };
}

export async function ensureAccount({ provider, providerUserId, email, name }) {
  if (!provider || !providerUserId) {
    return null;
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const accounts = db.collection("accounts");

  await ensureAccountIndexes(accounts);

  const existing = await accounts.findOne({
    provider,
    provider_user_id: String(providerUserId),
  });

  if (existing) {
    await accounts.updateOne(
      { _id: existing._id },
      {
        $set: {
          email: email || existing.email || "",
          updatedAt: new Date(),
        },
      }
    );

    return {
      ...existing,
      email: email || existing.email || "",
    };
  }

  const account = {
    user_id: new ObjectId().toString(),
    username: null,
    usernameConfirmed: false,
    provider,
    provider_user_id: String(providerUserId),
    email: email || "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await accounts.insertOne(account);

  return account;
}

export async function setAccountUsername({ userId, username }) {
  const validation = validateUsername(username);

  if (!validation.ok) {
    return validation;
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const accounts = db.collection("accounts");

  await ensureAccountIndexes(accounts);

  const existing = await accounts.findOne({
    username: validation.username,
    user_id: { $ne: userId },
  });

  if (existing) {
    return { ok: false, error: "Username ja esta em uso." };
  }

  const result = await accounts.updateOne(
    { user_id: userId },
    {
      $set: {
        username: validation.username,
        usernameConfirmed: true,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    return { ok: false, error: "Conta nao encontrada." };
  }

  return { ok: true, username: validation.username };
}
