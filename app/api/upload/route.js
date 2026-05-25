export const runtime = "nodejs";

import r2 from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateMapTiles } from "@/lib/mapTiles";
import sharp from "sharp";

const MAP_UPLOAD_TYPES = new Set(["image/png", "image/jpeg"]);
const ICON_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const JPG_EXTENSIONS = new Set(["jpg", "jpeg"]);

function getExtension(fileName) {
  return String(fileName || "").split(".").pop()?.toLowerCase() || "";
}

function isAllowedMapFile(file) {
  const extension = getExtension(file.name);

  return (
    MAP_UPLOAD_TYPES.has(file.type) &&
    (extension === "png" || JPG_EXTENSIONS.has(extension))
  );
}

function isAllowedIconFile(file) {
  const extension = getExtension(file.name);

  return (
    ICON_UPLOAD_TYPES.has(file.type) &&
    (extension === "png" || JPG_EXTENSIONS.has(extension) || extension === "svg")
  );
}

async function validateIconDimensions(buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    return {
      ok: false,
      error: "Nao foi possivel identificar o tamanho do icone.",
    };
  }

  if (width > 128 || height > 128) {
    return {
      ok: false,
      error: "Icones customizados devem ter no maximo 128x128 pixels.",
    };
  }

  return { ok: true };
}

export async function POST(request) {
  try {
    console.log("UPLOAD ENV CHECK:", {
      hasAccountId: Boolean(process.env.R2_ACCOUNT_ID),
      hasAccessKey: Boolean(process.env.R2_ACCESS_KEY_ID),
      hasSecret: Boolean(process.env.R2_SECRET_ACCESS_KEY),
      bucket: process.env.R2_BUCKET,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    const purpose = formData.get("purpose");

    if (purpose === "map" && file && !isAllowedMapFile(file)) {
      return Response.json(
        { error: "Mapas aceitam apenas arquivos .png, .jpg ou .jpeg." },
        { status: 400 }
      );
    }

    if (purpose === "icon" && file && !isAllowedIconFile(file)) {
      return Response.json(
        { error: "Icones customizados aceitam apenas arquivos .png, .jpg, .jpeg ou .svg." },
        { status: 400 }
      );
    }

    if (!file) {
      return Response.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    console.log("ARQUIVO RECEBIDO:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    if (purpose === "icon") {
      const dimensions = await validateIconDimensions(buffer);

      if (!dimensions.ok) {
        return Response.json({ error: dimensions.error }, { status: 400 });
      }
    }

    const safeName = file.name.replaceAll(" ", "-").replace(/[^\w.-]/g, "");
    const uploadId = `${Date.now()}-${safeName}`;
    const fileName = uploadId;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    const tileData =
      purpose === "map" && file.type.startsWith("image/")
        ? await generateMapTiles({
            buffer,
            baseKey: `maps/${uploadId}`,
          })
        : null;

    console.log("UPLOAD OK:", url);

    return Response.json({ url, tileData });
  } catch (error) {
    console.error("ERRO REAL DO UPLOAD:", error);

    return Response.json(
      { error: error.message || "Erro ao fazer upload." },
      { status: 500 }
    );
  }
}
