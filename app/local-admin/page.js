"use client";

import { useEffect, useMemo, useState } from "react";
import "../page.css";

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function isSupporterUser(user) {
  return (
    user?.supporter === true ||
    user?.isSupporter === true ||
    user?.supporterStatus === "active"
  );
}

export default function LocalAdminPage() {
  const [summary, setSummary] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [mapsData, setMapsData] = useState(null);
  const [selectedUserData, setSelectedUserData] = useState(null);
  const [selectedGroupData, setSelectedGroupData] = useState(null);
  const [page, setPage] = useState(1);
  const [mapsPage, setMapsPage] = useState(1);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [renameUsername, setRenameUsername] = useState("");

  const selectedUser = selectedUserData?.user || null;

  const statCards = useMemo(
    () => [
      ["Usuarios", summary?.users ?? "-"],
      ["Mapas", summary?.maps ?? "-"],
      ["Pins", summary?.pins ?? "-"],
      ["Rotas", summary?.routes ?? "-"],
      ["Notas", summary?.notes ?? "-"],
      ["Grupos", summary?.groups ?? "-"],
      ["Icones", summary?.assets ?? "-"],
    ],
    [summary]
  );

  async function loadJson(path, options) {
    setError("");
    const response = await fetch(path, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao carregar dados.");
    }

    return data;
  }

  async function loadSummary() {
    try {
      const data = await loadJson("/api/local-admin?view=summary");
      setSummary(data.summary);
    } catch (caughtError) {
      setError(caughtError.message);
    }
  }

  async function loadUsers(nextPage = page) {
    setLoading(true);
    setActiveSection("users");

    try {
      const data = await loadJson(`/api/local-admin?view=users&page=${nextPage}`);
      setUsersData(data);
      setPage(nextPage);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMaps(nextPage = mapsPage) {
    setLoading(true);
    setActiveSection("maps");

    try {
      const data = await loadJson(`/api/local-admin?view=maps&page=${nextPage}`);
      setMapsData(data);
      setMapsPage(nextPage);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openUser(userId) {
    setLoading(true);
    setSelectedGroupData(null);

    try {
      const data = await loadJson(
        `/api/local-admin?view=user&userId=${encodeURIComponent(userId)}`
      );
      setSelectedUserData(data);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openGroup(group) {
    setLoading(true);

    try {
      const data = await loadJson(
        `/api/local-admin?view=group&groupId=${encodeURIComponent(group._id)}`
      );
      setSelectedGroupData({
        group,
        maps: data.maps || [],
      });
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  function requestDelete(type, id, label) {
    setPendingDelete({ type, id, label });
  }

  function requestRename(user) {
    setPendingRename(user);
    setRenameUsername(user.username || "");
  }

  async function toggleBanUser(user) {
    const action = user.banned ? "unbanUser" : "banUser";
    const confirmed = window.confirm(
      user.banned
        ? `Desbanir ${user.username || user.user_id}?`
        : `Banir ${user.username || user.user_id}? Todos os mapas deste usuario ficarao privados.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      await loadJson("/api/local-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action,
          userId: user.user_id,
        }),
      });

      await loadUsers(page);

      if (selectedUser?.user_id === user.user_id) {
        await openUser(user.user_id);
      }

      if (mapsData) {
        await loadMaps(mapsPage);
      }
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSupporterUser(user) {
    const isSupporter = isSupporterUser(user);
    const action = isSupporter ? "setFreeAccount" : "setSupporter";
    const confirmed = window.confirm(
      isSupporter
        ? `Alterar ${user.username || user.user_id} para Free account?`
        : `Alterar ${user.username || user.user_id} para Supporter?`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      await loadJson("/api/local-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action,
          userId: user.user_id,
        }),
      });

      await loadUsers(page);

      if (selectedUser?.user_id === user.user_id) {
        await openUser(user.user_id);
      }
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmRenameUser(event) {
    event.preventDefault();

    if (!pendingRename) return;

    setLoading(true);

    try {
      await loadJson("/api/local-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "renameUser",
          userId: pendingRename.user_id,
          username: renameUsername,
        }),
      });

      setPendingRename(null);
      setRenameUsername("");
      await loadUsers(page);

      if (selectedUser?.user_id === pendingRename.user_id) {
        await openUser(pendingRename.user_id);
      }

    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteContent() {
    if (!pendingDelete) return;

    setLoading(true);

    try {
      await loadJson("/api/local-admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pendingDelete.type,
          id: pendingDelete.id,
        }),
      });

      setPendingDelete(null);
      await loadSummary();

      if (pendingDelete.type === "asset" && selectedUser?.user_id) {
        await openUser(selectedUser.user_id);
      }

      if (pendingDelete.type === "group" && selectedUser?.user_id) {
        setSelectedGroupData(null);
        await openUser(selectedUser.user_id);
      }

      if (pendingDelete.type === "map" && selectedGroupData?.group) {
        await openGroup(selectedGroupData.group);
      }

      if (pendingDelete.type === "map" && mapsData) {
        await loadMaps(mapsPage);
      }
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <main className="localAdminPage">
      <aside className="localAdminSidebar">
        <h1>Local Admin</h1>
        <button
          className={activeSection === "dashboard" ? "active" : ""}
          onClick={() => setActiveSection("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={activeSection === "users" ? "active" : ""}
          onClick={() => loadUsers(1)}
        >
          Usuarios
        </button>
        <button
          className={activeSection === "maps" ? "active" : ""}
          onClick={() => loadMaps(1)}
        >
          Mapas
        </button>
      </aside>

      <section className="localAdminContent">
        <header className="localAdminHeader">
          <div>
            <span>Local database viewer</span>
            <h2>
              {activeSection === "users"
                ? "Usuarios"
                : activeSection === "maps"
                  ? "Mapas"
                  : "Dashboard"}
            </h2>
          </div>
          <button onClick={loadSummary}>Atualizar resumo</button>
        </header>

        {error && <div className="localAdminError">{error}</div>}
        {loading && <div className="localAdminLoading">Carregando...</div>}

        {activeSection === "dashboard" && (
          <div className="localAdminStats">
            {statCards.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        )}

        {activeSection === "users" && (
          <div className="localAdminGrid">
            <section className="localAdminPanel">
              <div className="localAdminPanelHeader">
                <h3>Usuarios</h3>
                <span>
                  {usersData
                    ? `${usersData.total} total | pagina ${usersData.page}/${usersData.totalPages}`
                    : "Clique para carregar"}
                </span>
              </div>

              {!usersData ? (
                <p className="localAdminEmpty">Clique em Usuarios para listar.</p>
              ) : (
                <>
                  <div className="localAdminUserList">
                    {usersData.users.map((user) => (
                      <div className="localAdminUserRow" key={user.user_id}>
                        <button
                          className={
                            selectedUser?.user_id === user.user_id ? "active" : ""
                          }
                          onClick={() => openUser(user.user_id)}
                        >
                          <strong>{user.username || "sem username"}</strong>
                          <span>
                            {user.provider}
                            {user.banned ? " | banido" : ""}
                            {isSupporterUser(user) ? " | supporter" : " | free"}
                          </span>
                          <small>{user.email || user.user_id}</small>
                        </button>
                        <div className="localAdminUserActions">
                          <button
                            className="localAdminRenameButton"
                            onClick={() => requestRename(user)}
                          >
                            Renomear
                          </button>
                          <button
                            className={
                              isSupporterUser(user)
                                ? "localAdminSupporterButton active"
                                : "localAdminSupporterButton"
                            }
                            onClick={() => toggleSupporterUser(user)}
                          >
                            {isSupporterUser(user) ? "Supporter" : "Free"}
                          </button>
                          <button
                            className={
                              user.banned
                                ? "localAdminUnbanButton"
                                : "localAdminDeleteButton"
                            }
                            onClick={() => toggleBanUser(user)}
                          >
                            {user.banned ? "Desbanir" : "Banir"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="localAdminPagination">
                    <button
                      disabled={page <= 1}
                      onClick={() => loadUsers(page - 1)}
                    >
                      Anterior
                    </button>
                    <button
                      disabled={!usersData || page >= usersData.totalPages}
                      onClick={() => loadUsers(page + 1)}
                    >
                      Proxima
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="localAdminPanel">
              {!selectedUserData ? (
                <p className="localAdminEmpty">Selecione um usuario.</p>
              ) : (
                <>
                  <div className="localAdminPanelHeader">
                    <div>
                      <h3>{selectedUser.username || "sem username"}</h3>
                      <span>
                        {selectedUser.provider} | criado em{" "}
                        {formatDate(selectedUser.createdAt)}
                        {selectedUser.banned
                          ? ` | banido em ${formatDate(selectedUser.bannedAt)}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="localAdminMiniStats">
                    <span>Grupos: {selectedUserData.counts.groups}</span>
                    <span>Mapas: {selectedUserData.counts.maps}</span>
                    <span>Pins: {selectedUserData.counts.pins}</span>
                    <span>Icones: {selectedUserData.counts.assets}</span>
                  </div>

                  <h4>Icones customizados</h4>
                  <div className="localAdminAssetList">
                    {selectedUserData.assets.length === 0 ? (
                      <p className="localAdminEmpty">Nenhum icone.</p>
                    ) : (
                      selectedUserData.assets.map((asset) => (
                        <div key={asset._id}>
                          {asset.imageUrl ? (
                            <img src={asset.imageUrl} alt={asset.name} />
                          ) : (
                            <span />
                          )}
                          <strong>{asset.name}</strong>
                          <small>
                            Vinculado a {(asset.linkedGroupIds || []).length} grupo(s)
                          </small>
                          <button
                            className="localAdminDeleteButton"
                            onClick={() =>
                              requestDelete(
                                "asset",
                                asset._id,
                                `icone "${asset.name || "sem nome"}"`
                              )
                            }
                          >
                            Deletar
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <h4>Grupos</h4>
                  <div className="localAdminGroupList">
                    {selectedUserData.groups.length === 0 ? (
                      <p className="localAdminEmpty">Nenhum grupo.</p>
                    ) : (
                      selectedUserData.groups.map((group) => (
                        <div className="localAdminGroupRow" key={group._id}>
                          <button onClick={() => openGroup(group)}>
                            <strong>{group.name}</strong>
                            <small>{formatDate(group.createdAt)}</small>
                          </button>
                          <button
                            className="localAdminDeleteButton"
                            onClick={() =>
                              requestDelete(
                                "group",
                                group._id,
                                `grupo "${group.name || "sem nome"}"`
                              )
                            }
                          >
                            Deletar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="localAdminPanel">
              {!selectedGroupData ? (
                <p className="localAdminEmpty">Clique em um grupo para ver mapas.</p>
              ) : (
                <>
                  <div className="localAdminPanelHeader">
                    <div>
                      <h3>{selectedGroupData.group.name}</h3>
                      <span>{selectedGroupData.maps.length} mapa(s)</span>
                    </div>
                  </div>

                  <div className="localAdminMapList">
                    {selectedGroupData.maps.length === 0 ? (
                      <p className="localAdminEmpty">Nenhum mapa neste grupo.</p>
                    ) : (
                      selectedGroupData.maps.map((map) => (
                        <article key={map._id}>
                          <div>
                            <a
                              className="localAdminMapLink"
                              href={`/map/${map._id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {map.title || "Sem titulo"}
                            </a>
                            <span>{map.visibility || "private"}</span>
                            <small>{formatDate(map.createdAt)}</small>
                          </div>
                          <button
                            className="localAdminDeleteButton"
                            onClick={() =>
                              requestDelete(
                                "map",
                                map._id,
                                `mapa "${map.title || "sem titulo"}"`
                              )
                            }
                          >
                            Deletar
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {activeSection === "maps" && (
          <section className="localAdminPanel localAdminWidePanel">
            <div className="localAdminPanelHeader">
              <h3>Mapas</h3>
              <span>
                {mapsData
                  ? `${mapsData.total} total | pagina ${mapsData.page}/${mapsData.totalPages}`
                  : "Clique para carregar"}
              </span>
            </div>

            {!mapsData ? (
              <p className="localAdminEmpty">Clique em Mapas para listar.</p>
            ) : (
              <>
                <div className="localAdminMapTable">
                  {mapsData.maps.map((map) => (
                    <article key={map._id}>
                      <div>
                        <a
                          className="localAdminMapLink"
                          href={`/map/${map._id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {map.title || "Sem titulo"}
                        </a>
                        <small>{map._id}</small>
                      </div>
                      <span>{map.groupName || "Sem grupo"}</span>
                      <span>{map.pinCount} pins</span>
                      <span>{map.visibility || "private"}</span>
                      <span
                        className={
                          map.hasLinkedUser
                            ? "localAdminLinkedUser"
                            : "localAdminMissingUser"
                        }
                      >
                        {map.ownerLabel || "Sem usuario vinculado"}
                      </span>
                      <button
                        className="localAdminDeleteButton"
                        onClick={() =>
                          requestDelete(
                            "map",
                            map._id,
                            `mapa "${map.title || "sem titulo"}"`
                          )
                        }
                      >
                        Deletar
                      </button>
                    </article>
                  ))}
                </div>

                <div className="localAdminPagination">
                  <button
                    disabled={mapsPage <= 1}
                    onClick={() => loadMaps(mapsPage - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    disabled={!mapsData || mapsPage >= mapsData.totalPages}
                    onClick={() => loadMaps(mapsPage + 1)}
                  >
                    Proxima
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </section>

      {pendingDelete && (
        <div className="modalOverlay localAdminConfirmOverlay">
          <div className="modal localAdminConfirmModal">
            <h2>Confirmar exclusao</h2>
            <p>
              Voce esta prestes a deletar {pendingDelete.label}. Esta acao e
              permanente e deve ser usada apenas para moderacao de conteudo que
              viole os termos.
            </p>
            <div className="modalActions">
              <button
                className="danger"
                onClick={confirmDeleteContent}
                disabled={loading}
              >
                Deletar
              </button>
              <button
                className="secondary"
                onClick={() => setPendingDelete(null)}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRename && (
        <div className="modalOverlay localAdminConfirmOverlay">
          <form
            className="modal localAdminConfirmModal localAdminRenameModal"
            onSubmit={confirmRenameUser}
          >
            <h2>Renomear usuario</h2>
            <p>
              Escolha um novo username para {pendingRename.username || "sem username"}.
              Ele precisa ser unico, ter ate 15 caracteres e usar apenas a-z e 0-9.
            </p>
            <label>
              Novo username
              <input
                value={renameUsername}
                maxLength={15}
                onChange={(event) =>
                  setRenameUsername(
                    event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                  )
                }
                autoFocus
              />
            </label>
            <div className="modalActions">
              <button className="primary" type="submit" disabled={loading}>
                Salvar
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setPendingRename(null)}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
