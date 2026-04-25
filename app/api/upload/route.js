export const runtime = "nodejs";

import r2 from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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

    if (!file) {
      return Response.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    console.log("ARQUIVO RECEBIDO:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    const safeName = file.name.replaceAll(" ", "-").replace(/[^\w.-]/g, "");
    const fileName = `${Date.now()}-${safeName}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    console.log("UPLOAD OK:", url);

    return Response.json({ url });
  } catch (error) {
    console.error("ERRO REAL DO UPLOAD:", error);

    return Response.json(
      { error: error.message || "Erro ao fazer upload." },
      { status: 500 }
    );
  }
}
