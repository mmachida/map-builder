import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { stripPrivateAccountFields } from "@/lib/publicData";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invalido." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const currentMap = await db.collection("maps").findOne({
      _id: new ObjectId(id),
    });

    if (!currentMap) {
      return Response.json(
        { error: "Mapa nao encontrado." },
        { status: 404 }
      );
    }

    const portalPins = await db
      .collection("pins")
      .find({
        mapId: id,
        destinationMapId: { $type: "string", $ne: "" },
        $or: [
          { systemType: "portal" },
          { category: "system", typeName: "Portal" },
        ],
      })
      .toArray();

    const destinationIds = [
      ...new Set(
        portalPins
          .map((pin) => pin.destinationMapId)
          .filter((destinationId) => ObjectId.isValid(destinationId))
      ),
    ];

    if (destinationIds.length === 0) {
      return Response.json({ maps: [] });
    }

    const maps = await db
      .collection("maps")
      .find({
        _id: { $in: destinationIds.map((destinationId) => new ObjectId(destinationId)) },
        groupId: currentMap.groupId || "",
      })
      .sort({ title: 1, createdAt: 1 })
      .toArray();

    return Response.json({
      maps: maps.map((map) => ({
        ...stripPrivateAccountFields(map),
        _id: map._id.toString(),
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/maps/[id]/connected:", error);

    return Response.json(
      { error: "Erro ao buscar mapas conectados." },
      { status: 500 }
    );
  }
}
