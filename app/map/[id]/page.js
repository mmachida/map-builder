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

  const [categoryFilter, setCategoryFilter] = useState("all");

  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState([]);

  const [routeEffectsEnabled, setRouteEffectsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;

    const saved = localStorage.getItem("routeEffectsEnabled");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const [hiddenPinTypes, setHiddenPinTypes] = useState([]);
  const [pinCategories, setPinCategories] = useState([]);
  const [pinTypes, setPinTypes] = useState([]);

  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);

  const CATEGORIES = [
    { value: "geral", label: "Geral" },
    { value: "bau", label: "Baú" },
    { value: "boss", label: "Boss" },
    { value: "npc", label: "NPC" },
    { value: "item", label: "Item" },
    { value: "segredo", label: "Segredo" },
  ];

  const filteredPins = pins.filter((pin) => {
    const typeKey = getPinIconKey(pin);
    return !hiddenPinTypes.includes(typeKey);
  });

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

        if (mapResult.map.groupId) {
          const categoriesResponse = await fetch(
            `/api/groups/${mapResult.map.groupId}/pin-categories`
          );

          const categoriesData = await categoriesResponse.json();

          if (categoriesResponse.ok) {
            setPinCategories(categoriesData.categories || []);
          }

          const pinTypesResponse = await fetch(
            `/api/groups/${mapResult.map.groupId}/pin-types`
          );

          const pinTypesData = await pinTypesResponse.json();

          if (pinTypesResponse.ok) {
            setPinTypes(pinTypesData.pinTypes || []);
          }
        }

        const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
        const pinsResult = await pinsResponse.json();

        if (pinsResponse.ok) {
          setPins(pinsResult.pins || []);
        }

        const routesResponse = await fetch(`/api/maps/${mapId}/routes`);
        const routesResult = await routesResponse.json();

        if (routesResponse.ok) {
          setRoutes(routesResult.routes || []);
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

  useEffect(() => {
    localStorage.setItem(
      "routeEffectsEnabled",
      JSON.stringify(routeEffectsEnabled)
    );
  }, [routeEffectsEnabled]);

  function getPinIconKey(pin) {
    if (pin.iconKey) return pin.iconKey;

    if (pin.iconType === "custom") {
      return `custom:${pin.iconImageUrl || ""}`;
    }

    return `emoji:${pin.icon || "📍"}`;
  }

  function renderPinIcon(pin) {
    if (pin.iconType === "custom" && pin.iconImageUrl) {
      return (
        <img src={pin.iconImageUrl} alt={pin.name} className="customPinIcon" />
      );
    }

    return pin.icon || "📍";
  }

  function handlePinClick(event, pin) {
    event.stopPropagation();
    setSelectedPin(pin);
    setSelectedRoute(null);
  }

  function handleRouteClick(event, route) {
    event.stopPropagation();
    setSelectedRoute(route);
    setSelectedPin(null);
  }

  function toggleRouteVisibility(routeId) {
    setHiddenRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  }

  function selectRouteFromList(route) {
    setSelectedRoute(route);
    setSelectedPin(null);
  }

  const sidebarCategories =
    pinCategories.length > 0
      ? [...pinCategories].sort((a, b) => {
          const orderA = typeof a.sortOrder === "number" ? a.sortOrder : 9999;
          const orderB = typeof b.sortOrder === "number" ? b.sortOrder : 9999;

          if (orderA !== orderB) return orderA - orderB;

          return a.label.localeCompare(b.label, "pt-BR", {
            sensitivity: "base",
          });
        })
      : [{ value: "geral", label: "Geral", sortOrder: 0 }];

  const pinGroups = sidebarCategories.map((category) => {
    const categoryPinTypes = pinTypes.filter(
      (type) => (type.category || "geral") === category.value
    );

    const types = categoryPinTypes
      .map((type) => {
        const count = pins.filter((pin) => {
          const pinIconKey = getPinIconKey(pin);
          return pinIconKey === type.iconKey;
        }).length;

        return {
          key: type.iconKey,
          label: type.typeName,
          icon: type.icon,
          iconType: type.iconType || "emoji",
          iconImageUrl: type.iconImageUrl || "",
          pinTypeId: type._id,
          count,
          iconKey: type.iconKey,
          category: type.category || "geral", // 🔥 ESSENCIAL
        };
      })
      .filter((type) => {
        if (hideEmptyGroups && type.count === 0) return false;

        if (!sidebarSearch.trim()) return true;

        return type.label
          .toLowerCase()
          .includes(sidebarSearch.toLowerCase());
      })
      .sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR", {
          sensitivity: "base",
        })
      );

    return {
      ...category,
      types,
      count: types.reduce((sum, type) => sum + type.count, 0),
    };
  });

  function toggleCategoryVisibility(category) {
    const typeKeys = category.types.map((type) => type.key);

    const allHidden = typeKeys.every((key) => hiddenPinTypes.includes(key));

    if (allHidden) {
      setHiddenPinTypes((prev) =>
        prev.filter((key) => !typeKeys.includes(key))
      );
    } else {
      setHiddenPinTypes((prev) => [...new Set([...prev, ...typeKeys])]);
    }
  }

  function togglePinTypeVisibility(typeKey) {
    setHiddenPinTypes((prev) =>
      prev.includes(typeKey)
        ? prev.filter((value) => value !== typeKey)
        : [...prev, typeKey]
    );
  }

  function showAllPins() {
    setHiddenPinTypes([]);
  }

  function hideAllPins() {
    setHiddenPinTypes(
      pinGroups.flatMap((category) => category.types.map((type) => type.key))
    );
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
      <aside className={sidebarCollapsed ? "mapSidebar collapsed" : "mapSidebar"}>
        <button
          className="sidebarCollapseButton"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>

        {!sidebarCollapsed && (
          <>
            <div className="sidebarHeader">
              <h2>{mapData.title}</h2>
              <p>Interactive Map</p>
            </div>

            <div className="sidebarActions">
              <button onClick={showAllPins}>Show All</button>
              <button onClick={hideAllPins}>Hide All</button>

              <button
                className={
                  hideEmptyGroups
                    ? "sidebarActionButton activeHidden"
                    : "sidebarActionButton"
                }
                onClick={() => setHideEmptyGroups((prev) => !prev)}
              >
                Hide Empty
              </button>
            </div>

            <div className="sidebarSearch">
              <input
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Search..."
              />
            </div>

            {pinGroups.length === 0 ? (
              <div className="sidebarPlaceholder">Nenhum pin encontrado.</div>
            ) : (
              <div className="sidebarCategoryList">
                {pinGroups.map((category) => {
                  const allHidden =
                    category.types.length > 0 &&
                    category.types.every((type) => hiddenPinTypes.includes(type.key));

                  return (
                    <div className="sidebarCategory" key={category.value}>
                      <button
                        className={
                          allHidden
                            ? "sidebarCategoryHeader activeHidden"
                            : "sidebarCategoryHeader"
                        }
                        onClick={() => toggleCategoryVisibility(category)}
                      >
                        <span>{category.label}</span>
                        <strong>{category.count}</strong>
                      </button>

                    <div className="sidebarTypeList">
                      {category.types.map((type) => {
                        const typeHidden = hiddenPinTypes.includes(type.key);

                        return (
                          <button
                            key={type.key}
                            className={
                              typeHidden
                                ? "sidebarTypeItem hidden"
                                : "sidebarTypeItem"
                            }
                            onClick={() => togglePinTypeVisibility(type.key)}
                          >
                            <span className="sidebarTypeIcon">
                              {type.iconType === "custom" &&
                              type.iconImageUrl ? (
                                <img src={type.iconImageUrl} alt={type.label} />
                              ) : (
                                type.icon || "📍"
                              )}
                            </span>

                            <span>{type.label}</span>
                            <strong>{type.count}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            <div className="sidebarSection">
              <h3>Rotas</h3>

              <div className="sidebarPlaceholder">
                Lista de rotas vai aparecer aqui.
              </div>
            </div>
          </>
        )}
      </aside>

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

          <button onClick={() => setRouteEffectsEnabled((prev) => !prev)}>
            {routeEffectsEnabled ? "Efeitos ON" : "Efeitos OFF"}
          </button>
        </div>

        <select
          className="filterSelect"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">Todas categorias</option>
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
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
                <div className="imageWrapper">
                  <img
                    src={mapData.imageUrl}
                    alt={mapData.title}
                    className="mapImage"
                    draggable="false"
                  />

                  <svg
                    className="routesLayer"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {routes
                      .filter((route) => !hiddenRouteIds.includes(route._id))
                      .map((route) => (
                        <polyline
                          key={route._id}
                          points={route.points
                            .map((p) => `${p.x},${p.y}`)
                            .join(" ")}
                          fill="none"
                          stroke={route.color || "#ef4444"}
                          strokeWidth={
                            selectedRoute?._id === route._id ||
                            hoveredRouteId === route._id
                              ? (route.width || 4) + 1
                              : route.width || 4
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="8 6"
                          className={
                            routeEffectsEnabled &&
                            (selectedRoute?._id === route._id ||
                              hoveredRouteId === route._id)
                              ? "routeLine routeLineActive"
                              : "routeLine"
                          }
                          opacity={
                            selectedRoute?._id && selectedRoute._id !== route._id
                              ? 0.35
                              : hoveredRouteId && hoveredRouteId !== route._id
                              ? 0.55
                              : 1
                          }
                          onMouseEnter={() => setHoveredRouteId(route._id)}
                          onMouseLeave={() => setHoveredRouteId(null)}
                          onClick={(event) => handleRouteClick(event, route)}
                        />
                      ))}
                  </svg>

                  {filteredPins.map((pin) => (
                    <button
                      key={pin._id}
                      className={
                        pin.iconType === "custom"
                          ? "pin customPin"
                          : "pin emojiPin"
                      }
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                      }}
                      onClick={(event) => handlePinClick(event, pin)}
                      title={pin.name}
                    >
                      {renderPinIcon(pin)}
                    </button>
                  ))}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </section>

      {routes.length > 0 && (
        <div className="routeSidebar">
          <h3>Rotas</h3>

          {routes.map((route) => {
            const isHidden = hiddenRouteIds.includes(route._id);
            const isSelected = selectedRoute?._id === route._id;

            return (
              <div
                className={
                  isSelected ? "routeSidebarItem selected" : "routeSidebarItem"
                }
                key={route._id}
              >
                <button
                  className="routeNameButton"
                  onClick={() => selectRouteFromList(route)}
                  title={route.name}
                >
                  <span
                    className="routeColorDot"
                    style={{ background: route.color || "#ef4444" }}
                  />

                  <span className={isHidden ? "routeHiddenText" : ""}>
                    {route.name}
                  </span>
                </button>

                <div className="routeSidebarActions">
                  <button onClick={() => toggleRouteVisibility(route._id)}>
                    {isHidden ? "Mostrar" : "Ocultar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPin && (
        <div className="popup">
          <button className="closeButton" onClick={() => setSelectedPin(null)}>
            ×
          </button>

          <div className="popupIcon">{renderPinIcon(selectedPin)}</div>

          <h2>{selectedPin.name}</h2>

          {selectedPin.description ? (
            <p>{selectedPin.description}</p>
          ) : (
            <p className="emptyText">Sem descrição.</p>
          )}

          <div className="pinCategory">
            Grupo:{" "}
            {pinCategories.find(
              (category) => category.value === (selectedPin.category || "geral")
            )?.label || "Geral"}
          </div>

          <div className="pinCategory">
            Categoria: {selectedPin.typeName || selectedPin.name}
          </div>

          <div className="coords">
            X: {selectedPin.x.toFixed(2)}% | Y: {selectedPin.y.toFixed(2)}%
          </div>
        </div>
      )}

      {selectedRoute && (
        <div className="popup">
          <button
            className="closeButton"
            onClick={() => setSelectedRoute(null)}
          >
            ×
          </button>

          <h2>{selectedRoute.name}</h2>

          <p className="emptyText">
            {selectedRoute.points.length} pontos nesta rota.
          </p>
        </div>
      )}

      
    </main>
  );
}