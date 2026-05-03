import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }
	
	function getIconKey(iconType, icon, iconImageUrl) {
	  if (iconType === "custom") {
		return `custom:${iconImageUrl}`;
	  }
	  return `emoji:${icon || "📍"}`;
	}

	const update = {
    name: body.name,
    typeName: body.typeName || body.name,
    description: body.description || "",
    icon: body.icon || "📍",
    iconType: body.iconType || "emoji",
    iconImageUrl: body.iconImageUrl || "",
    iconKey: getIconKey(
      body.iconType || "emoji",
      body.icon || "📍",
      body.iconImageUrl || ""
    ),

    category: body.category || "geral",

    // 🔥 posição (só atualiza se vier no body)
    ...(body.x !== undefined && { x: Number(body.x) }),
    ...(body.y !== undefined && { y: Number(body.y) }),

    updatedAt: new Date(),
  };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection("pins").updateOne(
      { _id: new ObjectId(id), ownerEmail: session.user.email },
      { $set: update }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH /api/pins/[id]:", error);

    return Response.json(
      { error: "Erro ao atualizar pin." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("pins").deleteOne({
      _id: new ObjectId(id),
      ownerEmail: session.user.email,
    });

    console.log("PIN DELETADO:", {
      id,
      deletedCount: result.deletedCount,
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE /api/pins/[id]:", error);

    return Response.json(
      { error: "Erro ao deletar pin." },
      { status: 500 }
    );
  }
}
