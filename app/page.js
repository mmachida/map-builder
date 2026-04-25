"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./page.css";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Dashboard() {
  const [maps, setMaps] = useState([]);
  const [title, setTitle] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [imageBase64, setImageBase64] = useState(null);
  const [creating, setCreating] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    loadMaps();
  }, []);

  async function loadMaps() {
    try {
      const response = await fetch("/api/maps");
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao carregar mapas.");
        return;
      }

      setMaps(data.maps || []);
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com a API.");
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
      alert(data.error || "Erro no upload");
      return;
    }

    setImageBase64(data.url);
  } catch (error) {
    console.error(error);
    alert("Erro no upload");
  }
}

  async function createMap() {
    if (!title.trim()) {
      alert("Digite um nome para o mapa.");
      return;
    }

    if (!imageBase64) {
      alert("Selecione uma imagem.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/maps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          imageUrl: imageBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao criar mapa.");
        return;
      }

      setMaps((prev) => [data.map, ...prev]);
      setTitle("");
      setImageBase64(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao criar mapa.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteMap(mapId) {
    const confirmDelete = confirm("Tem certeza que deseja deletar este mapa?");

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

  if (!loaded) {
    return <main className="loadingPage">Carregando...</main>;
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
        <p>Crie mapas interativos com pins personalizados.</p>

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

      <section className="mapsList">
        <h2>Seus mapas</h2>

        {maps.length === 0 ? (
          <p className="emptyText">Nenhum mapa criado ainda.</p>
        ) : (
          <div className="mapGrid">
            {maps.map((map) => (
              <div className="mapCard" key={map._id}>
                <img src={map.imageUrl} alt={map.title} />

                <div className="mapCardContent">
                  <h3>{map.title}</h3>

                  <div className="mapCardActions">
                    <Link href={`/editor/${map._id}`}>Editar</Link>

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
    </main>
  );
  
  {session ? (
  <div>
    <span>Logado como {session.user.name}</span>
    <button onClick={() => signOut()}>Sair</button>
  </div>
) : (
  <button onClick={() => signIn("google")}>
    Entrar com Google
  </button>
)}
}