"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";
import PinSidebarContent from "@/app/components/map/PinSidebarContent";
import RouteSidebarContent from "@/app/components/map/RouteSidebarContent";
import MapLanguageSelect from "@/app/components/map/MapLanguageSelect";
import TiledMapLayer from "@/app/components/map/TiledMapLayer";
import AccountMenu from "@/app/components/AccountMenu";
import useMapLocale from "@/app/components/map/useMapLocale";
import { DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";

const DEFAULT_MAP_PIN_SIZE = 25;
const MIN_MAP_PIN_SIZE = 5;
const DEFAULT_MAP_ROUTE_SIZE = 25;
const MIN_MAP_ROUTE_SIZE = 5;
const DEFAULT_MAP_NOTE_SIZE = 25;
const MIN_MAP_NOTE_SIZE = 5;
const DEFAULT_ROUTE_WIDTH = 2;
const MAP_WHEEL_ZOOM_FACTOR = 1.12;
const MAP_MIN_SCALE = 0.2;
const MAP_MAX_SCALE = 24;
const OUTSIDE_MAP_INTERACTION_MARGIN = 500;
const DEFAULT_MAP_CONTENT_SIZE = { width: 1200, height: 675 };
const TOAST_DURATION_MS = 3200;
const TOAST_FADE_MS = 260;
const MAP_BROWSER_TITLE_MAX_LENGTH = 55;

function getPinBackgroundColor(value) {
  const color = String(value || "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#0f1014";
}

function getBrowserMapTitle(title) {
  const cleanTitle = String(title || "").trim() || "Interactive Map";

  if (cleanTitle.length <= MAP_BROWSER_TITLE_MAX_LENGTH) {
    return cleanTitle;
  }

  return `${cleanTitle.slice(0, MAP_BROWSER_TITLE_MAX_LENGTH - 3).trim()}...`;
}

function getRouteParamValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

export default function PublicMapPage() {
  const params = useParams();
  const mapId = getRouteParamValue(params?.id);
  const [activeMapId, setActiveMapId] = useState(mapId);
  const { locale, setLocale, t } = useMapLocale();

  const [mapData, setMapData] = useState(null);
  const [pins, setPins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [pinPopupPosition, setPinPopupPosition] = useState(null);
  const [mapScale, setMapScale] = useState(1);
  const mapScaleRef = useRef(1);
  const transformApiRef = useRef(null);
  const connectedMapsMenuRef = useRef(null);
  const [isMapPanning, setIsMapPanning] = useState(false);
  const [mapPinSize, setMapPinSize] = useState(DEFAULT_MAP_PIN_SIZE);
  const [mapRouteSize, setMapRouteSize] = useState(DEFAULT_MAP_ROUTE_SIZE);
  const [mapNoteSize, setMapNoteSize] = useState(DEFAULT_MAP_NOTE_SIZE);
  const [mapContentSize, setMapContentSize] = useState(DEFAULT_MAP_CONTENT_SIZE);
  const [mapMouseDownPoint, setMapMouseDownPoint] = useState(null);
  const mapMouseDownPointRef = useRef(null);
  const mapDragRef = useRef(false);
  const [activityStatus, setActivityStatus] = useState(null);
  const [activityStatusClosing, setActivityStatusClosing] = useState(false);
  const activityStatusTimeoutRef = useRef(null);
  const activityStatusFadeTimeoutRef = useRef(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("all");

  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState([]);
  const [connectedMaps, setConnectedMaps] = useState([]);
  const [connectedMapsOpen, setConnectedMapsOpen] = useState(false);

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

  useEffect(() => {
    if (mapId && mapId !== activeMapId) {
      setActiveMapId(mapId);
    }
  }, [mapId, activeMapId]);

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

  const mapEditorsCount = (() => {
    const editorKeys = new Set();
    const ownerKey = mapData?.ownerUsername || mapData?.ownerName;

    if (ownerKey) {
      editorKeys.add(`owner:${ownerKey}`);
    }

    const editors = Array.isArray(mapData?.editors) ? mapData.editors : [];

    editors.forEach((editor) => {
      const key =
        editor.userId ||
        editor.user_id ||
        editor.username ||
        editor.name;

      if (key) {
        editorKeys.add(`editor:${key}`);
      }
    });

    return Math.max(1, editorKeys.size);
  })();

  const routeLayerMarginX =
    (OUTSIDE_MAP_INTERACTION_MARGIN / mapContentSize.width) * 100;
  const routeLayerMarginY =
    (OUTSIDE_MAP_INTERACTION_MARGIN / mapContentSize.height) * 100;
  const routeLayerViewBox = [
    -routeLayerMarginX,
    -routeLayerMarginY,
    100 + routeLayerMarginX * 2,
    100 + routeLayerMarginY * 2,
  ].join(" ");

  function getRouteDisplayWidth(width) {
    const routeSize = Math.max(MIN_MAP_ROUTE_SIZE, mapRouteSize);
    return Math.max(0.2, Number(width || DEFAULT_ROUTE_WIDTH) * (routeSize / 100));
  }

  function getRouteDashArray() {
    const routeSize = Math.max(MIN_MAP_ROUTE_SIZE, mapRouteSize);
    const sizeRatio = routeSize / 100;
    const dash = Math.max(0.5, 8 * sizeRatio);
    const gap = Math.max(0.4, 6 * sizeRatio);
    return `${dash} ${gap}`;
  }

  function getRouteDashDistance() {
    const routeSize = Math.max(MIN_MAP_ROUTE_SIZE, mapRouteSize);
    const sizeRatio = routeSize / 100;
    const dash = Math.max(0.5, 8 * sizeRatio);
    const gap = Math.max(0.4, 6 * sizeRatio);
    return dash + gap;
  }

  function getPinZoomScale() {
    const zoom = Math.max(MAP_MIN_SCALE, mapScale);
    return Math.max(0.42, Math.min(1.75, 1 / Math.pow(zoom, 0.34)));
  }

  function updateMapScale(nextScale) {
    const scale = Number(nextScale) || 1;

    if (Math.abs(scale - mapScaleRef.current) < 0.01) return;

    mapScaleRef.current = scale;
    setMapScale(scale);
  }

  function centerMapAtPoint(point, animationTime = 180) {
    if (!point || !transformApiRef.current?.setTransform) return;

    const wrapper = document.querySelector(".transformWrapper");
    const content = document.querySelector(".imageWrapper");

    if (!wrapper || !content) return;

    const scale = transformApiRef.current.state?.scale || mapScaleRef.current || 1;
    const x = wrapper.clientWidth / 2 - content.offsetWidth * (point.x / 100) * scale;
    const y = wrapper.clientHeight / 2 - content.offsetHeight * (point.y / 100) * scale;

    transformApiRef.current.setTransform(x, y, scale, animationTime);
  }

  function getRouteCenterPoint(route) {
    const points = Array.isArray(route?.points) ? route.points : [];

    if (points.length === 0) return null;

    const xs = points.map((point) => Number(point.x)).filter(Number.isFinite);
    const ys = points.map((point) => Number(point.y)).filter(Number.isFinite);

    if (xs.length === 0 || ys.length === 0) return null;

    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }

  function centerMapOnRoute(route) {
    const point = getRouteCenterPoint(route);

    if (point) {
      centerMapAtPoint(point);
    }
  }

  function centerMapOnPin(pin) {
    if (!pin) return;

    centerMapAtPoint({
      x: Number(pin.x),
      y: Number(pin.y),
    });
  }

  function resetMapView(animationTime = 160) {
    const wrapper = document.querySelector(".transformWrapper");
    const content = document.querySelector(".imageWrapper");

    if (!wrapper || !content || !transformApiRef.current?.setTransform) return;

    const scale = 1;
    const x = (wrapper.clientWidth - content.offsetWidth * scale) / 2;
    const y = (wrapper.clientHeight - content.offsetHeight * scale) / 2;

    transformApiRef.current.setTransform(x, y, scale, animationTime);
  }

  useEffect(() => {
    async function loadMapAndPins() {
      if (!activeMapId) return;

      setLoaded(false);
      setSelectedPin(null);
      setSelectedRoute(null);
      setPinPopupPosition(null);
      setHiddenRouteIds([]);
      setHoveredRouteId(null);
      setConnectedMapsOpen(false);

      try {
        const mapResponse = await fetch(`/api/maps/${activeMapId}`);
        const mapResult = await mapResponse.json();

        if (!mapResponse.ok) {
          setMapData(null);
          return;
        }

        setMapData(mapResult.map);
        setMapPinSize(
          Math.max(MIN_MAP_PIN_SIZE, mapResult.map.pinSize ?? DEFAULT_MAP_PIN_SIZE)
        );
        setMapRouteSize(
          Math.max(
            MIN_MAP_ROUTE_SIZE,
            mapResult.map.routeSize ?? DEFAULT_MAP_ROUTE_SIZE
          )
        );
        setMapNoteSize(
          Math.max(
            MIN_MAP_NOTE_SIZE,
            mapResult.map.noteSize ?? DEFAULT_MAP_NOTE_SIZE
          )
        );

        if (typeof mapResult.map.routeEffectsEnabled === "boolean") {
          setRouteEffectsEnabled(mapResult.map.routeEffectsEnabled);
        }

        setLoaded(true);
        window.setTimeout(() => resetMapView(), 0);

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

        const pinsResponse = await fetch(`/api/maps/${activeMapId}/pins`);
        const pinsResult = await pinsResponse.json();

        if (pinsResponse.ok) {
          setPins(pinsResult.pins || []);
        }

        const routesResponse = await fetch(`/api/maps/${activeMapId}/routes`);
        const routesResult = await routesResponse.json();

        if (routesResponse.ok) {
          setRoutes(routesResult.routes || []);
        }

        const notesResponse = await fetch(`/api/maps/${activeMapId}/notes`);
        const notesResult = await notesResponse.json();

        if (notesResponse.ok) {
          setNotes(notesResult.notes || []);
        }

        const connectedResponse = await fetch(`/api/maps/${activeMapId}/connected`);
        const connectedResult = await connectedResponse.json();

        if (connectedResponse.ok) {
          setConnectedMaps(connectedResult.maps || []);
        } else {
          setConnectedMaps([]);
        }
      } catch (error) {
        console.error(error);
        setMapData(null);
        setConnectedMaps([]);
      } finally {
        setLoaded(true);
      }
    }

    loadMapAndPins();
  }, [activeMapId]);

  useEffect(() => {
    document.title = `${getBrowserMapTitle(mapData?.title)} - Map Builder`;
  }, [mapData?.title]);

  useEffect(() => {
    function handleBrowserNavigation() {
      const nextMapId = window.location.pathname.split("/").filter(Boolean).at(-1);

      if (nextMapId) {
        setActiveMapId(nextMapId);
      }
    }

    window.addEventListener("popstate", handleBrowserNavigation);

    return () => {
      window.removeEventListener("popstate", handleBrowserNavigation);
    };
  }, []);

  useEffect(() => {
    if (!connectedMapsOpen) return undefined;

    function closeConnectedMapsMenu(event) {
      if (connectedMapsMenuRef.current?.contains(event.target)) return;
      setConnectedMapsOpen(false);
    }

    document.addEventListener("pointerdown", closeConnectedMapsMenu);

    return () => {
      document.removeEventListener("pointerdown", closeConnectedMapsMenu);
    };
  }, [connectedMapsOpen]);

  useEffect(() => {
    localStorage.setItem(
      "routeEffectsEnabled",
      JSON.stringify(routeEffectsEnabled)
    );
  }, [routeEffectsEnabled]);

  useEffect(() => {
    return () => {
      if (activityStatusTimeoutRef.current) {
        clearTimeout(activityStatusTimeoutRef.current);
      }

      if (activityStatusFadeTimeoutRef.current) {
        clearTimeout(activityStatusFadeTimeoutRef.current);
      }
    };
  }, []);

  function showMapToast(message) {
    setActivityStatus(message);
    setActivityStatusClosing(false);

    if (activityStatusTimeoutRef.current) {
      clearTimeout(activityStatusTimeoutRef.current);
    }

    if (activityStatusFadeTimeoutRef.current) {
      clearTimeout(activityStatusFadeTimeoutRef.current);
    }

    activityStatusTimeoutRef.current = setTimeout(() => {
      setActivityStatusClosing(true);
      activityStatusFadeTimeoutRef.current = setTimeout(() => {
        setActivityStatus(null);
        setActivityStatusClosing(false);
      }, TOAST_FADE_MS);
    }, TOAST_DURATION_MS);
  }

  function copyPublicLink() {
    navigator.clipboard.writeText(`${window.location.origin}/map/${activeMapId}`);
    showMapToast("Public link copied");
  }

  function openShareModal() {
    setSelectedPin(null);
    setPinPopupPosition(null);
    setSelectedRoute(null);
    setShareModalOpen(true);
  }

  function updateMapContentSize(imageWrapper) {
    if (!imageWrapper) return;

    const nextWidth = imageWrapper.offsetWidth || imageWrapper.getBoundingClientRect().width;
    const nextHeight = imageWrapper.offsetHeight || imageWrapper.getBoundingClientRect().height;

    if (!nextWidth || !nextHeight) return;

    setMapContentSize((prev) => {
      if (prev.width === nextWidth && prev.height === nextHeight) {
        return prev;
      }

      return {
        width: nextWidth,
        height: nextHeight,
      };
    });
  }

  function getPinIconKey(pin) {
    if (pin.iconKey) return pin.iconKey;

    if (pin.iconType === "custom") {
      return `custom:${pin.iconImageUrl || ""}`;
    }

    return `emoji:${pin.icon || "📍"}`;
  }

  function getPinCategoryColor(pin) {
    const type = pinTypes.find((pinType) => pinType.iconKey === getPinIconKey(pin));

    return getPinBackgroundColor(type?.backgroundColor);
  }

  function renderPinIcon(pin) {
    if (pin.iconType === "custom" && pin.iconImageUrl) {
      return (
        <img src={pin.iconImageUrl} alt={pin.name} className="customPinIcon" />
      );
    }

    if (pin.icon) return pin.icon;

    return <img src={DEFAULT_PIN_ICON_URL} alt={pin.name || "Pin"} className="customPinIcon" />;
  }

  function getChainRequirementKey(requirement) {
    return (
      requirement?.pinId ||
      requirement?.key ||
      requirement?.iconKey ||
      `${requirement?.category || "geral"}:${requirement?.typeName || ""}`
    );
  }

  function renderChainRequirementIcon(requirement) {
    if (requirement.iconType === "custom" && requirement.iconImageUrl) {
      return <img src={requirement.iconImageUrl} alt={requirement.typeName || "Chain"} />;
    }

    if (requirement.icon) return requirement.icon;

    return <img src={DEFAULT_PIN_ICON_URL} alt={requirement.typeName || "Chain"} />;
  }

  function selectChainRequirementPin(requirement) {
    if (!requirement?.pinId) return;

    const targetPin = pins.find((pin) => pin._id === requirement.pinId);

    if (!targetPin) {
      showMapToast("Pin requirement not found");
      return;
    }

    setSelectedPin(targetPin);
    setSelectedRoute(null);
    setPinPopupPosition({
      x: targetPin.x,
      y: targetPin.y,
    });
    centerMapOnPin(targetPin);
  }

  function isPortalPin(pin) {
    return (
      pin?.systemType === "portal" ||
      ((pin?.category || "geral") === "system" &&
        (pin?.typeName || pin?.name) === "Portal")
    );
  }

  function teleportToMap(destinationMapId, destinationMapTitle = "destination map") {
    if (!destinationMapId) {
      showMapToast("Portal destination not configured");
      return false;
    }

    if (destinationMapId === activeMapId) {
      showMapToast("Already on this map");
      return true;
    }

    window.history.pushState(null, "", `/map/${destinationMapId}`);
    setActiveMapId(destinationMapId);
    setConnectedMapsOpen(false);
    showMapToast(`Loading ${destinationMapTitle || "destination map"}`);
    return true;
  }

  function openPortalDestination(pin) {
    return teleportToMap(pin?.destinationMapId, pin?.destinationMapTitle);
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
    centerMapOnRoute(route);
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
    centerMapOnRoute(route);
  }

  useEffect(() => {
    function isTypingTarget(target) {
      const tagName = target?.tagName?.toLowerCase();

      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable
      );
    }

    function selectRouteByKeyboard(route) {
      setSelectedRoute(route);
      setSelectedPin(null);
      setPinPopupPosition(null);
      centerMapOnRoute(route);
    }

    function selectPinByKeyboard(pin) {
      setSelectedPin(pin);
      setSelectedRoute(null);
      setPinPopupPosition({
        x: pin.x,
        y: pin.y,
      });
      centerMapOnPin(pin);
    }

    function handleKeyboardNavigation(event) {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return;
      }
      if (isTypingTarget(event.target)) return;

      const direction =
        event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;

      if (selectedRoute) {
        const visibleRoutes = orderedRoutes.filter(
          (route) => !hiddenRouteIds.includes(route._id)
        );
        const currentIndex = visibleRoutes.findIndex(
          (route) => route._id === selectedRoute._id
        );

        if (visibleRoutes.length === 0 || currentIndex === -1) return;

        event.preventDefault();
        const nextIndex =
          (currentIndex + direction + visibleRoutes.length) % visibleRoutes.length;
        selectRouteByKeyboard(visibleRoutes[nextIndex]);
        return;
      }

      if (selectedPin) {
        const selectedPinKey = getPinIconKey(selectedPin);
        const categoryPins = pins.filter(
          (pin) =>
            getPinIconKey(pin) === selectedPinKey &&
            !hiddenPinTypes.includes(getPinIconKey(pin))
        );
        const currentIndex = categoryPins.findIndex(
          (pin) => pin._id === selectedPin._id
        );

        if (categoryPins.length === 0 || currentIndex === -1) return;

        event.preventDefault();
        const nextIndex =
          (currentIndex + direction + categoryPins.length) % categoryPins.length;
        selectPinByKeyboard(categoryPins[nextIndex]);
      }
    }

    window.addEventListener("keydown", handleKeyboardNavigation);

    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation);
    };
  // Keyboard navigation intentionally reads the latest render state from this scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hiddenPinTypes,
    hiddenRouteIds,
    orderedRoutes,
    pins,
    selectedPin,
    selectedRoute,
  ]);

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
      setIsMapPanning(true);
    }
  }

  function handleMapMouseUp(event) {
    setIsMapPanning(false);

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
          backgroundColor: getPinBackgroundColor(type.backgroundColor),
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

  function getRoutesExportBaseName() {
    return (
      (mapData?.title || "map")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "map"
    );
  }

  function downloadRoutesFile(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function escapeXml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function getExportableRoutes() {
    return orderedRoutes.filter((route) => !hiddenRouteIds.includes(route._id));
  }

  function exportRoutesTxt() {
    const exportableRoutes = getExportableRoutes();

    if (exportableRoutes.length === 0) return;

    const content = exportableRoutes
      .map(
        (route) =>
          `T\u00edtulo: ${route.name || "Sem nome"}\nDescri\u00e7\u00e3o: ${
            route.description || ""
          }`
      )
      .join("\n\n");

    downloadRoutesFile(
      content,
      `${getRoutesExportBaseName()}-routes.txt`,
      "text/plain;charset=utf-8"
    );
  }

  function exportRoutesLivesplit() {
    const exportableRoutes = getExportableRoutes();

    if (exportableRoutes.length === 0) return;

    const segments = exportableRoutes
      .map(
        (route) => `    <Segment>
      <Name>${escapeXml(route.name || "Sem nome")}</Name>
      <Icon />
      <SplitTimes>
        <SplitTime name="Personal Best" />
      </SplitTimes>
      <BestSegmentTime />
      <SegmentHistory />
    </Segment>`
      )
      .join("\n");

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<Run version="1.7.0">
  <GameIcon />
  <GameName>
  </GameName>
  <CategoryName>
  </CategoryName>
  <LayoutPath>
  </LayoutPath>
  <Metadata>
    <Run id="" />
    <Platform usesEmulator="False">
    </Platform>
    <Region>
    </Region>
    <Variables />
    <CustomVariables />
  </Metadata>
  <Offset>00:00:00</Offset>
  <AttemptCount>0</AttemptCount>
  <AttemptHistory />
  <Segments>
${segments}
  </Segments>
  <AutoSplitterSettings />
</Run>`;

    downloadRoutesFile(
      content,
      `${getRoutesExportBaseName()}-livesplit.lss`,
      "application/xml;charset=utf-8"
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
              exportTxt: t("route.exportTxt"),
              exportLivesplit: t("route.exportLivesplit"),
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
            onExportTxtRoutes={exportRoutesTxt}
            onExportLivesplitRoutes={exportRoutesLivesplit}
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
              <strong>{mapEditorsCount}</strong>
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
            <button
              className="publicLinkButton"
              onClick={openShareModal}
            >
              Share
            </button>

            <MapLanguageSelect locale={locale} onLocaleChange={setLocale} />
            <AccountMenu />
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

      <section
        className="mapArea"
        onMouseDown={handleMapMouseDown}
        onMouseUp={handleMapMouseUp}
        onMouseMove={handleMapMouseMove}
      >
        <TransformWrapper
          initialScale={1}
          minScale={MAP_MIN_SCALE}
          maxScale={MAP_MAX_SCALE}
          wheel={{
            disabled: true,
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
          onInit={(ref) => {
            transformApiRef.current = ref;
            updateMapScale(ref.state.scale);
          }}
          onTransform={(ref) => {
            transformApiRef.current = ref;
            updateMapScale(ref.state.scale);
          }}
          onPanningStart={() => setIsMapPanning(true)}
          onPanningStop={() => setIsMapPanning(false)}
        >
          {({ zoomIn, zoomOut, resetTransform, setTransform, state }) => {
            function centerMap() {
              const wrapper = document.querySelector(".transformWrapper");
              const content = document.querySelector(".imageWrapper");

              if (!wrapper || !content) return;

              const scale = 1;
              const x = (wrapper.clientWidth - content.offsetWidth * scale) / 2;
              const y = (wrapper.clientHeight - content.offsetHeight * scale) / 2;

              setTransform(x, y, scale, 200);
            }

            function handleWheelZoom(event) {
              event.preventDefault();
              event.stopPropagation();

              const wrapper = event.currentTarget;
              const rect = wrapper.getBoundingClientRect();
              const direction = event.deltaY < 0 ? 1 : -1;
              const nextScale =
                direction > 0
                  ? Math.min(MAP_MAX_SCALE, state.scale * MAP_WHEEL_ZOOM_FACTOR)
                  : Math.max(MAP_MIN_SCALE, state.scale / MAP_WHEEL_ZOOM_FACTOR);

              if (nextScale === state.scale) return;

              const mouseX = event.clientX - rect.left;
              const mouseY = event.clientY - rect.top;
              const contentX = (mouseX - state.positionX) / state.scale;
              const contentY = (mouseY - state.positionY) / state.scale;
              const nextX = mouseX - contentX * nextScale;
              const nextY = mouseY - contentY * nextScale;

              setTransform(nextX, nextY, nextScale, 0);
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

                <div className="mapControlsRow" ref={connectedMapsMenuRef}>
                  <button
                    onClick={() => setConnectedMapsOpen((prev) => !prev)}
                    title="Connected maps"
                    aria-label="Connected maps"
                    className="mapConnectedControlButton"
                  >
                    <img src="/site-icons/map_connected_icon.svg" alt="" />
                  </button>

                <button onClick={centerMap} title={t("map.center")}>
                  🎯
                </button>
                  {connectedMapsOpen && (
                    <div className="connectedMapsMenu">
                      {connectedMaps.length === 0 ? (
                        <span>No connected maps</span>
                      ) : (
                        connectedMaps.map((connectedMap) => (
                          <button
                            key={connectedMap._id}
                            onClick={() =>
                              teleportToMap(
                                connectedMap._id,
                                connectedMap.title || "destination map"
                              )
                            }
                          >
                            <img src="/site-icons/map_connected.svg" alt="" />
                            <span>{connectedMap.title || "Untitled map"}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <TransformComponent
                wrapperClass="transformWrapper"
                contentClass="transformContent"
                wrapperStyle={{ background: "#0b0b10" }}
                wrapperProps={{ onWheel: handleWheelZoom }}
              >
                <div
                  className={isMapPanning ? "imageWrapper mapPanning" : "imageWrapper"}
                  style={{
                    "--map-pin-scale": mapPinSize / 50,
                    "--map-pin-zoom-scale": getPinZoomScale(),
                    "--map-note-scale": mapNoteSize / 50,
                  }}
                >
                  <TiledMapLayer
                    key={activeMapId}
                    map={mapData}
                    scale={mapScale}
                    onLoad={() => {
                      updateMapContentSize(document.querySelector(".imageWrapper"));
                      window.setTimeout(() => resetMapView(), 0);
                    }}
                  />

                  <svg
                    className="routesLayer"
                    viewBox={routeLayerViewBox}
                    preserveAspectRatio="none"
                    style={{
                      inset: "auto",
                      left: -OUTSIDE_MAP_INTERACTION_MARGIN,
                      top: -OUTSIDE_MAP_INTERACTION_MARGIN,
                      width: `calc(100% + ${OUTSIDE_MAP_INTERACTION_MARGIN * 2}px)`,
                      height: `calc(100% + ${OUTSIDE_MAP_INTERACTION_MARGIN * 2}px)`,
                    }}
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
                              ? getRouteDisplayWidth(route.width || DEFAULT_ROUTE_WIDTH) + 1
                              : getRouteDisplayWidth(route.width || DEFAULT_ROUTE_WIDTH)
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={getRouteDashArray()}
                          style={{
                            "--route-dash-offset": `-${getRouteDashDistance()}`,
                          }}
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

                  {notes.map((note) => (
                    <div
                      key={note._id}
                      className="mapNote publicMapNote"
                      style={{
                        left: `${note.x}%`,
                        top: `${note.y}%`,
                        width: `${note.width}%`,
                        height: `${note.height}%`,
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onMouseMove={(event) => event.stopPropagation()}
                      onMouseUp={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {note.title && <strong>{note.title}</strong>}
                      <p>{note.text}</p>
                    </div>
                  ))}

                  {filteredPins.map((pin) => (
                    <button
                      key={pin._id}
                      className={[
                        "pin",
                        pin.iconType === "custom" ? "customPin" : "emojiPin",
                        (pin.category || "geral") === "system" ? "systemPin" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                        "--pin-bg": getPinCategoryColor(pin),
                      }}
                      onClick={(event) => handlePinClick(event, pin)}
                      title={pin.name}
                    >
                      <span className="pinIconContent">
                        {renderPinIcon(pin)}
                      </span>
                    </button>
                  ))}

                  {selectedPin && pinPopupPosition && (
                    <div
                      className="mapAttachedPopup"
                      style={{
                        left: `${pinPopupPosition.x}%`,
                        top: `${pinPopupPosition.y}%`,
                        "--popup-scale": 1 / mapScale,
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onMouseUp={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="pinInfoPopup">
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

                      {Array.isArray(selectedPin.chainRequirements) &&
                        selectedPin.chainRequirements.length > 0 && (
                          <div className="pinPopupChain">
                            <strong>Chain Requirements</strong>
                            <div className="pinPopupChainBadges">
                              {selectedPin.chainRequirements.map((requirement) => (
                                <button
                                  type="button"
                                  key={getChainRequirementKey(requirement)}
                                  className={
                                    requirement.kind === "pin" || requirement.pinId
                                      ? "pinPopupChainBadge pinPopupChainBadgeButton"
                                      : "pinPopupChainBadge"
                                  }
                                  disabled={!(requirement.kind === "pin" || requirement.pinId)}
                                  onClick={
                                    requirement.kind === "pin" || requirement.pinId
                                      ? () => selectChainRequirementPin(requirement)
                                      : undefined
                                  }
                                >
                                  {renderChainRequirementIcon(requirement)}
                                  {requirement.typeName || requirement.label}
                                </button>
                              ))}
                            </div>

                            {selectedPin.chainDescription && (
                              <p>{selectedPin.chainDescription}</p>
                            )}
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

                      {isPortalPin(selectedPin) && (
                        <div className="pinPopupActions">
                          <button
                            className="secondary"
                            onClick={() => openPortalDestination(selectedPin)}
                          >
                            Teleport
                          </button>
                        </div>
                      )}
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

      {shareModalOpen && (
        <div className="modalOverlay" onClick={() => setShareModalOpen(false)}>
          <div
            className="modal smallModal shareMapModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="closeButton"
              onClick={() => setShareModalOpen(false)}
            >
              {"\u00D7"}
            </button>

            <h2>Share map</h2>
            <p className="modalSubtitle">
              O mapa precisa estar como publico ou nao-listado para que outros
              usuarios possam visualizar.
            </p>

            <label>
              Link
              <input
                readOnly
                value={
                  typeof window === "undefined"
                    ? ""
                    : `${window.location.origin}/map/${activeMapId}`
                }
                onFocus={(event) => event.target.select()}
              />
            </label>

            <div className="modalActions">
              <button className="primary" onClick={copyPublicLink}>
                Copy link
              </button>

              <button
                className="secondary"
                onClick={() => setShareModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {activityStatus && (
        <div
          className={
            activityStatusClosing
              ? "mapActivityStatus mapActivityStatusClosing"
              : "mapActivityStatus"
          }
        >
          {activityStatus}
        </div>
      )}

    </main>
  );
}
