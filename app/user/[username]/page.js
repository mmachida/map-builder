"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import "../../page.css";

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

function safeExternalUrl(url) {
  const value = String(url || "").trim();

  if (/^https?:\/\//i.test(value)) return value;

  return `https://${value}`;
}

function formatPublicDate(value) {
  if (!value) return "Not informed";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Not informed";
  }
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params?.username || "";
  const [activeSection, setActiveSection] = useState("profile");
  const [profile, setProfile] = useState(null);
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/users/${encodeURIComponent(username)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Erro ao carregar perfil.");
        }

        setProfile(data.user || null);
        setMaps(data.maps || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Erro ao carregar perfil.");
          setProfile(null);
          setMaps([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    return () => controller.abort();
  }, [username]);

  function renderProfile() {
    if (!profile) return null;

    return (
      <>
        <h1>Perfil</h1>
        <p className="publicProfileIntro">
          Conheca mais sobre este usuario, suas informacoes publicas e os
          projetos que ele compartilha com a comunidade.
        </p>

        <section className="publicProfileSection">
          <div className="publicProfileNameRow">
            <span>Username</span>
            <strong
              className={profile.userGlow ? "glow" : ""}
              style={
                isValidHexColor(profile.userColor)
                  ? {
                      color: profile.userColor,
                      "--profile-user-color": profile.userColor,
                    }
                  : undefined
              }
            >
              {profile.username}
            </strong>
          </div>

          <div className="publicProfileMetaGrid">
            <div>
              <span>Country</span>
              <strong>{profile.country || "Not informed"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{profile.status}</strong>
            </div>
          </div>
        </section>

        <section className="publicProfileSection">
          <h2>Estatísticas</h2>
          <div className="publicProfileStatsGrid">
            <div>
              <span>Criado desde</span>
              <strong>{formatPublicDate(profile.createdAt)}</strong>
            </div>
            <div>
              <span>Mapas criados</span>
              <strong>{profile.stats?.createdMaps ?? 0}</strong>
            </div>
            <div>
              <span>Colaborações</span>
              <strong>{profile.stats?.collaboratorMaps ?? 0}</strong>
            </div>
            <div>
              <span>Pins customizados</span>
              <strong>{profile.stats?.customIcons ?? 0}</strong>
            </div>
            <div>
              <span>Pins colocados</span>
              <strong>{profile.stats?.pinsPlaced ?? 0}</strong>
            </div>
          </div>
        </section>

        <section className="publicProfileSection">
          <h2>Biografia</h2>
          {profile.profileTitle ? <h3>{profile.profileTitle}</h3> : null}
          <p>{profile.profileBio || "Este usuario ainda nao adicionou uma biografia."}</p>
        </section>

        <section className="publicProfileSection">
          <h2>Social Media</h2>
          {(profile.socialLinks || []).length ? (
            <div className="publicProfileSocialList">
              {profile.socialLinks.map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  href={safeExternalUrl(link.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.title}
                </a>
              ))}
            </div>
          ) : (
            <p>Nenhuma rede social cadastrada.</p>
          )}
        </section>
      </>
    );
  }

  function renderPublicMaps() {
    return (
      <>
        <div className="publicProfileHeaderRow">
          <div>
            <h1>Public Maps</h1>
            <p className="publicProfileIntro">
              Lista de mapas publicos criados por este usuario e disponiveis
              para a comunidade.
            </p>
          </div>
          <span className="quotaBadge">{maps.length} map(s)</span>
        </div>

        {maps.length === 0 ? (
          <section className="publicProfileSection">
            <p>Este usuario ainda nao possui mapas publicos.</p>
          </section>
        ) : (
          <div className="libraryMapGrid">
            {maps.map((map) => (
              <article
                className="libraryMapCard"
                key={map._id}
                style={
                  profile && isValidHexColor(profile.userCardColor)
                    ? { "--library-card-color": profile.userCardColor }
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
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />

      <section className="dashboardCard sitePageCard publicProfilePageCard">
        <aside className="settingsSidebar publicProfileSidebar">
          <div className="settingsNavGroup">
            <h2>User</h2>
            <button
              className={activeSection === "profile" ? "active" : ""}
              onClick={() => setActiveSection("profile")}
              type="button"
            >
              Perfil
            </button>
            <button
              className={activeSection === "maps" ? "active" : ""}
              onClick={() => setActiveSection("maps")}
              type="button"
            >
              Public Maps
            </button>
          </div>
        </aside>

        <div className="settingsContent publicProfileContent">
          {loading ? (
            <p>Carregando...</p>
          ) : error ? (
            <p>{error}</p>
          ) : activeSection === "profile" ? (
            renderProfile()
          ) : (
            renderPublicMaps()
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
