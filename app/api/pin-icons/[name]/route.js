import { DEFAULT_PIN_ICON_FILES } from "@/lib/constants/icons";

const PIN_ICON_FILES = new Set(DEFAULT_PIN_ICON_FILES);
const PIN_ICON_REDIRECT_PATH = process.env.NEXT_PUBLIC_PIN_ICON_PATH || "/pin-icons";

export async function GET(request, context) {
  const { name } = await context.params;
  const fileName = String(name || "");

  if (!PIN_ICON_FILES.has(fileName)) {
    return new Response("Icon not found", { status: 404 });
  }

  return Response.redirect(
    new URL(`${PIN_ICON_REDIRECT_PATH}/${fileName}`, request.url),
    308
  );
}
