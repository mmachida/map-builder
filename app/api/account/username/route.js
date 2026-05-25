import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setAccountUsername, normalizeUsername } from "@/lib/accounts";

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
    const username = String(body.username || "").trim();

    if (username !== normalizeUsername(username)) {
      return Response.json(
        { error: "Use apenas a-z e 0-9." },
        { status: 400 }
      );
    }

    const result = await setAccountUsername({
      userId: session.user.userId,
      username,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ username: result.username });
  } catch (error) {
    console.error("ERRO PATCH /api/account/username:", error);

    return Response.json(
      { error: "Erro ao salvar username." },
      { status: 500 }
    );
  }
}
