const SITE_ICON_FILES = {
  banner_discord: "banner_discord.png",
  banner_facebook: "banner_facebook.png",
  banner_google: "banner_google.png",
  banner_microsoft: "banner_microsoft.png",
  banner_steam: "banner_steam.png",
  book_settings: "book_settings.svg",
  cog_settings: "cog_settings.svg",
  cog_settings_2: "cog_settings_2.svg",
  flag_br: "flag_br.svg",
  flag_es: "flag_es.svg",
  flag_us: "flag_us.svg",
  leave_settings: "leave_settings.svg",
  map_connected: "map_connected.svg",
  map_connected_icon: "map_connected_icon.svg",
  site_logo: "site-logo.svg",
};
const SITE_ICON_REDIRECT_PATH =
  process.env.NEXT_PUBLIC_SITE_ICON_PATH || "/site-icons";

export async function GET(request, context) {
  const { name } = await context.params;
  const fileName = SITE_ICON_FILES[name];

  if (!fileName) {
    return new Response("Icon not found", { status: 404 });
  }

  return Response.redirect(
    new URL(`${SITE_ICON_REDIRECT_PATH}/${fileName}`, request.url),
    308
  );
}
