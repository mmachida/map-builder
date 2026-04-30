import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ assets: [] });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const assets = await db
      .collection("assets")
      .find({
        ownerEmail: session.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      assets: assets.map((asset) => ({
        ...asset,
        _id: asset._id.toString(),
        linkedGroupIds: asset.linkedGroupIds || [],
      })),
    });
  } catch (error) {
    console.error("ERRO GET /api/assets:", error);

    return Response.json(
      { error: "Erro ao buscar ícones." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "Você precisa estar logado." },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return Response.json({ error: "Nome obrigatório." }, { status: 400 });
    }

    if (!body.imageUrl) {
      return Response.json({ error: "Imagem obrigatória." }, { status: 400 });
    }

    const newAsset = {
      ownerEmail: session.user.email,
      ownerName: session.user.name,
      name: body.name.trim(),
      imageUrl: body.imageUrl,
      type: "pin_icon",
      linkedGroupIds: body.linkedGroupIds || [],
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection("assets").insertOne(newAsset);

    return Response.json({
      asset: {
        ...newAsset,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("ERRO POST /api/assets:", error);

    return Response.json(
      { error: "Erro ao criar ícone." },
      { status: 500 }
    );
  }
}