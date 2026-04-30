"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import "../../page.css";

export default function GroupPage() {
  const params = useParams();
  const groupId = params.id;

  const [maps, setMaps] = useState([]);
  const [assets, setAssets] = useState([]);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  
	const [editingMap, setEditingMap] = useState(null);
	const [editingMapTitle, setEditingMapTitle] = useState("");

  useEffect(() => {
    loadGroup();
  }, []);

  async function loadGroup() {
    try {
      const mapsResponse = await fetch(`/api/groups/${groupId}/maps`);
      const mapsData = await mapsResponse.json();

      if (!mapsResponse.ok) {
        alert(mapsData.error || "Erro ao carregar mapas.");
        return;
      }

      setMaps(mapsData.maps || []);

      const assetsResponse = await fetch(
        `/api/groups/${groupId}/assets`
      );
      const assetsData = await assetsResponse.json();

      if (assetsResponse.ok) {
        setAssets(assetsData.assets || []);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar grupo.");
    } finally {
      setLoaded(true);
    }
  }

  async function handleFile(event) {
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

      setImageUrl(data.url);
    } catch (error) {
      console.error(error);
      alert("Erro no upload.");
    }
  }

  async function createMap() {
    if (!title.trim()) {
      alert("Digite um nome para o mapa.");
      return;
    }

    if (!imageUrl) {
      alert("Selecione uma imagem.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/maps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao criar mapa.");
        return;
      }

      setMaps((prev) => [data.map, ...prev]);
      setTitle("");
      setImageUrl(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao criar mapa.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteMap(mapId) {
    const confirmDelete = confirm(
      "Tem certeza que deseja deletar este mapa?"
    );
    if (!confirmDelete) return;

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

	 async function unlinkAsset(assetId) {
	  console.log("UNLINK IDS:", {
		groupId,
		assetId,
	  });

	  if (!groupId || !assetId) {
		alert("ID inválido no frontend.");
		return;
	  }

	  const confirmUnlink = confirm(
		"Desvincular este ícone deste grupo? Os pins que usam esse ícone voltarão para o padrão."
	  );

	  if (!confirmUnlink) return;

	  try {
		const response = await fetch(
		  `/api/groups/${String(groupId)}/assets/${String(assetId)}/unlink`,
		  {
			method: "PATCH",
		  }
		);

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao desvincular ícone.");
		  return;
		}

		setAssets((prev) =>
		  prev.filter((asset) => String(asset._id) !== String(assetId))
		);
	  } catch (error) {
		console.error(error);
		alert("Erro ao desvincular ícone.");
	  }
	}

  if (!loaded) {
    return <main className="loadingPage">Carregando...</main>;
  }

  return (
    <main className="dashboardPage">
      <section className="dashboardCard">
        <Link className="backLink" href="/">
          Voltar
        </Link>

        <h1>Mapas do grupo</h1>
        <p>Crie mapas dentro deste grupo.</p>

        <div className="createMapBox">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nome do mapa"
          />

          <input type="file" accept="image/*" onChange={handleFile} />

          <button onClick={createMap} disabled={creating}>
            {creating ? "Criando..." : "Criar mapa"}
          </button>
        </div>
      </section>

      {/* ÍCONES DO GRUPO */}
      <section className="dashboardCard">
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

                <button onClick={() => unlinkAsset(asset._id)}>
                  Desvincular
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MAPAS */}
      <section className="mapsList">
        <h2>Mapas</h2>

        {maps.length === 0 ? (
          <p className="emptyText">
            Nenhum mapa criado neste grupo.
          </p>
        ) : (
          <div className="mapGrid">
            {maps.map((map) => (
              <div className="mapCard" key={map._id}>
                <img src={map.imageUrl} alt={map.title} />

                <div className="mapCardContent">
                  <h3>{map.title}</h3>

                  <div className="mapCardActions">
                    <Link href={`/editor/${map._id}`}>
					  Editar mapa
					</Link>

					<Link href={`/map/${map._id}`}>
					  Ver público
					</Link>

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
    </main>
  );
}