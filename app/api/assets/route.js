import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { getOwnerQuery } from "@/lib/ownership";
import { stripPrivateAccountFields } from "@/lib/publicData";
import { getAccountLimits } from "@/lib/accountLimits";

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
      .find(getOwnerQuery(session))
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      assets: assets.map((asset) => ({
        ...stripPrivateAccountFields(asset),
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
    const assetName = body.name?.trim();

    if (!assetName) {
      return Response.json({ error: "Nome obrigatório." }, { status: 400 });
    }

    if (!body.imageUrl) {
      return Response.json({ error: "Imagem obrigatória." }, { status: 400 });
    }

    const newAsset = {
      ownerUserId: session.user.userId,
      ownerUsername: session.user.username || "USER",
      ownerEmail: session.user.email,
      ownerName: session.user.username || "USER",
      name: assetName,
      imageUrl: body.imageUrl,
      type: "pin_icon",
      linkedGroupIds: body.linkedGroupIds || [],
      createdAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const [assetCount, account] = await Promise.all([
      db.collection("assets").countDocuments(getOwnerQuery(session)),
      db.collection("accounts").findOne({ user_id: session.user.userId }),
    ]);
    const accountLimits = getAccountLimits(account);

    if (assetCount >= accountLimits.customIcons) {
      return Response.json(
        {
          error: `Limite de icones personalizados atingido (${assetCount}/${accountLimits.customIcons}).`,
        },
        { status: 403 }
      );
    }

    const existingAsset = await db.collection("assets").findOne({
      ...getOwnerQuery(session),
      name: { $regex: `^${escapeRegExp(assetName)}$`, $options: "i" },
    });

    if (existingAsset) {
      return Response.json(
        { error: "Ja existe um icone customizado com esse nome." },
        { status: 400 }
      );
    }

    const result = await db.collection("assets").insertOne(newAsset);

    return Response.json({
      asset: {
        ...stripPrivateAccountFields(newAsset),
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
