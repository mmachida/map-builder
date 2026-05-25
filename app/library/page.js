"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import "../page.css";

function getTileUrl(template, x, y) {
  return template.replace("{x}", x).replace("{y}", y);
}

function getMapPreviewUrl(map) {
  const firstLevel = map?.tileData?.levels?.[0];

  if (!firstLevel?.urlTemplate) return map?.imageUrl || "";

  const x = Math.max(0, Math.floor((firstLevel.columns || 1) / 2));
  const y = Math.max(0, Math.floor((firstLevel.rows || 1) / 2));

  return getTileUrl(firstLevel.urlTemplate, x, y);
}

function isValidHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || ""));
}

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [maps, setMaps] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function handleQueryChange(event) {
    setQuery(event.target.value);
    setPage(1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/library?q=${encodeURIComponent(query.trim())}&page=${page}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Erro ao buscar mapas.");
          setMaps([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }

        setMaps(data.maps || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.page && data.page !== page) {
          setPage(data.page);
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("Erro ao buscar mapas.");
          setMaps([]);
          setTotal(0);
          setTotalPages(1);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, page]);

  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard libraryHero">
        <h1>Library</h1>
        <p>
          Discover public game maps from the community. Search by map name or
          tags.
        </p>

        <div className="librarySearchBox">
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Search maps or tags..."
          />
        </div>
      </section>

      <section className="dashboardCard libraryResultsSection">
        <div className="dashboardSectionHeader">
          <div>
            <h2>Public maps</h2>
            <p>Only maps marked as Public are listed here.</p>
          </div>
          <span className="quotaBadge">{total} result(s)</span>
        </div>

        {loading ? (
          <p className="emptyText">Carregando...</p>
        ) : error ? (
          <p className="emptyText">{error}</p>
        ) : maps.length === 0 ? (
          <p className="emptyText">Nenhum mapa público encontrado.</p>
        ) : (
          <>
            <div className="libraryMapGrid">
              {maps.map((map) => (
                <article
                  className="libraryMapCard"
                  key={map._id}
                  style={
                    isValidHexColor(map.ownerCardColor)
                      ? { "--library-card-color": map.ownerCardColor }
                      : undefined
                  }
                >
                  <Link href={`/map/${map._id}`} className="libraryMapPreview">
                    {getMapPreviewUrl(map) ? (
                      <img src={getMapPreviewUrl(map)} alt={map.title} />
                    ) : (
                      <span>No preview</span>
                    )}
                  </Link>

                  <div className="libraryMapInfo">
                    <h3>{map.title}</h3>
                    <p>{map.description || "No description."}</p>

                    {map.tags.length > 0 && (
                      <div className="libraryTagList">
                        {map.tags.slice(0, 6).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="libraryMapFooter">
                      <div className="mapCardActions">
                        <Link href={`/map/${map._id}`}>Open map</Link>
                      </div>

                      <Link
                        href={`/user/${map.ownerUsername || map.ownerName || "user"}`}
                        className={
                          map.ownerUserGlow
                            ? "libraryMapCreator glow"
                            : "libraryMapCreator"
                        }
                        style={
                          isValidHexColor(map.ownerUserColor)
                            ? {
                                color: map.ownerUserColor,
                                "--creator-color": map.ownerUserColor,
                              }
                            : undefined
                        }
                      >
                        {map.ownerUsername || map.ownerName || "user"}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="libraryPagination" aria-label="Library pages">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className={pageNumber === page ? "active" : ""}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  )
                )}
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
