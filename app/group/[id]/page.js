"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { FREE_ACCOUNT_LIMITS } from "@/lib/accountLimits";
import "../../page.css";

const MAP_FILE_ACCEPT = ".png,.jpg,.jpeg";

function isMapFileType(file) {
  return /\.(png|jpe?g)$/i.test(file?.name || "");
}

function getTileUrl(template, x, y) {
  return template.replace("{x}", x).replace("{y}", y);
}

function getMapPreviewUrl(map) {
  const firstLevel = map.tileData?.levels?.[0];

  if (!firstLevel?.urlTemplate) return map.imageUrl;

  const x = Math.max(0, Math.floor((firstLevel.columns || 1) / 2));
  const y = Math.max(0, Math.floor((firstLevel.rows || 1) / 2));

  return getTileUrl(firstLevel.urlTemplate, x, y);
}

function getRouteParamValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

export default function GroupPage() {
  const params = useParams();
  const groupId = getRouteParamValue(params?.id);

  const [maps, setMaps] = useState([]);
  const [ownedMapCount, setOwnedMapCount] = useState(0);
  const [accountLimits, setAccountLimits] = useState(FREE_ACCOUNT_LIMITS);
  const [assets, setAssets] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [createMapModalOpen, setCreateMapModalOpen] = useState(false);
  const [mapFile, setMapFile] = useState(null);
  const [mapFileInputKey, setMapFileInputKey] = useState(0);
  const [mapUploadStatus, setMapUploadStatus] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [siteAlert, setSiteAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
	const [editingMap, setEditingMap] = useState(null);
	const [editingMapTitle, setEditingMapTitle] = useState("");
	const [pendingUnlinkAsset, setPendingUnlinkAsset] = useState(null);

  const loadGroup = useCallback(async function loadGroup() {
    if (!groupId) return;

    try {
      const mapsResponse = await fetch(`/api/groups/${groupId}/maps`);
      const mapsData = await mapsResponse.json();

      if (!mapsResponse.ok) {
        alert(mapsData.error || "Erro ao carregar mapas.");
        return;
      }

      setMaps(mapsData.maps || []);

      const ownedMapsResponse = await fetch("/api/maps");
      const ownedMapsData = await ownedMapsResponse.json();

      if (ownedMapsResponse.ok) {
        setOwnedMapCount((ownedMapsData.maps || []).length);
      } else {
        setOwnedMapCount((mapsData.maps || []).length);
      }

      const assetsResponse = await fetch(
        `/api/groups/${groupId}/assets`
      );
      const assetsData = await assetsResponse.json();

      if (assetsResponse.ok) {
        setAssets(assetsData.assets || []);
      }

      const limitsResponse = await fetch("/api/account/limits");
      const limitsData = await limitsResponse.json();

      if (limitsResponse.ok && limitsData.limits) {
        setAccountLimits(limitsData.limits);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar grupo.");
    } finally {
      setLoaded(true);
    }
  }, [groupId]);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setSiteAlert(String(message || ""));
    };

    const timeoutId = window.setTimeout(() => {
      loadGroup();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.alert = originalAlert;
    };
  }, [loadGroup]);

  function handleFile(event) {
    const file = event.target.files[0];
    setMapUploadStatus("");

    if (!file) {
      setMapFile(null);
      return;
    }

    if (!isMapFileType(file)) {
      alert("Mapas aceitam apenas arquivos .png, .jpg ou .jpeg.");
      setMapFile(null);
      setMapFileInputKey((prev) => prev + 1);
      return;
    }

    setMapFile(file);
  }

  function openCreateMapModal() {
    if (!mapFile) {
      alert("Selecione uma imagem.");
      return;
    }

    setCreateMapModalOpen(true);
  }

  function closeCreateMapModal() {
    if (creating || uploadingMap) return;
    setCreateMapModalOpen(false);
  }

  async function createMap() {
    if (!title.trim()) {
      alert("Digite um nome para o mapa.");
      return;
    }

    if (!mapFile) {
      alert("Selecione uma imagem.");
      return;
    }

    setCreating(true);
    setUploadingMap(true);
    setMapUploadStatus("Carregando mapa...");

    try {
      const formData = new FormData();
      formData.append("file", mapFile);
      formData.append("purpose", "map");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        setMapUploadStatus("Erro ao carregar mapa.");
        alert(uploadData.error || "Erro no upload.");
        return;
      }

      setMapUploadStatus("Criando mapa...");

      const response = await fetch(`/api/groups/${groupId}/maps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          imageUrl: uploadData.url,
          tileData: uploadData.tileData || null,
          visibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMapUploadStatus("Erro ao criar mapa.");
        alert(data.error || "Erro ao criar mapa.");
        return;
      }

      setMaps((prev) => [data.map, ...prev]);
      setOwnedMapCount((prev) => prev + 1);
      setTitle("");
      setDescription("");
      setVisibility("private");
      setCreateMapModalOpen(false);
      setMapFile(null);
      setMapFileInputKey((prev) => prev + 1);
      setMapUploadStatus("Mapa criado com sucesso.");
    } catch (error) {
      console.error(error);
      setMapUploadStatus("Erro ao criar mapa.");
      alert("Erro ao criar mapa.");
    } finally {
      setCreating(false);
      setUploadingMap(false);
    }
  }

  async function deleteMap(mapId) {
    if (!deleteConfirm || deleteConfirm.type !== "map") {
      setDeleteConfirm({
        type: "map",
        payload: mapId,
        title: "Deletar mapa?",
        message: "Tem certeza que deseja deletar este mapa?",
      });
      return;
    }

    setDeleteConfirm(null);

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao deletar mapa.");
        return;
      }

      setMaps((prev) => prev.filter((map) => map._id !== mapId));
      setOwnedMapCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar mapa.");
    }
  }
  
  function openEditMap(map) {
  setEditingMap(map);
  setEditingMapTitle(map.title);
	}

	function closeEditMap() {
	  setEditingMap(null);
	  setEditingMapTitle("");
	}

	async function saveMapTitle() {
	  if (!editingMapTitle.trim()) {
		alert("Digite um nome para o mapa.");
		return;
	  }

	  try {
		const response = await fetch(`/api/maps/${editingMap._id}`, {
		  method: "PATCH",
		  headers: {
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			title: editingMapTitle.trim(),
		  }),
		});

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao editar mapa.");
		  return;
		}

		setMaps((prev) =>
		  prev.map((map) =>
			map._id === editingMap._id
			  ? { ...map, title: editingMapTitle.trim() }
			  : map
		  )
		);

		closeEditMap();
	  } catch (error) {
		console.error(error);
		alert("Erro ao editar mapa.");
	  }
	}

	 function requestUnlinkAsset(asset) {
	  setPendingUnlinkAsset(asset);
	}

	function closeUnlinkAssetConfirm() {
	  setPendingUnlinkAsset(null);
	}

	 async function unlinkAsset(assetId) {
	  console.log("UNLINK IDS:", {
		groupId,
		assetId,
	  });

	  if (!groupId || !assetId) {
		alert("ID invÃ¡lido no frontend.");
		return;
	  }

	  try {
		const response = await fetch(
		  `/api/groups/${String(groupId)}/assets/${String(assetId)}/unlink`,
		  {
			method: "PATCH",
		  }
		);

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao desvincular Ã­cone.");
		  return;
		}

		setAssets((prev) =>
		  prev.filter((asset) => String(asset._id) !== String(assetId))
		);
		closeUnlinkAssetConfirm();
	  } catch (error) {
		console.error(error);
		alert("Erro ao desvincular Ã­cone.");
	  }
	}

  function renderAuthBox() {
    return <SiteHeader />;
  }

  return (
    <main className="dashboardPage siteMain">
      {renderAuthBox()}

      {!loaded ? (
        <p className="siteLoadingText">Carregando...</p>
      ) : (
        <>
          <div className="groupPageBack">
            <Link className="backLink" href="/dashboard">
              Voltar
            </Link>
          </div>

          <section className="mapsList dashboardSection groupMapsSection">
            <div className="dashboardSectionHeader">
              <div>
                <h2>Mapas</h2>
                <p>
                  Adicione novos mapas neste grupo e gerencie os mapas já criados.
                  Arquivos aceitos para mapas: .png, .jpg ou .jpeg.
                </p>
                <p>
                  Criar um mapa significa que você concorda com os{" "}
                  <Link href="/terms-of-service">Terms of Service</Link>.
                </p>
              </div>
              <div className="quotaActions">
                <span
                  className={
                    ownedMapCount >= accountLimits.maps
                      ? "quotaBadge quotaBadgeLimitReached"
                      : "quotaBadge"
                  }
                >
                  Mapas: {ownedMapCount}/{accountLimits.maps}
                </span>
                <Link
                  className="quotaUpgradeButton"
                  href="/support"
                  title="Aumentar limite"
                  aria-label="Aumentar limite de mapas"
                >
                  +
                </Link>
              </div>
            </div>

            <div className="createMapBox mapCreateBox">
              <input
                key={mapFileInputKey}
                type="file"
                accept={MAP_FILE_ACCEPT}
                onChange={handleFile}
                disabled={uploadingMap || creating}
              />

              {uploadingMap && (
                <div
                  className="uploadStatus uploading"
                >
                  <span>
                    {mapUploadStatus || "Carregando mapa..."}
                  </span>
                  <div className="uploadProgress" />
                </div>
              )}

              <button onClick={openCreateMapModal} disabled={creating || uploadingMap}>
                {uploadingMap
                  ? "Carregando..."
                  : creating
                  ? "Criando..."
                  : "Criar mapa"}
              </button>
            </div>

            {maps.length === 0 ? (
              <p className="emptyText">
                Nenhum mapa criado neste grupo.
              </p>
            ) : (
              <div className="mapGrid">
                {maps.map((map) => (
                  <div className="mapCard" key={map._id}>
                    <div className="groupMapPreview">
                      <img src={getMapPreviewUrl(map)} alt={map.title} />
                    </div>

                    <div className="mapCardContent">
                      <h3>{map.title}</h3>

                      <div className="mapCardActions">
                        <Link href={`/editor/${map._id}`}>Editar mapa</Link>
                        <Link href={`/map/${map._id}`}>Ver público</Link>
                        <button onClick={() => openEditMap(map)}>
                          Renomear
                        </button>
                        <button onClick={() => deleteMap(map._id)}>
                          Deletar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboardCard groupAssetsSection">
            <h2>Ícones vinculados ao grupo</h2>
            <p>
              Estes ícones podem ser usados nos pins deste grupo.
              Para criar novos ícones, vá para a tela principal.
            </p>

            {assets.length === 0 ? (
              <p className="emptyText">
                Nenhum ícone vinculado a este grupo.
              </p>
            ) : (
              <div className="assetGrid">
                {assets.map((asset) => (
                  <div className="assetCard" key={asset._id}>
                    <img src={asset.imageUrl} alt={asset.name} />
                    <strong>{asset.name}</strong>

                    <button onClick={() => requestUnlinkAsset(asset)}>
                      Desvincular
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {editingMap && (
            <div className="modalOverlay" onClick={closeEditMap}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <h2>Editar mapa</h2>

                <label>
                  Nome do mapa
                  <input
                    value={editingMapTitle}
                    onChange={(event) => setEditingMapTitle(event.target.value)}
                    placeholder="Nome do mapa"
                  />
                </label>

                <div className="modalActions">
                  <button className="secondary" onClick={closeEditMap}>
                    Cancelar
                  </button>

                  <button className="primary" onClick={saveMapTitle}>
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {createMapModalOpen && (
            <div className="modalOverlay" onClick={closeCreateMapModal}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <button className="closeButton" onClick={closeCreateMapModal}>
                  {"\u00D7"}
                </button>

                <h2>Criar mapa</h2>
                <p className="modalSubtitle">
                  Defina as informações do mapa antes de iniciar o upload.
                </p>
                <p className="modalSubtitle">
                  Criar um mapa significa que você concorda com os{" "}
                  <Link href="/terms-of-service">Terms of Service</Link>.
                </p>

                <label>
                  Título
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Nome do mapa"
                    disabled={creating || uploadingMap}
                  />
                </label>

                <label>
                  Descrição
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Descrição do mapa"
                    rows={4}
                    disabled={creating || uploadingMap}
                  />
                </label>

                <div className="mapSettingsVisibility">
                  <span className="mapSettingsLabelWithHelp">
                    Visibilidade
                    <span className="settingsHelp">
                      ?
                      <span className="settingsHelpTooltip">
                        <span>Public: Mapas aparecem na biblioteca pública.</span>
                        <span>Not Listed: Somente quem tem o link pode visualizar o mapa.</span>
                        <span>Private: Somente o owner pode visualizar e editar o mapa.</span>
                      </span>
                    </span>
                  </span>

                  <div className="visibilitySegment" role="radiogroup" aria-label="Visibilidade">
                    {[
                      ["public", "Public"],
                      ["notListed", "Not Listed"],
                      ["private", "Private"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={visibility === value ? "active" : ""}
                        onClick={() => setVisibility(value)}
                        disabled={creating || uploadingMap}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="modalActions">
                  <button
                    className="primary"
                    onClick={createMap}
                    disabled={creating || uploadingMap}
                  >
                    {uploadingMap ? "Criando..." : "Criar"}
                  </button>

                  <button
                    className="secondary"
                    onClick={closeCreateMapModal}
                    disabled={creating || uploadingMap}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingUnlinkAsset && (
            <div className="modalOverlay" onClick={closeUnlinkAssetConfirm}>
              <div
                className="modal smallModal"
                onClick={(event) => event.stopPropagation()}
              >
                <h2>Desvincular icone?</h2>
                <p className="modalSubtitle">
                  Ao continuar, todas as categorias deste grupo que usam o icone
                  "{pendingUnlinkAsset.name}" serao deletadas. Todos os pins dessas
                  categorias tambem serao deletados.
                </p>

                <div className="modalActions">
                  <button
                    className="danger"
                    onClick={() => unlinkAsset(pendingUnlinkAsset._id)}
                  >
                    Desvincular
                  </button>

                  <button
                    className="secondary"
                    onClick={closeUnlinkAssetConfirm}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteConfirm && (
            <div className="modalOverlay" onClick={() => setDeleteConfirm(null)}>
              <div
                className="modal smallModal"
                onClick={(event) => event.stopPropagation()}
              >
                <h2>{deleteConfirm.title}</h2>
                <p className="modalSubtitle">{deleteConfirm.message}</p>

                <div className="modalActions">
                  <button
                    className="danger"
                    onClick={() => deleteMap(deleteConfirm.payload)}
                  >
                    Deletar
                  </button>

                  <button
                    className="secondary"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {siteAlert && (
            <div className="modalOverlay siteAlertOverlay" onClick={() => setSiteAlert(null)}>
              <div
                className="modal smallModal"
                onClick={(event) => event.stopPropagation()}
              >
                <h2>Aviso</h2>
                <p className="modalSubtitle">{siteAlert}</p>

                <div className="modalActions">
                  <button className="primary" onClick={() => setSiteAlert(null)}>
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <SiteFooter />
    </main>
  );
}
