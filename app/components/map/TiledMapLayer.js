"use client";

import { useEffect, useRef, useState } from "react";

function getTileUrl(template, x, y) {
  return template.replace("{x}", x).replace("{y}", y);
}

function getLevelTileCount(level) {
  return Math.max(0, Number(level?.columns || 0) * Number(level?.rows || 0));
}

function TileLevel({ level, levelIndex, onTileLoaded, className }) {
  const rows = Array.from({ length: level.rows }, (_, y) => y);
  const columns = Array.from({ length: level.columns }, (_, x) => x);

  return (
    <div className={className}>
      {rows.flatMap((y) =>
        columns.map((x) => {
          const tileWidth = Math.min(level.tileSize, level.width - x * level.tileSize);
          const tileHeight = Math.min(level.tileSize, level.height - y * level.tileSize);

          return (
            <img
              key={`${level.zoom}-${x}-${y}`}
              src={getTileUrl(level.urlTemplate, x, y)}
              alt=""
              className="mapTile"
              draggable="false"
              loading="lazy"
              decoding="async"
              onLoad={() => onTileLoaded(levelIndex, x, y)}
              onError={() => onTileLoaded(levelIndex, x, y)}
              style={{
                left: `${((x * level.tileSize) / level.width) * 100}%`,
                top: `${((y * level.tileSize) / level.height) * 100}%`,
                width: `${(tileWidth / level.width) * 100}%`,
                height: `${(tileHeight / level.height) * 100}%`,
              }}
            />
          );
        })
      )}
    </div>
  );
}

function TiledMapLayerContent({ tileData, scale, onLoad }) {
  const notifiedLoadRef = useRef(false);
  const loadedTileKeysRef = useRef(new Set());
  const levels = tileData.levels;
  const [loadedLevelIndexes, setLoadedLevelIndexes] = useState([]);
  const requestedLevelIndex = Math.min(
    levels.length - 1,
    Math.max(0, Math.round(Math.log2(Math.max(1, scale))))
  );
  const fallbackLevelIndex =
    [...loadedLevelIndexes].sort(
      (a, b) => Math.abs(requestedLevelIndex - a) - Math.abs(requestedLevelIndex - b)
    )[0] ?? 0;
  const backgroundLevelIndex = levels[fallbackLevelIndex] ? fallbackLevelIndex : 0;
  const shouldRenderRequestedLevel = requestedLevelIndex !== backgroundLevelIndex;

  useEffect(() => {
    if (!notifiedLoadRef.current) {
      notifiedLoadRef.current = true;
      onLoad?.();
    }
  }, [onLoad]);

  function handleTileLoaded(levelIndex, x, y) {
    const level = levels[levelIndex];
    if (!level) return;

    const tileKey = `${levelIndex}:${x}:${y}`;
    if (loadedTileKeysRef.current.has(tileKey)) return;

    loadedTileKeysRef.current.add(tileKey);

    const loadedCount = Array.from(loadedTileKeysRef.current).filter((key) =>
      key.startsWith(`${levelIndex}:`)
    ).length;

    if (loadedCount >= getLevelTileCount(level)) {
      setLoadedLevelIndexes((currentIndexes) =>
        currentIndexes.includes(levelIndex)
          ? currentIndexes
          : [...currentIndexes, levelIndex]
      );
    }
  }

  return (
    <div
      className="tiledMapLayer"
      style={{
        aspectRatio: `${tileData.width} / ${tileData.height}`,
      }}
    >
      <TileLevel
        level={levels[backgroundLevelIndex]}
        levelIndex={backgroundLevelIndex}
        onTileLoaded={handleTileLoaded}
        className="mapTileLayer mapTileLayerBase"
      />

      {shouldRenderRequestedLevel && (
        <TileLevel
          level={levels[requestedLevelIndex]}
          levelIndex={requestedLevelIndex}
          onTileLoaded={handleTileLoaded}
          className="mapTileLayer mapTileLayerLoading"
        />
      )}
    </div>
  );
}

export default function TiledMapLayer({ map, scale = 1, onLoad }) {
  const tileData = map?.tileData;

  if (!tileData?.levels?.length) {
    return (
      <img
        src={map.imageUrl}
        alt={map.title}
        className="mapImage"
        draggable="false"
        onLoad={onLoad}
      />
    );
  }

  return (
    <TiledMapLayerContent
      key={`${map?._id || map?.imageUrl || "map"}:${tileData.width}x${tileData.height}`}
      tileData={tileData}
      scale={scale}
      onLoad={onLoad}
    />
  );
}
