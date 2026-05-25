import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getMapAccessById } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ maps: [] });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const { map, access } = await getMapAccessById(db, id, session);

    if (!map || !access.canEditPins) {
      return Response.json(
        { error: "Mapa nao encontrado ou sem permissao." },
        { status: 403 }
      );
    }

    if (!map.groupId) {
      return Response.json({ maps: [] });
    }

    const maps = await db
      .collection("maps")
      .find({ groupId: map.groupId })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      maps: maps.map((destinationMap) => ({
        ...stripPrivateAccountFields(destinationMap),
        _id: destinationMap._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/maps/[id]/destinations:", error);

    return Response.json(
      { error: "Erro ao buscar mapas de destino." },
      { status: 500 }
    );
  }
}
