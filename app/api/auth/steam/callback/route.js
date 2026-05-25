import { randomUUID } from "crypto";
import clientPromise from "@/lib/mongodb";

function getSteamId(claimedId) {
  const match = String(claimedId || "").match(/\/id\/(\d+)$/);
  return match?.[1] || null;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const callbackUrl = requestUrl.searchParams.get("callbackUrl") || "/";
  const callbackTarget = new URL("/auth/steam", requestUrl.origin);

  try {
    const claimedId = requestUrl.searchParams.get("openid.claimed_id");
    const steamId = getSteamId(claimedId);

    if (!steamId) {
      callbackTarget.searchParams.set("error", "invalid_steam_id");
      callbackTarget.searchParams.set("callbackUrl", callbackUrl);
      return Response.redirect(callbackTarget.toString());
    }

    const verificationParams = new URLSearchParams();

    requestUrl.searchParams.forEach((value, key) => {
      if (key.startsWith("openid.")) {
        verificationParams.set(key, value);
      }
    });

    verificationParams.set("openid.mode", "check_authentication");

    const verificationResponse = await fetch(
      "https://steamcommunity.com/openid/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: verificationParams.toString(),
      }
    );

    const verificationText = await verificationResponse.text();

    if (!verificationText.includes("is_valid:true")) {
      callbackTarget.searchParams.set("error", "steam_validation_failed");
      callbackTarget.searchParams.set("callbackUrl", callbackUrl);
      return Response.redirect(callbackTarget.toString());
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const tickets = db.collection("steamLoginTickets");
    const ticket = randomUUID();

    await tickets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await tickets.insertOne({
      ticket,
      steamId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    callbackTarget.searchParams.set("ticket", ticket);
    callbackTarget.searchParams.set("callbackUrl", callbackUrl);

    return Response.redirect(callbackTarget.toString());
  } catch (error) {
    console.error("ERRO STEAM CALLBACK:", error);

    callbackTarget.searchParams.set("error", "steam_login_failed");
    callbackTarget.searchParams.set("callbackUrl", callbackUrl);

    return Response.redirect(callbackTarget.toString());
  }
}
