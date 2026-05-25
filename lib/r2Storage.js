import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import r2 from "@/lib/r2";

function getPublicUrlPrefix() {
  return String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function getR2KeyFromUrl(url) {
  if (!url || typeof url !== "string") return null;

  const publicUrlPrefix = getPublicUrlPrefix();

  if (publicUrlPrefix && url.startsWith(`${publicUrlPrefix}/`)) {
    return decodeURIComponent(url.slice(publicUrlPrefix.length + 1));
  }

  try {
    const parsedUrl = new URL(url);
    return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function getTileKeysFromMap(map) {
  if (!map?.tileData?.levels?.length) return [];

  const keys = [];

  map.tileData.levels.forEach((level) => {
    const columns = Number(level.columns) || 0;
    const rows = Number(level.rows) || 0;
    const urlTemplate = level.urlTemplate || "";

    if (!columns || !rows || !urlTemplate.includes("{x}") || !urlTemplate.includes("{y}")) {
      return;
    }

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const key = getR2KeyFromUrl(
          urlTemplate.replace("{x}", String(x)).replace("{y}", String(y))
        );

        if (key) keys.push(key);
      }
    }
  });

  return keys;
}

export function getMapStorageKeys(map) {
  return Array.from(
    new Set([getR2KeyFromUrl(map?.imageUrl), ...getTileKeysFromMap(map)].filter(Boolean))
  );
}

export async function deleteR2Keys(keys) {
  const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean)));

  if (!process.env.R2_BUCKET || uniqueKeys.length === 0) return;

  for (let index = 0; index < uniqueKeys.length; index += 1000) {
    const chunk = uniqueKeys.slice(index, index + 1000);

    if (chunk.length === 1) {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: chunk[0],
        })
      );
      continue;
    }

    await r2.send(
      new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }
}

export async function deleteMapStorage(map) {
  await deleteR2Keys(getMapStorageKeys(map));
}

export async function deleteAssetStorage(asset) {
  await deleteR2Keys([getR2KeyFromUrl(asset?.imageUrl)]);
}
