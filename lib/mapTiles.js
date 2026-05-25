import sharp from "sharp";
import r2 from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const TILE_SIZE = 512;
const MAX_TILE_ZOOM = 5;

function getPublicUrl(key) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function generateMapTiles({ buffer, baseKey }) {
  const image = sharp(buffer, { limitInputPixels: false });
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) return null;

  const maxDimension = Math.max(width, height);
  const maxZoom = Math.min(
    MAX_TILE_ZOOM,
    Math.max(0, Math.ceil(Math.log2(maxDimension / TILE_SIZE)))
  );
  const levels = [];

  for (let zoom = 0; zoom <= maxZoom; zoom += 1) {
    const scale = 2 ** (zoom - maxZoom);
    const levelWidth = Math.max(1, Math.round(width * scale));
    const levelHeight = Math.max(1, Math.round(height * scale));
    const columns = Math.ceil(levelWidth / TILE_SIZE);
    const rows = Math.ceil(levelHeight / TILE_SIZE);
    const levelBuffer = await sharp(buffer, { limitInputPixels: false })
      .resize(levelWidth, levelHeight)
      .webp({ quality: 82 })
      .toBuffer();

    const uploads = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const tileWidth = Math.min(TILE_SIZE, levelWidth - left);
        const tileHeight = Math.min(TILE_SIZE, levelHeight - top);
        const key = `${baseKey}/tiles/z${zoom}/${x}-${y}.webp`;

        uploads.push(
          sharp(levelBuffer)
            .extract({ left, top, width: tileWidth, height: tileHeight })
            .webp({ quality: 82 })
            .toBuffer()
            .then((tileBuffer) =>
              r2.send(
                new PutObjectCommand({
                  Bucket: process.env.R2_BUCKET,
                  Key: key,
                  Body: tileBuffer,
                  ContentType: "image/webp",
                })
              )
            )
        );
      }
    }

    await Promise.all(uploads);

    levels.push({
      zoom,
      width: levelWidth,
      height: levelHeight,
      columns,
      rows,
      tileSize: TILE_SIZE,
      urlTemplate: getPublicUrl(`${baseKey}/tiles/z${zoom}/{x}-{y}.webp`),
    });
  }

  return {
    type: "tiles",
    width,
    height,
    tileSize: TILE_SIZE,
    maxZoom,
    levels,
  };
}
