"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";
import PinSidebarContent from "@/app/components/map/PinSidebarContent";
import RouteSidebarContent from "@/app/components/map/RouteSidebarContent";
import MapLanguageSelect from "@/app/components/map/MapLanguageSelect";
import useMapLocale from "@/app/components/map/useMapLocale";

export default function PublicMapPage() {
  const params = useParams();
  const mapId = params.id;
  const { locale, setLocale, t } = useMapLocale();

  const [mapData, setMapData] = useState(null);
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [pinPopupPosition, setPinPopupPosition] = useState(null);
  const [mapMouseDownPoint, setMapMouseDownPoint] = useState(null);
  const mapMouseDownPointRef = useRef(null);
  const mapDragRef = useRef(false);

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
  const [routeSidebarCollapsed, setRouteSidebarCollapsed] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");

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

  const orderedRoutes = [...routes].sort((a, b) => {
    const orderA = typeof a.sortOrder === "number" ? a.sortOrder : 9999;
    const orderB = typeof b.sortOrder === "number" ? b.sortOrder : 9999;

    if (orderA !== orderB) return orderA - orderB;

    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const filteredRoutes = orderedRoutes.filter((route) =>
    route.name.toLowerCase().includes(routeSearch.toLowerCase())
  );

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

    if (mapDragRef.current) return;

    setSelectedPin(pin);
    setSelectedRoute(null);
    setPinPopupPosition({
      x: pin.x,
      y: pin.y,
    });
  }

  function handleRouteClick(event, route) {
    event.stopPropagation();

    if (mapDragRef.current) return;

    if (selectedRoute?._id === route._id) {
      setSelectedRoute(null);
      return;
    }

    setSelectedRoute(route);
    setSelectedPin(null);
    setPinPopupPosition(null);
  }

  function toggleRouteVisibility(routeId) {
    setHiddenRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  }

  function selectRouteFromList(route) {
    if (selectedRoute?._id === route._id) {
      setSelectedRoute(null);
      return;
    }

    setSelectedRoute(route);
    setSelectedPin(null);
    setPinPopupPosition(null);
  }

  function clearMapSelection() {
    setSelectedPin(null);
    setSelectedRoute(null);
    setPinPopupPosition(null);
  }

  function handleMapMouseDown(event) {
    const point = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    mapMouseDownPointRef.current = point;
    mapDragRef.current = false;
    setMapMouseDownPoint(point);
  }

  function handleMapMouseMove(event) {
    const point = mapMouseDownPointRef.current;

    if (!point) return;

    const distance = Math.hypot(
      event.clientX - point.clientX,
      event.clientY - point.clientY
    );

    if (distance > 4) {
      mapDragRef.current = true;
    }
  }

  function handleMapMouseUp(event) {
    const point = mapMouseDownPointRef.current || mapMouseDownPoint;

    if (!point) return;

    const distance = Math.hypot(
      event.clientX - point.clientX,
      event.clientY - point.clientY
    );

    mapMouseDownPointRef.current = null;
    setMapMouseDownPoint(null);

    if (distance <= 4) {
      clearMapSelection();
    }
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

  function showAllRoutes() {
    setHiddenRouteIds([]);
  }

  function hideAllRoutes() {
    setHiddenRouteIds(routes.map((route) => route._id));
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
          <PinSidebarContent
            title={mapData.title}
            subtitle={t("map.interactiveMap")}
            pinGroups={pinGroups}
            hiddenPinTypes={hiddenPinTypes}
            hideEmptyGroups={hideEmptyGroups}
            search={sidebarSearch}
            emptyText={t("pin.empty")}
            labels={{
              showAll: t("actions.showAll"),
              hideAll: t("actions.hideAll"),
              hideEmpty: t("actions.hideEmpty"),
              search: t("common.search"),
              manage: t("actions.managePinGroups"),
            }}
            onSearchChange={setSidebarSearch}
            onShowAll={showAllPins}
            onHideAll={hideAllPins}
            onToggleHideEmpty={() => setHideEmptyGroups((prev) => !prev)}
            onToggleCategoryVisibility={toggleCategoryVisibility}
            onTogglePinTypeVisibility={togglePinTypeVisibility}
          />
        )}

      </aside>

      <aside
        className={
          routeSidebarCollapsed
            ? "mapSidebar routeMapSidebar collapsed"
            : "mapSidebar routeMapSidebar"
        }
      >
        <button
          className="sidebarCollapseButton"
          onClick={() => setRouteSidebarCollapsed((prev) => !prev)}
        >
          {routeSidebarCollapsed ? "‹" : "›"}
        </button>

        {!routeSidebarCollapsed && (
          <RouteSidebarContent
            routes={routes}
            filteredRoutes={filteredRoutes}
            hiddenRouteIds={hiddenRouteIds}
            selectedRoute={selectedRoute}
            routeSearch={routeSearch}
            routeEffectsEnabled={routeEffectsEnabled}
            labels={{
              title: t("route.title"),
              count: t("route.count"),
              showAll: t("actions.showAll"),
              hideAll: t("actions.hideAll"),
              effectOn: t("route.effectOn"),
              effectOff: t("route.effectOff"),
              search: t("route.search"),
              manage: t("actions.orderRoutes"),
              empty: t("route.empty"),
              showRoute: t("route.show"),
              hideRoute: t("route.hide"),
              noDescription: t("common.noDescription"),
            }}
            onSearchChange={setRouteSearch}
            onShowAll={showAllRoutes}
            onHideAll={hideAllRoutes}
            onToggleEffects={() => setRouteEffectsEnabled((prev) => !prev)}
            onSelectRoute={selectRouteFromList}
            onToggleRouteVisibility={toggleRouteVisibility}
          />
        )}
      </aside>

      <header className="topbar editorTopbar publicTopbar">
        <div>
          <h1>{mapData.title}</h1>
          <p>{t("map.publicView")}</p>
        </div>

        <div className="topbarActions">
          <div className="headerStats" aria-label="Estatisticas do mapa">
            <span>
              {t("stats.pins")}
              <strong>{pins.length}</strong>
            </span>

            <span>
              {t("stats.editors")}
              <strong>0</strong>
            </span>

            <span>
              {t("stats.categories")}
              <strong>{pinTypes.length}</strong>
            </span>

            <span>
              {t("stats.routes")}
              <strong>{routes.length}</strong>
            </span>
          </div>

          <div className="headerMainActions">
          <span>{pins.length} pins</span>

          <Link className="backLink" href="/">
            {t("actions.dashboard")}
          </Link>
          </div>

          <div className="headerSettings">
            <MapLanguageSelect locale={locale} onLocaleChange={setLocale} />
          </div>
        </div>

        <select
          className="filterSelect"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">{t("categories.all")}</option>
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
          minScale={0.2}
          maxScale={4}
          wheel={{
            step: 0.002,
            smoothStep: 0.006,
          }}
          doubleClick={{ disabled: true }}
          limitToBounds={false}
          centerOnInit={true}
          centerZoomedOut={false}
          zoomAnimation={{
            disabled: false,
            animationTime: 80,
            size: 0.15,
          }}
          alignmentAnimation={{ disabled: true }}
          velocityAnimation={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform, setTransform }) => {
            function centerMap() {
              const wrapper = document.querySelector(".transformWrapper");
              const content = document.querySelector(".imageWrapper");

              if (!wrapper || !content) return;

              const scale = 1;
              const x = (wrapper.clientWidth - content.offsetWidth * scale) / 2;
              const y = (wrapper.clientHeight - content.offsetHeight * scale) / 2;

              setTransform(x, y, scale, 200);
            }

            return (
            <>
              <div
                className={
                  routeSidebarCollapsed
                    ? "mapControls"
                    : "mapControls mapControlsWithRouteSidebar"
                }
              >
                <button onClick={() => zoomIn()} title={t("map.zoomIn")}>
                  +
                </button>

                <button onClick={() => zoomOut()} title={t("map.zoomOut")}>
                  -
                </button>

                <button onClick={centerMap} title={t("map.center")}>
                  🎯
                </button>
              </div>

              <TransformComponent
                wrapperClass="transformWrapper"
                contentClass="transformContent"
                wrapperStyle={{ background: "#0b0b10" }}
              >
                <div
                  className="imageWrapper"
                  onMouseDown={handleMapMouseDown}
                  onMouseUp={handleMapMouseUp}
                  onMouseMove={handleMapMouseMove}
                >
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

                  {selectedPin && pinPopupPosition && (
                    <div
                      className="pinInfoPopup mapAttachedPopup"
                      style={{
                        left: `${pinPopupPosition.x}%`,
                        top: `${pinPopupPosition.y}%`,
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onMouseUp={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        className="pinPopupClose"
                        onClick={() => {
                          setSelectedPin(null);
                          setPinPopupPosition(null);
                        }}
                      >
                        ×
                      </button>

                      <div className="pinPopupHeader">
                        <div className="pinPopupIcon">{renderPinIcon(selectedPin)}</div>

                        <div className="pinPopupTitle">
                          {selectedPin.name || t("common.noName")}
                        </div>
                      </div>

                      {selectedPin.description ? (
                        <div className="pinPopupDescription">
                          {selectedPin.description}
                        </div>
                      ) : (
                        <div className="pinPopupDescription emptyText">
                          {t("common.noDescription")}
                        </div>
                      )}

                      <div className="pinPopupMeta">
                        <div>
                          <strong>{t("common.group")}:</strong>{" "}
                          {pinGroups.find(
                            (group) =>
                              group.value === (selectedPin.category || "geral")
                          )?.label || "—"}
                        </div>

                        <div>
                          <strong>{t("common.category")}:</strong>{" "}
                          {selectedPin.typeName || selectedPin.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TransformComponent>
            </>
            );
          }}
        </TransformWrapper>
      </section>

    </main>
  );
}
