export async function GET(request) {
  const requestUrl = new URL(request.url);
  const callbackUrl = requestUrl.searchParams.get("callbackUrl") || "/";
  const returnTo = new URL("/api/auth/steam/callback", requestUrl.origin);

  returnTo.searchParams.set("callbackUrl", callbackUrl);

  const steamUrl = new URL("https://steamcommunity.com/openid/login");
  steamUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  steamUrl.searchParams.set("openid.mode", "checkid_setup");
  steamUrl.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select"
  );
  steamUrl.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select"
  );
  steamUrl.searchParams.set("openid.return_to", returnTo.toString());
  steamUrl.searchParams.set("openid.realm", requestUrl.origin);

  return Response.redirect(steamUrl.toString());
}
