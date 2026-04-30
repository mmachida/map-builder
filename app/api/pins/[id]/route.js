import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
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
	  updatedAt: new Date(),
	};

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    await db.collection("pins").updateOne(
      { _id: new ObjectId(id) },
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

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("pins").deleteOne({
      _id: new ObjectId(id),
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