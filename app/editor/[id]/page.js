"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";

const ICONS = ["📍", "⭐", "⚔️", "🛡️", "💎", "🔥", "🌿", "🏰", "👁️", "❓"];

export default function EditorPage() {
  const params = useParams();
  const mapId = params.id;

  const [mapData, setMapData] = useState(null);
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedPin, setSelectedPin] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [pendingPosition, setPendingPosition] = useState(null);
  
  const [isAddingPin, setIsAddingPin] = useState(false);
  
  const [isOwner, setIsOwner] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "📍",
  });

	useEffect(() => {
	  async function loadMapAndPins() {
		try {
		  const mapResponse = await fetch(`/api/maps/${mapId}`);
		  const mapDataResult = await mapResponse.json();

		  if (!mapResponse.ok) {
			setMapData(null);
			setLoaded(true);
			return;
		  }

		  setMapData(mapDataResult.map);
		  setIsOwner(mapDataResult.isOwner);

		  const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
		  const pinsDataResult = await pinsResponse.json();

		  if (pinsResponse.ok) {
			setPins(pinsDataResult.pins || []);
		  }
		} catch (error) {
		  console.error(error);
		  setMapData(null);
		} finally {
		  setLoaded(true);
		}
	  }

	  loadMapAndPins();
	}, [mapId]);



	function handleMapClick(event) {
	  if (!isAddingPin) return;

	  const imageWrapper = event.currentTarget;
	  const rect = imageWrapper.getBoundingClientRect();

	  const x = ((event.clientX - rect.left) / rect.width) * 100;
	  const y = ((event.clientY - rect.top) / rect.height) * 100;

	  setPendingPosition({ x, y });
	  setEditingPin(null);
	  setForm({
		name: "",
		description: "",
		icon: "📍",
	  });

	  setModalOpen(true);
	  setIsAddingPin(false);
	}

  function handlePinClick(event, pin) {
    event.stopPropagation();
    setSelectedPin(pin);
  }

  function openEditModal(pin) {
    setEditingPin(pin);
    setPendingPosition(null);
    setForm({
      name: pin.name,
      description: pin.description,
      icon: pin.icon,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPin(null);
    setPendingPosition(null);
  }

		async function savePin() {
	  if (!form.name.trim()) {
		alert("Digite um nome para o pin.");
		return;
	  }

	  try {
		if (editingPin) {
		  const response = await fetch(`/api/pins/${editingPin._id}`, {
			method: "PATCH",
			headers: {
			  "Content-Type": "application/json",
			},
			body: JSON.stringify({
			  name: form.name.trim(),
			  description: form.description.trim(),
			  icon: form.icon,
			}),
		  });

		  const data = await response.json();

		  if (!response.ok) {
			alert(data.error || "Erro ao editar pin.");
			return;
		  }

		  const updatedPin = {
			...editingPin,
			name: form.name.trim(),
			description: form.description.trim(),
			icon: form.icon,
		  };

		  setPins((prev) =>
			prev.map((pin) => (pin._id === editingPin._id ? updatedPin : pin))
		  );

		  setSelectedPin(updatedPin);
		  closeModal();
		  return;
		}

		const response = await fetch(`/api/maps/${mapId}/pins`, {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			name: form.name.trim(),
			description: form.description.trim(),
			icon: form.icon,
			x: pendingPosition.x,
			y: pendingPosition.y,
		  }),
		});

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao criar pin.");
		  return;
		}

		setPins((prev) => [...prev, data.pin]);
		setSelectedPin(data.pin);
		closeModal();
	  } catch (error) {
		console.error(error);
		alert("Erro ao salvar pin.");
	  }
	}

	async function deletePin(pinId) {
  const confirmDelete = confirm("Tem certeza que deseja deletar este pin?");

  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/pins/${pinId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao deletar pin.");
      return;
    }

    setPins((prev) => prev.filter((pin) => pin._id !== pinId));
    setSelectedPin(null);
    closeModal();
  } catch (error) {
    console.error(error);
    alert("Erro ao deletar pin.");
  }
}

	async function clearPins() {
	  const confirmClear = confirm("Tem certeza que deseja limpar todos os pins?");

	  if (!confirmClear) return;

	  try {
		const response = await fetch(`/api/maps/${mapId}/pins`, {
		  method: "DELETE",
		});

		const data = await response.json();

		if (!response.ok) {
		  alert(data.error || "Erro ao limpar pins.");
		  return;
		}

		setPins([]);
		setSelectedPin(null);
	  } catch (error) {
		console.error(error);
		alert("Erro ao limpar pins.");
	  }
	}

	function copyPublicLink() {
	  navigator.clipboard.writeText(`${window.location.origin}/map/${mapId}`);
	  alert("Link público copiado!");
	}

  if (!loaded) {
    return <main className="loadingPage">Carregando...</main>;
  }

  if (!mapData) {
    return (
      <main className="loadingPage">
        <h1>Mapa não encontrado</h1>
        <Link href="/">Voltar para dashboard</Link>
      </main>
    );
  }
  
	  if (!isOwner) {
	  return (
		<main className="loadingPage">
		  <h1>Você não tem permissão para editar este mapa</h1>
		  <Link href={`/map/${mapId}`}>Visualizar mapa</Link>
		</main>
	  );
	}

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>{mapData.title}</h1>
          <p>Clique no mapa para adicionar pins.</p>
        </div>

        <div className="topbarActions">
          <span>{pins.length} pins</span>
          <Link className="backLink" href="/">
            Dashboard
          </Link>
		  
		  <button
		  className={isAddingPin ? "activeAddButton" : "addButton"}
		  onClick={() => setIsAddingPin((prev) => !prev)}
		>
		  {isAddingPin ? "Clique no mapa..." : "Adicionar pin"}
		</button>
		
          <button onClick={copyPublicLink}>Copiar link</button>
          <button onClick={clearPins}>Limpar pins</button>
        </div>
      </header>

      <section className="mapArea">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          wheel={{ step: 0.001 }}
          doubleClick={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="controls">
                <button onClick={() => zoomIn()}>+</button>
                <button onClick={() => zoomOut()}>-</button>
                <button onClick={() => resetTransform()}>Reset</button>
              </div>

              <TransformComponent
                wrapperClass="transformWrapper"
                contentClass="transformContent"
              >
                <div className="imageWrapper" onClick={handleMapClick}>
                  <img
                    src={mapData.imageUrl}
                    alt={mapData.title}
                    className="mapImage"
                    draggable="false"
                  />

                  {pins.map((pin) => (
                    <button
                      key={pin._id}
                      className="pin"
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                      }}
                      onClick={(event) => handlePinClick(event, pin)}
                      title={pin.name}
                    >
                      {pin.icon}
                    </button>
                  ))}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </section>

      {selectedPin && (
        <div className="popup">
          <button className="closeButton" onClick={() => setSelectedPin(null)}>
            ×
          </button>

          <div className="popupIcon">{selectedPin.icon}</div>

          <h2>{selectedPin.name}</h2>

          {selectedPin.description ? (
            <p>{selectedPin.description}</p>
          ) : (
            <p className="emptyText">Sem descrição.</p>
          )}

          <div className="coords">
            X: {selectedPin.x.toFixed(2)}% | Y: {selectedPin.y.toFixed(2)}%
          </div>

          <div className="popupActions">
            <button onClick={() => openEditModal(selectedPin)}>Editar</button>
            <button className="danger" onClick={() => deletePin(selectedPin._id)}
			>
              Deletar
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{editingPin ? "Editar pin" : "Novo pin"}</h2>

            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Ex: Baú escondido"
              />
            </label>

            <label>
              Descrição
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Ex: Fica atrás da cachoeira."
              />
            </label>

            <div className="iconSection">
              <span>Ícone</span>

              <div className="iconGrid">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    className={form.icon === icon ? "icon selected" : "icon"}
                    onClick={() => setForm((prev) => ({ ...prev, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="modalActions">
              <button className="secondary" onClick={closeModal}>
                Cancelar
              </button>

              <button className="primary" onClick={savePin}>
                {editingPin ? "Salvar alterações" : "Criar pin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}