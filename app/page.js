"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import "./page.css";

export default function Dashboard() {
  const { data: session, status } = useSession();

  const [groups, setGroups] = useState([]);
  const [assets, setAssets] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetImageUrl, setAssetImageUrl] = useState(null);

  const [loaded, setLoaded] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingAsset, setCreatingAsset] = useState(false);

  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  
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

      const assetsResponse = await fetch("/api/assets");
      const assetsData = await assetsResponse.json();

      if (!assetsResponse.ok) {
        alert(assetsData.error || "Erro ao carregar ícones.");
        return;
      }

      setAssets(assetsData.assets || []);
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar dashboard.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    const timeoutId = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [status, loadDashboard]);

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
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro no upload.");
        return;
      }

      setAssetImageUrl(data.url);
    } catch (error) {
      console.error(error);
      alert("Erro no upload.");
    }
  }

  async function createAsset() {
    if (!assetName.trim()) {
      alert("Digite um nome para o ícone.");
      return;
    }

    if (!assetImageUrl) {
      alert("Selecione uma imagem para o ícone.");
      return;
    }

    setCreatingAsset(true);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: assetName.trim(),
          imageUrl: assetImageUrl,
          linkedGroupIds: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao criar ícone.");
        return;
      }

      setAssets((prev) => [data.asset, ...prev]);
      setAssetName("");
      setAssetImageUrl(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao criar ícone.");
    } finally {
      setCreatingAsset(false);
    }
  }

  function openEditAsset(asset) {
    setEditingAsset(asset);
    setSelectedGroupIds(asset.linkedGroupIds || []);
  }

  function closeEditAsset() {
    setEditingAsset(null);
    setSelectedGroupIds([]);
  }

  function toggleGroup(groupId) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }
  
  async function deleteGroup(groupId) {
  const confirmDelete = confirm(
		"Tem certeza que deseja deletar este grupo? Todos os mapas e pins dele serão deletados."
	  );

	  if (!confirmDelete) return;

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

  async function saveAssetLinks() {
    if (!editingAsset) return;

    try {
      const response = await fetch(`/api/assets/${editingAsset._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingAsset.name,
          linkedGroupIds: selectedGroupIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao atualizar ícone.");
        return;
      }

      setAssets((prev) =>
        prev.map((asset) =>
          asset._id === editingAsset._id
            ? { ...asset, linkedGroupIds: selectedGroupIds }
            : asset
        )
      );

      closeEditAsset();
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar ícone.");
    }
  }

  async function deleteAsset(assetId) {
    const confirmDelete = confirm("Tem certeza que deseja deletar este ícone?");
    if (!confirmDelete) return;

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
    <main className="dashboardPage">
      <div className="authBox">
        {status === "loading" ? (
          <span>Carregando sessão...</span>
        ) : session ? (
          <>
            <span>Logado como {session.user.name}</span>
            <button onClick={() => signOut()}>Sair</button>
          </>
        ) : (
          <button onClick={() => signIn("google")}>Entrar com Google</button>
        )}
      </div>

      <section className="dashboardCard">
        <h1>Map Builder</h1>
        <p>Organize seus mapas por grupos/projetos.</p>

        {!session ? (
          <p className="emptyText">Entre com Google para criar grupos.</p>
        ) : (
          <div className="createMapBox">
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Nome do grupo. Ex: Elden Ring Nightreign"
            />

            <button onClick={createGroup} disabled={creatingGroup}>
              {creatingGroup ? "Criando..." : "Criar grupo"}
            </button>
          </div>
        )}
      </section>

      {session && (
        <>
          <section className="mapsList">
            <h2>Seus grupos</h2>

            {!loaded ? (
              <p className="emptyText">Carregando...</p>
            ) : groups.length === 0 ? (
              <p className="emptyText">Nenhum grupo criado ainda.</p>
            ) : (
              <div className="mapGrid">
                {groups.map((group) => (
                  <div className="mapCard" key={group._id}>
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

          <section className="dashboardCard">
            <h2>Biblioteca de ícones</h2>
            <p>Suba um ícone uma vez e vincule aos grupos que quiser.</p>

            <div className="createMapBox">
              <input
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="Nome do ícone. Ex: Baú dourado"
              />

              <input type="file" accept="image/*" onChange={handleAssetFile} />

              <button onClick={createAsset} disabled={creatingAsset}>
                {creatingAsset ? "Criando..." : "Adicionar ícone"}
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
                      Vinculado a {asset.linkedGroupIds?.length || 0} grupo(s)
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
              <button className="secondary" onClick={closeEditAsset}>
                Cancelar
              </button>

              <button className="primary" onClick={saveAssetLinks}>
                Salvar vínculos
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
    </main>
  );
}
