"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { FREE_ACCOUNT_LIMITS } from "@/lib/accountLimits";
import "../page.css";

const CUSTOM_ICON_ACCEPT = ".png,.jpg,.jpeg,.svg";
const CUSTOM_ICON_MAX_SIZE = 128;

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem."));
    };

    image.src = url;
  });
}

function isCustomIconFileType(file) {
  return /\.(png|jpe?g|svg)$/i.test(file?.name || "");
}

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

export default function Dashboard() {
  const { data: session, status, update } = useSession();

  const [groups, setGroups] = useState([]);
  const [assets, setAssets] = useState([]);
  const [ownedMaps, setOwnedMaps] = useState([]);
  const [editorMaps, setEditorMaps] = useState([]);
  const [accountLimits, setAccountLimits] = useState(FREE_ACCOUNT_LIMITS);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetFile, setAssetFile] = useState(null);
  const [assetFileInputKey, setAssetFileInputKey] = useState(0);
  const [assetUploadStatus, setAssetUploadStatus] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [pendingAssetLinkSave, setPendingAssetLinkSave] = useState(null);
  const [siteAlert, setSiteAlert] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const loadDashboard = useCallback(async function loadDashboard() {
    try {
      const groupsResponse = await fetch("/api/groups");
      const groupsData = await groupsResponse.json();

      if (!groupsResponse.ok) {
        alert(groupsData.error || "Erro ao carregar grupos.");
        return;
      }

      setGroups(groupsData.groups || []);

      const ownedMapsResponse = await fetch("/api/maps");
      const ownedMapsData = await ownedMapsResponse.json();

      if (!ownedMapsResponse.ok) {
        alert(ownedMapsData.error || "Erro ao carregar mapas.");
        return;
      }

      setOwnedMaps(ownedMapsData.maps || []);

      const editorMapsResponse = await fetch("/api/maps/editor");
      const editorMapsData = await editorMapsResponse.json();

      if (!editorMapsResponse.ok) {
        alert(editorMapsData.error || "Erro ao carregar mapas editáveis.");
        return;
      }

      setEditorMaps(editorMapsData.maps || []);

      const assetsResponse = await fetch("/api/assets");
      const assetsData = await assetsResponse.json();

      if (!assetsResponse.ok) {
        alert(assetsData.error || "Erro ao carregar ícones.");
        return;
      }

      setAssets(assetsData.assets || []);

      const limitsResponse = await fetch("/api/account/limits");
      const limitsData = await limitsResponse.json();

      if (limitsResponse.ok && limitsData.limits) {
        setAccountLimits(limitsData.limits);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar dashboard.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setSiteAlert(String(message || ""));
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.needsUsername) return;

    const timeoutId = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [status, session?.user?.needsUsername, loadDashboard]);

  function handleUsernameChange(event) {
    const nextValue = event.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);

    setUsernameDraft(nextValue);
  }

  async function saveUsername() {
    if (!usernameDraft) {
      alert("Digite um username.");
      return;
    }

    setSavingUsername(true);

    try {
      const response = await fetch("/api/account/username", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: usernameDraft }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar username.");
        return;
      }

      await update({
        username: data.username,
        needsUsername: false,
      });

      setUsernameDraft("");
      setLoaded(false);
      loadDashboard();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar username.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function createGroup() {
    if (!groupName.trim()) {
      alert("Digite um nome para o grupo.");
      return;
    }

    setCreatingGroup(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao criar grupo.");
        return;
      }

      setGroups((prev) => [data.group, ...prev]);
      setGroupName("");
    } catch (error) {
      console.error(error);
      alert("Erro ao criar grupo.");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleAssetFile(event) {
    const file = event.target.files[0];

    setAssetFile(null);
    setAssetUploadStatus("");

    if (!file) return;

    if (!isCustomIconFileType(file)) {
      alert("Icones customizados aceitam apenas .png, .jpg, .jpeg ou .svg.");
      setAssetFileInputKey((prev) => prev + 1);
      return;
    }

    try {
      const dimensions = await getImageDimensions(file);

      if (
        dimensions.width > CUSTOM_ICON_MAX_SIZE ||
        dimensions.height > CUSTOM_ICON_MAX_SIZE
      ) {
        alert("Icones customizados devem ter no maximo 128x128 pixels.");
        setAssetFileInputKey((prev) => prev + 1);
        return;
      }
    } catch (error) {
      alert(error.message || "Nao foi possivel validar o icone.");
      setAssetFileInputKey((prev) => prev + 1);
      return;
    }

    setAssetFile(file);
  }

  async function createAsset() {
    if (!assetName.trim()) {
      alert("Digite um nome para o ícone.");
      return;
    }

    const duplicateAsset = assets.some(
      (asset) =>
        String(asset.name || "").trim().toLowerCase() ===
        assetName.trim().toLowerCase()
    );

    if (duplicateAsset) {
      alert("Ja existe um icone customizado com esse nome.");
      return;
    }

    if (!assetFile) {
      alert("Selecione uma imagem para o icone.");
      return;
    }

    setCreatingAsset(true);
    setUploadingAsset(true);
    setAssetUploadStatus("Carregando imagem...");

    try {
      const formData = new FormData();
      formData.append("file", assetFile);
      formData.append("purpose", "icon");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        setAssetUploadStatus("Erro ao carregar imagem.");
        alert(uploadData.error || "Erro no upload.");
        return;
      }

      setAssetUploadStatus("Criando icone...");

      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: assetName.trim(),
          imageUrl: uploadData.url,
          linkedGroupIds: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAssetUploadStatus("Erro ao criar icone.");
        alert(data.error || "Erro ao criar ícone.");
        return;
      }

      setAssets((prev) => [data.asset, ...prev]);
      setAssetName("");
      setAssetFile(null);
      setAssetFileInputKey((prev) => prev + 1);
      setAssetUploadStatus("Icone criado com sucesso.");
    } catch (error) {
      console.error(error);
      setAssetUploadStatus("Erro ao criar icone.");
      alert("Erro ao criar ícone.");
    } finally {
      setCreatingAsset(false);
      setUploadingAsset(false);
    }
  }

  function openEditAsset(asset) {
    setEditingAsset(asset);
    setSelectedGroupIds(asset.linkedGroupIds || []);
  }

  function closeEditAsset() {
    setEditingAsset(null);
    setSelectedGroupIds([]);
    setPendingAssetLinkSave(null);
  }

  function toggleGroup(groupId) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }
  
  async function deleteGroup(groupId) {
    if (!deleteConfirm || deleteConfirm.type !== "group") {
      setDeleteConfirm({
        type: "group",
        payload: groupId,
        title: "Deletar grupo?",
        message:
          "Tem certeza que deseja deletar este grupo? Todos os mapas e pins dele serao deletados.",
      });
      return;
    }

    setDeleteConfirm(null);

	  try {
		const response = await fetch(`/api/groups/${groupId}`, {
		  method: "DELETE",
		});

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao deletar grupo.");
		  return;
		}

		setGroups((prev) => prev.filter((group) => group._id !== groupId));

		setAssets((prev) =>
		  prev.map((asset) => ({
			...asset,
			linkedGroupIds: (asset.linkedGroupIds || []).filter(
			  (id) => id !== groupId
			),
		  }))
		);
	  } catch (error) {
		console.error(error);
		alert("Erro ao deletar grupo.");
	  }
	}
	
	function openEditGroup(group) {
	  setEditingGroup(group);
	  setEditingGroupName(group.name);
	}

	function closeEditGroup() {
	  setEditingGroup(null);
	  setEditingGroupName("");
	}

	async function saveGroupName() {
	  if (!editingGroupName.trim()) {
		alert("Digite um nome para o grupo.");
		return;
	  }

	  try {
		const response = await fetch(`/api/groups/${editingGroup._id}`, {
		  method: "PATCH",
		  headers: {
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			name: editingGroupName.trim(),
		  }),
		});

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao editar grupo.");
		  return;
		}

		setGroups((prev) =>
		  prev.map((group) =>
			group._id === editingGroup._id
			  ? { ...group, name: editingGroupName.trim() }
			  : group
		  )
		);

		closeEditGroup();
	  } catch (error) {
		console.error(error);
		alert("Erro ao editar grupo.");
	  }
	}

  function getPermissionLabel(permission) {
    const labels = {
      fullAccess: "Full Access",
      pinEditor: "Pin Editor",
      routeEditor: "Route Editor",
      none: "Sem permissão ativa",
    };

    return labels[permission] || labels.none;
  }

  async function saveAssetLinks() {
    if (!editingAsset) return;

    const removedGroupIds = (editingAsset.linkedGroupIds || []).filter(
      (groupId) => !selectedGroupIds.includes(groupId)
    );

    if (removedGroupIds.length > 0) {
      setPendingAssetLinkSave({
        asset: editingAsset,
        linkedGroupIds: selectedGroupIds,
        removedGroupIds,
      });
      return;
    }

    await performSaveAssetLinks(editingAsset, selectedGroupIds);
  }

  async function performSaveAssetLinks(assetToSave, nextLinkedGroupIds) {
    if (!assetToSave) return;

    try {
      const response = await fetch(`/api/assets/${assetToSave._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: assetToSave.name,
          linkedGroupIds: nextLinkedGroupIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao atualizar ícone.");
        return;
      }

      setAssets((prev) =>
        prev.map((asset) =>
          asset._id === assetToSave._id
            ? { ...asset, linkedGroupIds: nextLinkedGroupIds }
            : asset
        )
      );

      closeEditAsset();
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar ícone.");
    }
  }

  async function confirmAssetLinkSave() {
    if (!pendingAssetLinkSave) return;

    const pendingSave = pendingAssetLinkSave;
    setPendingAssetLinkSave(null);
    await performSaveAssetLinks(
      pendingSave.asset,
      pendingSave.linkedGroupIds
    );
  }

  async function deleteAsset(assetId) {
    if (!deleteConfirm || deleteConfirm.type !== "asset") {
      setDeleteConfirm({
        type: "asset",
        payload: assetId,
        title: "Deletar icone?",
        message:
          "Deletar este icone customizado? Se ainda existir alguma categoria usando este icone, ela sera deletada junto com os pins dessa categoria.",
      });
      return;
    }

    setDeleteConfirm(null);

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao deletar ícone.");
        return;
      }

      setAssets((prev) => prev.filter((asset) => asset._id !== assetId));
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar ícone.");
    }
  }

  return (
    <main className="dashboardPage siteMain">
      <SiteHeader />
      {false && (
      <div className="authBox">
        {status === "loading" ? (
          <span>Carregando sessão...</span>
        ) : session ? (
          <>
            <span>
              {session.user.needsUsername
                ? "Escolha seu username"
                : `Logado como ${session.user.username}`}
            </span>
            <button onClick={() => signOut()}>Sair</button>
          </>
        ) : (
          <button onClick={() => signIn("google")}>Entrar com Google</button>
        )}
      </div>
      )}

      {session?.user?.needsUsername && (
        <section className="dashboardCard usernameSetupCard">
          <h1>Criar username</h1>
          <p>
            Esse será o nome exibido publicamente no site, como autor de mapas,
            em logs, toasts e listas de editores. Use apenas a-z e 0-9, com
            até 15 caracteres.
          </p>

          <div className="usernameSetupBox">
            <input
              value={usernameDraft}
              onChange={handleUsernameChange}
              placeholder="username"
              maxLength={15}
              autoFocus
            />

            <button onClick={saveUsername} disabled={savingUsername}>
              {savingUsername ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </section>
      )}

      {!session && (
      <section className="dashboardCard">
        <h1>Map Builder</h1>
        <p>Organize seus mapas por grupos/projetos.</p>

        <p className="emptyText">Entre com Google para criar grupos.</p>
      </section>
      )}

      {session && !session.user.needsUsername && (
        <>
          <section className="mapsList dashboardSection">
            <div className="dashboardSectionHeader">
              <div>
                <h2>Seus grupos</h2>
                <p>
                  Crie grupos para separar mapas por jogo, região, campanha ou
                  projeto.
                </p>
              </div>
              <div className="quotaActions">
                <span
                  className={
                    ownedMaps.length >= accountLimits.maps
                      ? "quotaBadge quotaBadgeLimitReached"
                      : "quotaBadge"
                  }
                >
                  Mapas: {ownedMaps.length}/{accountLimits.maps}
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

            <div className="createMapBox dashboardCreateBox">
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Nome do grupo. Ex: Elden Ring Nightreign"
              />

              <button onClick={createGroup} disabled={creatingGroup}>
                {creatingGroup ? "Criando..." : "Criar grupo"}
              </button>
            </div>

            {!loaded ? (
              <p className="emptyText">Carregando...</p>
            ) : groups.length === 0 ? (
              <p className="emptyText">Nenhum grupo criado ainda.</p>
            ) : (
              <div className="mapGrid">
                {groups.map((group) => (
                  <div
                    className={[
                      "mapCard",
                      "groupCard",
                      group.previewMap ? "hasGroupPreview" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={group._id}
                    style={
                      group.previewMap
                        ? {
                            "--group-preview-image": `url("${getMapPreviewUrl(
                              group.previewMap
                            )}")`,
                          }
                        : undefined
                    }
                  >
                    <div className="mapCardContent">
                      <h3>{group.name}</h3>

					<div className="mapCardActions">
					  <Link href={`/group/${group._id}`}>Abrir grupo</Link>

						<button onClick={() => openEditGroup(group)}>
						  Editar
						</button>

						<button onClick={() => deleteGroup(group._id)}>
						  Deletar
						</button>
					</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mapsList dashboardSection editorMapsSection">
            <div className="dashboardSectionHeader">
              <div>
                <h2>Mapas onde sou editor</h2>
                <p>
                  Mapas compartilhados com você por outros criadores aparecem
                  aqui.
                </p>
              </div>
            </div>

            {!loaded ? (
              <p className="emptyText">Carregando...</p>
            ) : editorMaps.length === 0 ? (
              <p className="emptyText">
                Nenhum mapa compartilhado com você por enquanto.
              </p>
            ) : (
              <div className="mapGrid">
                {editorMaps.map((map) => (
                  <div className="mapCard editorMapCard" key={map._id}>
                    {map.imageUrl && (
                      <img src={map.imageUrl} alt={map.title} />
                    )}

                    <div className="mapCardContent">
                      <div className="editorMapHeader">
                        <h3>{map.title}</h3>
                        <span>{getPermissionLabel(map.permission)}</span>
                      </div>

                      <p className="editorMapMeta">
                        {map.groupName
                          ? `Grupo: ${map.groupName}`
                          : `Owner: ${map.ownerUsername}`}
                      </p>

                      {map.description && (
                        <p className="editorMapDescription">
                          {map.description}
                        </p>
                      )}

                      <div className="mapCardActions">
                        <Link href={`/editor/${map._id}`}>Editar mapa</Link>
                        <Link href={`/map/${map._id}`}>Ver público</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboardCard">
            <div className="dashboardSectionHeader">
              <div>
                <h2>Biblioteca de ícones</h2>
                <p>
                  Suba um ícone uma vez e vincule aos grupos que quiser.
                  Arquivos aceitos: .png, .jpg, .jpeg ou .svg em 32x32,
                  64x64 ou 128x128. O tamanho maximo e 128x128.
                </p>
                <p>
                  Criar um ícone significa que você concorda com os{" "}
                  <Link href="/terms-of-service">Terms of Service</Link>.
                </p>
              </div>
              <div className="quotaActions">
                <span
                  className={
                    assets.length >= accountLimits.customIcons
                      ? "quotaBadge quotaBadgeLimitReached"
                      : "quotaBadge"
                  }
                >
                  Ícones: {assets.length}/{accountLimits.customIcons}
                </span>
              <Link
                className="quotaUpgradeButton"
                href="/support"
                title="Aumentar limite"
                aria-label="Aumentar limite de icones personalizados"
              >
                +
              </Link>
              </div>
            </div>

            <div className="createMapBox assetCreateBox">
              <input
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="Nome do ícone. Ex: Baú dourado"
              />

              <input
                key={assetFileInputKey}
                type="file"
                accept={CUSTOM_ICON_ACCEPT}
                onChange={handleAssetFile}
                disabled={uploadingAsset || creatingAsset}
              />

              {uploadingAsset && (
                <div
                  className="uploadStatus uploading"
                >
                  <span>
                    {assetUploadStatus || "Carregando imagem..."}
                  </span>
                  <div className="uploadProgress" />
                </div>
              )}

              <button
                onClick={createAsset}
                disabled={creatingAsset || uploadingAsset}
              >
                {uploadingAsset
                  ? "Carregando..."
                  : creatingAsset
                  ? "Criando..."
                  : "Adicionar icone"}
              </button>

            </div>

            {assets.length === 0 ? (
              <p className="emptyText">Nenhum ícone criado ainda.</p>
            ) : (
              <div className="assetGrid">
                {assets.map((asset) => (
                  <div className="assetCard" key={asset._id}>
                    <img src={asset.imageUrl} alt={asset.name} />
                    <strong>{asset.name}</strong>

                    <small>
                      {asset.linkedGroupIds?.length || 0} grupo(s)
                    </small>

                    <button onClick={() => openEditAsset(asset)}>
                      Vincular
                    </button>

                    <button onClick={() => deleteAsset(asset._id)}>
                      Deletar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {editingAsset && (
        <div className="modalOverlay" onClick={closeEditAsset}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>Vincular ícone</h2>

            <div className="assetPreview">
              <img src={editingAsset.imageUrl} alt={editingAsset.name} />
              <strong>{editingAsset.name}</strong>
            </div>

            <p className="emptyText">
              Escolha em quais grupos este ícone poderá ser usado.
            </p>

            <div className="groupChecklist">
              {groups.length === 0 ? (
                <p className="emptyText">Nenhum grupo criado ainda.</p>
              ) : (
                groups.map((group) => (
                  <label key={group._id} className="groupCheckItem">
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group._id)}
                      onChange={() => toggleGroup(group._id)}
                    />
                    {group.name}
                  </label>
                ))
              )}
            </div>

            <div className="modalActions">
              <button className="primary" onClick={saveAssetLinks}>
                Salvar vinculos
              </button>

              <button className="secondary" onClick={closeEditAsset}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingAssetLinkSave && (
        <div
          className="modalOverlay"
          onClick={() => setPendingAssetLinkSave(null)}
        >
          <div
            className="modal smallModal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Desvincular icone?</h2>
            <p className="modalSubtitle">
              Ao continuar, as categorias dos grupos removidos que usam este
              icone serao deletadas. Todos os pins dessas categorias tambem
              serao deletados.
            </p>

            <div className="modalActions">
              <button className="danger" onClick={confirmAssetLinkSave}>
                Desvincular
              </button>

              <button
                className="secondary"
                onClick={() => setPendingAssetLinkSave(null)}
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
                onClick={() =>
                  deleteConfirm.type === "group"
                    ? deleteGroup(deleteConfirm.payload)
                    : deleteAsset(deleteConfirm.payload)
                }
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
	  
	  {editingGroup && (
		  <div className="modalOverlay" onClick={closeEditGroup}>
			<div className="modal" onClick={(event) => event.stopPropagation()}>
			  <h2>Editar grupo</h2>

			  <label>
				Nome do grupo
				<input
				  value={editingGroupName}
				  onChange={(event) => setEditingGroupName(event.target.value)}
				  placeholder="Nome do grupo"
				/>
			  </label>

			  <div className="modalActions">
				<button className="secondary" onClick={closeEditGroup}>
				  Cancelar
				</button>

				<button className="primary" onClick={saveGroupName}>
				  Salvar
				</button>
			  </div>
			</div>
		  </div>
		)}
      <SiteFooter />
    </main>
  );
}

