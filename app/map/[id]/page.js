"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";

export default function PublicMapPage() {
  const params = useParams();
  const mapId = params.id;

  const [mapData, setMapData] = useState(null);
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    async function loadMapAndPins() {
      try {
        const mapResponse = await fetch(`/api/maps/${mapId}`);
        const mapResult = await mapResponse.json();

        if (!mapResponse.ok) {
          setMapData(null);
          return;
        }

        setMapData(mapResult.map);

        const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
        const pinsResult = await pinsResponse.json();

        if (pinsResponse.ok) {
          setPins(pinsResult.pins || []);
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

  function handlePinClick(event, pin) {
    event.stopPropagation();
    setSelectedPin(pin);
  }

  if (!loaded) {
    return <main className="loadingPage">Carregando...</main>;
  }

  if (!mapData) {
    return (
      <main className="loadingPage">
        <h1>Mapa não encontrado</h1>
        <Link href="/">Voltar</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>{mapData.title}</h1>
          <p>Visualização pública</p>
        </div>

        <div className="topbarActions">
          <span>{pins.length} pins</span>
          <Link className="backLink" href="/">
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mapArea">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={5}
          wheel={{ step: 0.005 }}
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
                <div className="imageWrapper">
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
        </div>
      )}
    </main>
  );
}
