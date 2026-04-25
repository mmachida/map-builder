import clientPromise from "@/lib/mongodb";

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const pins = await db
      .collection("pins")
      .find({ mapId: id })
      .sort({ createdAt: 1 })
      .toArray();

    const pinsFormatted = pins.map((pin) => ({
      ...pin,
      _id: pin._id.toString(),
    }));

    return Response.json({ pins: pinsFormatted });
  } catch (error) {
    console.error("ERRO GET PINS:", error);

    return Response.json(
      { error: "Erro ao buscar pins." },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const newPin = {
      mapId: id,
      name: body.name,
      description: body.description || "",
      icon: body.icon || "📍",
      x: body.x,
      y: body.y,
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("pins").insertOne(newPin);

    return Response.json({
      pin: {
        ...newPin,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST PINS:", error);

    return Response.json(
      { error: "Erro ao criar pin." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("pins").deleteMany({
      mapId: id,
    });

    return Response.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("ERRO DELETE ALL PINS:", error);

    return Response.json(
      { error: "Erro ao limpar pins." },
      { status: 500 }
    );
  }
}
