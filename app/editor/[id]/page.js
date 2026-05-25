"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";
import { DEFAULT_ICONS, DEFAULT_PIN_ICON_URL } from "@/lib/constants/icons";
import PinSidebarContent from "@/app/components/map/PinSidebarContent";
import RouteSidebarContent from "@/app/components/map/RouteSidebarContent";
import MapLanguageSelect from "@/app/components/map/MapLanguageSelect";
import TiledMapLayer from "@/app/components/map/TiledMapLayer";
import AccountMenu from "@/app/components/AccountMenu";
import useMapLocale from "@/app/components/map/useMapLocale";
import { MAP_ACCESS } from "@/lib/mapAccess";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "bau", label: "BaÃº" },
  { value: "boss", label: "Boss" },
  { value: "npc", label: "NPC" },
  { value: "item", label: "Item" },
  { value: "segredo", label: "Segredo" },
];

const OUTSIDE_MAP_INTERACTION_MARGIN = 500;
const DEFAULT_MAP_CONTENT_SIZE = { width: 1200, height: 675 };
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
const DEFAULT_PIN_ICON = "\uD83D\uDCCD";
const DEFAULT_PIN_ICON_TYPE = "custom";
const DEFAULT_PIN_ICON_IMAGE_URL = DEFAULT_PIN_ICON_URL;
const TOAST_DURATION_MS = 3200;
const TOAST_FADE_MS = 260;
const ROUTE_COLOR_PRESETS = ["#3b82f6", "#ef4444", "#22c55e"];
const PIN_COLOR_PRESETS = ["#3b82f6", "#ef4444", "#22c55e"];
const MAX_GROUP_NAME_LENGTH = 15;
const MAX_CATEGORY_NAME_LENGTH = 15;
const MAX_ROUTE_TITLE_LENGTH = 30;
const MAX_ROUTE_DESCRIPTION_LENGTH = 250;
const MAX_NOTE_TITLE_LENGTH = 80;
const MAX_NOTE_TEXT_LENGTH = 1000;
const SYSTEM_PIN_CATEGORY_VALUE = "system";
const PORTAL_SYSTEM_TYPE = "portal";
const PORTAL_TYPE_NAME = "Portal";

function normalizeHexColor(value) {
  const color = String(value || "").trim();
  const withHash = color.startsWith("#") ? color : `#${color}`;

  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    return `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`.toLowerCase();
  }

  return null;
}

function getPinBackgroundColor(value) {
  return normalizeHexColor(value || "#0f1014") || "#0f1014";
}

function normalizePinIcon(icon) {
  if (!icon || typeof icon !== "string") {
    return DEFAULT_PIN_ICON;
  }

  const trimmedIcon = icon.trim();

  if (!trimmedIcon || trimmedIcon.includes("ðŸ") || trimmedIcon.includes("�")) {
    return DEFAULT_PIN_ICON;
  }

  return trimmedIcon;
}

function getDefaultIconOption(icon) {
  if (typeof icon === "string") {
    return {
      icon,
      iconType: "emoji",
      iconImageUrl: "",
      key: `emoji:${icon}`,
      label: icon,
    };
  }

  const iconImageUrl = String(icon?.iconImageUrl || "");
  const iconType = icon?.iconType === "custom" ? "custom" : "emoji";
  const fallbackIcon = iconType === "emoji" ? normalizePinIcon(icon?.icon) : "";

  return {
    icon: fallbackIcon,
    iconType,
    iconImageUrl,
    key:
      icon?.key ||
      (iconType === "custom" ? `custom:${iconImageUrl}` : `emoji:${fallbackIcon}`),
    label: icon?.label || fallbackIcon || "Icon",
  };
}

function isDefaultPinIconImageUrl(iconImageUrl) {
  return String(iconImageUrl || "").includes("/api/pin-icons/");
}

function getPublicUsername(value, fallback = "USER") {
  const username = String(value || "").trim();

  if (!username || username.includes("@")) {
    return fallback;
  }

  return username.slice(0, 15);
}

export default function EditorPage() {
  const params = useParams();
  const mapId = params.id;
  const { locale, setLocale, t } = useMapLocale();

  const [mapData, setMapData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [pins, setPins] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedPin, setSelectedPin] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [pendingPosition, setPendingPosition] = useState(null);
  const [chainModalOpen, setChainModalOpen] = useState(false);
  const [chainChoiceOpen, setChainChoiceOpen] = useState(false);
  const [chainPin, setChainPin] = useState(null);
  const [chainPinPickTarget, setChainPinPickTarget] = useState(null);
  const [chainForm, setChainForm] = useState({
    requirements: [],
    description: "",
  });
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [destinationPin, setDestinationPin] = useState(null);
  const [destinationMaps, setDestinationMaps] = useState([]);
  const [destinationMapId, setDestinationMapId] = useState("");
  const [destinationLoading, setDestinationLoading] = useState(false);

  const [isAddingPin, setIsAddingPin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [mapAccess, setMapAccess] = useState(MAP_ACCESS.public);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assets, setAssets] = useState([]);

  const [pinCategories, setPinCategories] = useState([]);
  const [pinTypes, setPinTypes] = useState([]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [hiddenPinTypes, setHiddenPinTypes] = useState([]);
  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);
  const [manageGroupsModalOpen, setManageGroupsModalOpen] = useState(false);

  const [expandedManageItem, setExpandedManageItem] = useState(null);
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [moveMode, setMoveMode] = useState(false);
  const [moveTargetGroup, setMoveTargetGroup] = useState("");
  const [groupOrderDirty, setGroupOrderDirty] = useState(false);
  const [savingGroupOrder, setSavingGroupOrder] = useState(false);
  const groupOrderSnapshotRef = useRef(null);

  const [createMode, setCreateMode] = useState(null);
  const [createValue, setCreateValue] = useState("");
  const [createCategoryIcon, setCreateCategoryIcon] = useState(DEFAULT_PIN_ICON);
  const [createCategoryColor, setCreateCategoryColor] = useState("#0f1014");
  const [recentCategoryColors, setRecentCategoryColors] = useState([]);
  const [categoryColorModal, setCategoryColorModal] = useState(null);

  const [createCategoryIconType, setCreateCategoryIconType] = useState(DEFAULT_PIN_ICON_TYPE);
  const [createCategoryIconImageUrl, setCreateCategoryIconImageUrl] = useState(DEFAULT_PIN_ICON_IMAGE_URL);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTab, setIconPickerTab] = useState("default");
  const [contextMenu, setContextMenu] = useState(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteDragStart, setNoteDragStart] = useState(null);
  const [noteDraftRect, setNoteDraftRect] = useState(null);
  const [noteForm, setNoteForm] = useState({
    title: "",
    text: "",
  });
  const noteMoveRef = useRef(null);
  const noteMoveCleanupRef = useRef(null);

  const [routeMouseDownPoint, setRouteMouseDownPoint] = useState(null);

  const [routeSidebarCollapsed, setRouteSidebarCollapsed] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");

  const [mapMouseDownPoint, setMapMouseDownPoint] = useState(null);
  const mapMouseDownPointRef = useRef(null);
  const mapDragRef = useRef(false);

  const [iconPickerMode, setIconPickerMode] = useState("create");
  const [editingIconCategory, setEditingIconCategory] = useState(null);
  const [iconPickerDraft, setIconPickerDraft] = useState(null);

  const [activeManageUI, setActiveManageUI] = useState(null);

  const [manageRoutesModalOpen, setManageRoutesModalOpen] = useState(false);
  const [routeOrderDraft, setRouteOrderDraft] = useState([]);

  const [movingPin, setMovingPin] = useState(null);
  const [movingPinPosition, setMovingPinPosition] = useState(null);

  const [confirmMovePinOpen, setConfirmMovePinOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [siteAlert, setSiteAlert] = useState(null);


  const [form, setForm] = useState({
    name: "",
    typeName: "",
    description: "",
    icon: DEFAULT_PIN_ICON,
    iconType: DEFAULT_PIN_ICON_TYPE,
    iconImageUrl: DEFAULT_PIN_ICON_IMAGE_URL,
    category: "geral",
  });

  const [routes, setRoutes] = useState([]);
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeColor, setRouteColor] = useState("#3b82f6");
  const [recentRouteColors, setRecentRouteColors] = useState([]);
  const [routeColorPickerOpen, setRouteColorPickerOpen] = useState(false);
  const routeColorPickerRef = useRef(null);
  const [supporterFeatureModal, setSupporterFeatureModal] = useState(null);
  const [routeWidth, setRouteWidth] = useState(DEFAULT_ROUTE_WIDTH);
  const [mousePoint, setMousePoint] = useState(null);

  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [editingRouteData, setEditingRouteData] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState([]);
  const [connectedMaps, setConnectedMaps] = useState([]);
  const [connectedMapsOpen, setConnectedMapsOpen] = useState(false);

  const [pinPopupPosition, setPinPopupPosition] = useState(null);
  const [mapScale, setMapScale] = useState(1);
  const mapScaleRef = useRef(1);
  const transformApiRef = useRef(null);
  const connectedMapsMenuRef = useRef(null);
  const headerConfigMenuRef = useRef(null);
  const [isMapPanning, setIsMapPanning] = useState(false);
  const [mapPinSize, setMapPinSize] = useState(DEFAULT_MAP_PIN_SIZE);
  const [mapRouteSize, setMapRouteSize] = useState(DEFAULT_MAP_ROUTE_SIZE);
  const [mapNoteSize, setMapNoteSize] = useState(DEFAULT_MAP_NOTE_SIZE);
  const [mapContentSize, setMapContentSize] = useState(DEFAULT_MAP_CONTENT_SIZE);
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  const [scaleSettingsOpen, setScaleSettingsOpen] = useState(false);
  const [headerConfigMenuOpen, setHeaderConfigMenuOpen] = useState(false);
  const [headerConfigMenuPosition, setHeaderConfigMenuPosition] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [savingMapSettings, setSavingMapSettings] = useState(false);
  const [addEditorOpen, setAddEditorOpen] = useState(false);
  const [editorSearch, setEditorSearch] = useState("");
  const [editorSearchResults, setEditorSearchResults] = useState([]);
  const [editorSearchLoading, setEditorSearchLoading] = useState(false);
  const [editorPermissionDrafts, setEditorPermissionDrafts] = useState({});
  const [mapSettingsForm, setMapSettingsForm] = useState({
    title: "",
    description: "",
    tags: "",
    visibility: "public",
    routeEffectsEnabled: true,
  });
  const [scaleSettingsForm, setScaleSettingsForm] = useState({
    pinSize: DEFAULT_MAP_PIN_SIZE,
    routeSize: DEFAULT_MAP_ROUTE_SIZE,
    noteSize: DEFAULT_MAP_NOTE_SIZE,
  });
  const [activityStatus, setActivityStatus] = useState(null);
  const [activityStatusClosing, setActivityStatusClosing] = useState(false);
  const activityStatusTimeoutRef = useRef(null);
  const activityStatusFadeTimeoutRef = useRef(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);

  const [activeUI, setActiveUI] = useState(null);
  const isSupporterAccount = currentUser?.supporter === true;

  const [routeEffectsEnabled, setRouteEffectsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;

    const saved = localStorage.getItem("routeEffectsEnabled");
    return saved !== null ? JSON.parse(saved) : true;
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

  function getRoutePointRadius(width) {
    const routeWidth = getRouteDisplayWidth(width || DEFAULT_ROUTE_WIDTH);
    return Math.max(0.06, routeWidth * 0.35 + 0.03);
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

  function openConnectedEditorMap(destinationMapId) {
    if (!destinationMapId || destinationMapId === mapId) return;

    window.location.assign(`/editor/${destinationMapId}`);
  }

  useEffect(() => {
    const originalAlert = window.alert;
    setIsMounted(true);
    window.alert = (message) => {
      setSiteAlert(String(message || ""));
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (!routeColorPickerOpen) return undefined;

    function closeRouteColorPicker(event) {
      if (routeColorPickerRef.current?.contains(event.target)) return;
      setRouteColorPickerOpen(false);
    }

    document.addEventListener("pointerdown", closeRouteColorPicker);

    return () => {
      document.removeEventListener("pointerdown", closeRouteColorPicker);
    };
  }, [routeColorPickerOpen]);

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
    if (!headerConfigMenuOpen) return undefined;

    function updateHeaderConfigMenuPosition() {
      if (!headerConfigMenuRef.current) return;

      const rect = headerConfigMenuRef.current.getBoundingClientRect();
      setHeaderConfigMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }

    function closeHeaderConfigMenu(event) {
      if (headerConfigMenuRef.current?.contains(event.target)) return;
      if (event.target.closest?.(".headerConfigMenu")) return;
      setHeaderConfigMenuOpen(false);
    }

    updateHeaderConfigMenuPosition();
    document.addEventListener("pointerdown", closeHeaderConfigMenu);
    window.addEventListener("resize", updateHeaderConfigMenuPosition);
    window.addEventListener("scroll", updateHeaderConfigMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeHeaderConfigMenu);
      window.removeEventListener("resize", updateHeaderConfigMenuPosition);
      window.removeEventListener("scroll", updateHeaderConfigMenuPosition, true);
    };
  }, [headerConfigMenuOpen]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      centerMap();
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

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

        const loadedPinSize = Math.max(
          MIN_MAP_PIN_SIZE,
          mapDataResult.map.pinSize ?? DEFAULT_MAP_PIN_SIZE
        );
        const loadedRouteSize = Math.max(
          MIN_MAP_ROUTE_SIZE,
          mapDataResult.map.routeSize ?? DEFAULT_MAP_ROUTE_SIZE
        );
        const loadedNoteSize = Math.max(
          MIN_MAP_NOTE_SIZE,
          mapDataResult.map.noteSize ?? DEFAULT_MAP_NOTE_SIZE
        );

        setMapData(mapDataResult.map);
        setCurrentUser(mapDataResult.currentUser);
        setIsOwner(mapDataResult.isOwner);
        setMapAccess(mapDataResult.access || MAP_ACCESS.public);
        setMapPinSize(loadedPinSize);
        setMapRouteSize(loadedRouteSize);
        setMapNoteSize(loadedNoteSize);

        if (typeof mapDataResult.map.routeEffectsEnabled === "boolean") {
          setRouteEffectsEnabled(mapDataResult.map.routeEffectsEnabled);
        }

        setLoaded(true);

        if (mapDataResult.map.groupId) {
          const assetsResponse = await fetch(
            `/api/groups/${mapDataResult.map.groupId}/assets`
          );
          const assetsData = await assetsResponse.json();

          if (assetsResponse.ok) {
            setAssets(assetsData.assets || []);
          }

          const categoriesResponse = await fetch(
            `/api/groups/${mapDataResult.map.groupId}/pin-categories`
          );
          const categoriesData = await categoriesResponse.json();

          if (categoriesResponse.ok) {
            setPinCategories(categoriesData.categories || []);
          }

          const pinTypesResponse = await fetch(
            `/api/groups/${mapDataResult.map.groupId}/pin-types`
          );
          const pinTypesData = await pinTypesResponse.json();

          if (pinTypesResponse.ok) {
            setPinTypes(pinTypesData.pinTypes || []);
          }
        }

        const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
        const pinsDataResult = await pinsResponse.json();

        if (pinsResponse.ok) {
          setPins(pinsDataResult.pins || []);
        }

        const routesResponse = await fetch(`/api/maps/${mapId}/routes`);
        const routesDataResult = await routesResponse.json();

        if (routesResponse.ok) {
          setRoutes(routesDataResult.routes || []);
        }

        const notesResponse = await fetch(`/api/maps/${mapId}/notes`);
        const notesDataResult = await notesResponse.json();

        if (notesResponse.ok) {
          setNotes(notesDataResult.notes || []);
        }

        const connectedResponse = await fetch(`/api/maps/${mapId}/connected`);
        const connectedDataResult = await connectedResponse.json();

        if (connectedResponse.ok) {
          setConnectedMaps(connectedDataResult.maps || []);
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
  }, [mapId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!isDrawingRoute) return;

      if (event.key === "Escape") {
        cancelRouteMode();
      }

      if (event.key === "Enter") {
        saveRoute();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawingRoute, routePoints, routeName, routeColor, routeWidth]);

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

  useEffect(() => {
    if (!addEditorOpen) return;

    if (!editorSearch.trim()) {
      setEditorSearchResults([]);
      setEditorSearchLoading(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setEditorSearchLoading(true);

      try {
        const response = await fetch(
          `/api/accounts/search?query=${encodeURIComponent(editorSearch)}`
        );
        const data = await response.json();

        if (response.ok) {
          setEditorSearchResults(data.users || []);
        }
      } catch (error) {
        console.error("Erro ao buscar editores:", error);
      } finally {
        setEditorSearchLoading(false);
      }
    }, 180);

    return () => clearTimeout(searchTimeout);
  }, [addEditorOpen, editorSearch]);

  function formatActivityTimestamp(value) {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${day}/${month}/${year} ${time}`;
  }

  async function loadActivityLogs() {
    setLoadingActivityLogs(true);

    try {
      const response = await fetch(`/api/maps/${mapId}/logs`);
      const data = await response.json();

      if (response.ok) {
        setActivityLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Erro ao carregar historico:", error);
    } finally {
      setLoadingActivityLogs(false);
    }
  }

  async function openActivityLog() {
    closeNoteEditor();
    setHeaderConfigMenuOpen(false);
    setActivityLogOpen(true);
    await loadActivityLogs();
  }

  async function recordMapActivity(message) {
    const userName = getPublicUsername(currentUser?.username);
    const displayMessage = `${userName}: ${message}`;

    showMapToast(displayMessage);

    try {
      const response = await fetch(`/api/maps/${mapId}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (response.ok && data.log) {
        setActivityLogs((prev) => [data.log, ...prev].slice(0, 15));
      }
    } catch (error) {
      console.error("Erro ao salvar historico:", error);
    }
  }

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

  function getPinIconKey(pin) {
    if (pin.iconKey) return pin.iconKey;

    if (pin.iconType === "custom") {
      return `custom:${pin.iconImageUrl || ""}`;
    }

    return `emoji:${normalizePinIcon(pin.icon)}`;
  }

  function getPinCategoryColor(pin) {
    const type = pinTypes.find((pinType) => pinType.iconKey === getPinIconKey(pin));

    return getPinBackgroundColor(type?.backgroundColor);
  }

  function rememberCategoryColor(color) {
    const nextColor = getPinBackgroundColor(color);

    setRecentCategoryColors((prev) => [
      nextColor,
      ...prev.filter((recentColor) => recentColor !== nextColor),
    ].slice(0, 5));
  }

  function applyPinTypeFromIcon(nextForm) {
    const existingType = findPinTypeForForm(nextForm);

    if (existingType) {
      return {
        ...nextForm,
        typeName: existingType.typeName,
        category: existingType.category,
      };
    }

    return {
      ...nextForm,
      typeName: "",
      category: "geral",
    };
  }

  function getDefaultPinForm() {
    const firstGroup = sidebarCategories[0]?.value || "geral";

    return {
      name: "",
      typeName: "",
      description: "",
      icon: DEFAULT_PIN_ICON,
      iconType: DEFAULT_PIN_ICON_TYPE,
      iconImageUrl: DEFAULT_PIN_ICON_IMAGE_URL,
      category: firstGroup,
    };
  }

  function resetCreateCategoryIcon() {
    setCreateCategoryIcon(DEFAULT_PIN_ICON);
    setCreateCategoryIconType(DEFAULT_PIN_ICON_TYPE);
    setCreateCategoryIconImageUrl(DEFAULT_PIN_ICON_IMAGE_URL);
  }

  function handleMapClick(event) {
    if (isDrawingRoute) return;

    if (!isAddingPin) return;

    const imageWrapper = event.currentTarget;
    const rect = imageWrapper.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const defaultForm = getDefaultPinForm();

    setPendingPosition({ x, y });
    setEditingPin(null);
    setForm(defaultForm);
    setModalOpen(true);
    setIsAddingPin(false);
  }

  function getMapPointLimits(imageWrapper) {
    const mapWidth = imageWrapper.offsetWidth || imageWrapper.getBoundingClientRect().width;
    const mapHeight = imageWrapper.offsetHeight || imageWrapper.getBoundingClientRect().height;

    return {
      minX: -(OUTSIDE_MAP_INTERACTION_MARGIN / mapWidth) * 100,
      maxX: 100 + (OUTSIDE_MAP_INTERACTION_MARGIN / mapWidth) * 100,
      minY: -(OUTSIDE_MAP_INTERACTION_MARGIN / mapHeight) * 100,
      maxY: 100 + (OUTSIDE_MAP_INTERACTION_MARGIN / mapHeight) * 100,
    };
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

  function clampMapPoint(point, imageWrapper) {
    const limits = getMapPointLimits(imageWrapper);

    return {
      ...point,
      x: Math.max(limits.minX, Math.min(limits.maxX, point.x)),
      y: Math.max(limits.minY, Math.min(limits.maxY, point.y)),
    };
  }

  function getMapPointFromClient(clientX, clientY, { clamp = true } = {}) {
    const imageWrapper = document.querySelector(".imageWrapper");

    if (!imageWrapper) return null;

    const rect = imageWrapper.getBoundingClientRect();

    const point = {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };

    return clamp ? clampMapPoint(point, imageWrapper) : point;
  }

  function isEventInsideMap(event) {
    return Boolean(event.target.closest?.(".imageWrapper"));
  }

  function isEventInsideMapUi(event) {
    return Boolean(
      event.target.closest?.(".mapControls") ||
        event.target.closest?.(".mapContextMenu")
    );
  }

  function handleMapAreaMouseDown(event) {
    if (isEventInsideMap(event) || isEventInsideMapUi(event)) return;

    const point = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    mapMouseDownPointRef.current = point;
    mapDragRef.current = false;
    setMapMouseDownPoint(point);

    if (!isDrawingRoute || event.button !== 0) return;

    const mapPoint = getMapPointFromClient(event.clientX, event.clientY);

    if (!mapPoint) return;

    setRouteMouseDownPoint({
      ...mapPoint,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handleMapAreaMouseMove(event) {
    if (isEventInsideMap(event) || isEventInsideMapUi(event)) return;

    if (movingPin) {
      updateMovingPinPositionFromClient(event.clientX, event.clientY);
    }

    if (isDrawingRoute) {
      const point = getMapPointFromClient(event.clientX, event.clientY);

      if (point) {
        setMousePoint(point);
      }
    }

    const dragPoint = mapMouseDownPointRef.current;

    if (!dragPoint) return;

    const distance = Math.hypot(
      event.clientX - dragPoint.clientX,
      event.clientY - dragPoint.clientY
    );

    if (distance > 4) {
      mapDragRef.current = true;
      setIsMapPanning(true);
    }
  }

  function handleMapAreaClick(event) {
    if (isEventInsideMap(event) || isEventInsideMapUi(event)) return;

    closeContextMenu();

    if (movingPin) {
      updateMovingPinPositionFromClient(event.clientX, event.clientY);
      setConfirmMovePinOpen(true);
      return;
    }

    const mapClickPoint = mapMouseDownPointRef.current || mapMouseDownPoint;

    if (mapClickPoint) {
      const distance = Math.hypot(
        event.clientX - mapClickPoint.clientX,
        event.clientY - mapClickPoint.clientY
      );

      if (distance <= 4 && !isAddingPin && !isDrawingRoute && !isAddingNote) {
        setSelectedPin(null);
        setSelectedRoute(null);
        setSelectedNote(null);
        setIsEditingRoute(false);
      }
    }

    if (isAddingPin && !mapDragRef.current) {
      const point = getMapPointFromClient(event.clientX, event.clientY);

      if (point) {
        const defaultForm = getDefaultPinForm();

        setPendingPosition(point);
        setEditingPin(null);
        setForm(defaultForm);
        setModalOpen(true);
        setIsAddingPin(false);
      }
    }

    mapMouseDownPointRef.current = null;
    setMapMouseDownPoint(null);
    setIsMapPanning(false);
  }

  function handleMapAreaMouseUp(event) {
    setIsMapPanning(false);

    if (isEventInsideMap(event) || isEventInsideMapUi(event)) return;

    if (!isDrawingRoute || event.button !== 0 || !routeMouseDownPoint) return;

    const point = getMapPointFromClient(event.clientX, event.clientY);

    if (!point) return;

    const distance = Math.hypot(
      event.clientX - routeMouseDownPoint.clientX,
      event.clientY - routeMouseDownPoint.clientY
    );

    setRouteMouseDownPoint(null);

    if (distance > 4) return;

    setRoutePoints((prev) => [
      ...prev,
      {
        x: point.x,
        y: point.y,
      },
    ]);
  }

  function openMapAreaContextMenu(event) {
    if (isEventInsideMap(event) || isEventInsideMapUi(event)) return;

    event.preventDefault();

    if (movingPin) return;
    if (isAddingPin) return;
    if (isDrawingRoute) return;
    if (isAddingNote) return;

    closeNoteEditor();
    const point = getMapPointFromClient(event.clientX, event.clientY);

    if (!point) return;

    setContextMenu({
      screenX: event.clientX,
      screenY: event.clientY,
      mapX: point.x,
      mapY: point.y,
    });
  }

  function handlePinClick(event, pin) {
    event.stopPropagation();

    if (mapDragRef.current) return;

    if (movingPin) return;

    if (isAddingPin) return;

    if (isDrawingRoute) return;

    if (chainPinPickTarget) {
      addPinChainRequirement(pin);
      return;
    }

    closeContextMenu();
    setSelectedPin(pin);
    setSelectedRoute(null);
    setSelectedNote(null);
    setIsEditingRoute(false);

    setPinPopupPosition({
      x: pin.x,
      y: pin.y,
    });
  }

  function openEditModal(pin) {
    if (!mapAccess.canEditPins) return;

    setEditingPin(pin);
    setPendingPosition(null);

    setForm({
      name: pin.name || "",
      typeName: pin.typeName || pin.name || "",
      description: pin.description || "",
      icon: normalizePinIcon(pin.icon),
      iconType: pin.iconType || "emoji",
      iconImageUrl: pin.iconImageUrl || "",
      category: pin.category || "geral",
    });

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPin(null);
    setPendingPosition(null);
  }

  function getChainRequirementKey(requirement) {
    return (
      requirement?.pinId ||
      requirement?.key ||
      requirement?.iconKey ||
      `${requirement?.category || "geral"}:${requirement?.typeName || ""}`
    );
  }

  function getChainRequirementLabel(requirement) {
    if (requirement?.kind === "pin") {
      return requirement.typeName || "Pin";
    }

    return requirement?.typeName || requirement?.label || "Category";
  }

  function getChainRequirementFromPin(pin) {
    return {
      kind: "pin",
      pinId: pin._id,
      key: `pin:${pin._id}`,
      category: pin.category || "geral",
      groupLabel:
        pinGroups.find((group) => group.value === (pin.category || "geral"))
          ?.label || "",
      typeName: pin.name || pin.typeName || "Pin",
      icon: normalizePinIcon(pin.icon),
      iconType: pin.iconType || "emoji",
      iconImageUrl: pin.iconImageUrl || "",
      iconKey: pin.iconKey || getPinIconKey(pin),
    };
  }

  function getChainRequirementFromType(group, type) {
    return {
      kind: "category",
      pinId: "",
      key: type.key,
      category: group.value,
      groupLabel: group.label,
      typeName: type.label,
      icon: normalizePinIcon(type.icon),
      iconType: type.iconType || "emoji",
      iconImageUrl: type.iconImageUrl || "",
      iconKey: type.key,
    };
  }

  function openChainChoice(pin) {
    if (!mapAccess.canEditPins) return;

    closeNoteEditor();
    setChainPin(pin);
    setChainChoiceOpen(true);
  }

  function openChainModal(pin = chainPin) {
    if (!mapAccess.canEditPins || !pin) return;

    setChainChoiceOpen(false);
    setChainPin(pin);
    setChainForm({
      requirements: Array.isArray(pin.chainRequirements)
        ? pin.chainRequirements
        : [],
      description: pin.chainDescription || "",
    });
    setChainModalOpen(true);
  }

  function closeChainModal() {
    setChainModalOpen(false);
    setChainChoiceOpen(false);
    setChainPin(null);
    setChainForm({
      requirements: [],
      description: "",
    });
  }

  function startChainPinPick(pin = chainPin) {
    if (!mapAccess.canEditPins || !pin) return;

    setChainChoiceOpen(false);
    setChainModalOpen(false);
    setChainPinPickTarget(pin);
    setSelectedPin(null);
    setPinPopupPosition(null);
    showMapToast("Clique no pin que sera requirement.");
  }

  function selectChainRequirementPin(requirement) {
    if (!requirement?.pinId) return;

    const targetPin = pins.find((pin) => pin._id === requirement.pinId);

    if (!targetPin) {
      showMapToast("Pin requirement nao encontrado.");
      return;
    }

    closeNoteEditor();
    setSelectedPin(targetPin);
    setSelectedRoute(null);
    setSelectedNote(null);
    setIsEditingRoute(false);
    setPinPopupPosition({
      x: targetPin.x,
      y: targetPin.y,
    });
    centerMapOnPin(targetPin);
  }

  function toggleChainRequirement(group, type) {
    const requirement = getChainRequirementFromType(group, type);
    const requirementKey = getChainRequirementKey(requirement);

    setChainForm((prev) => {
      const selected = prev.requirements.some(
        (currentRequirement) =>
          getChainRequirementKey(currentRequirement) === requirementKey
      );

      return {
        ...prev,
        requirements: selected
          ? prev.requirements.filter(
              (currentRequirement) =>
                getChainRequirementKey(currentRequirement) !== requirementKey
            )
          : [...prev.requirements, requirement],
      };
    });
  }

  async function savePinChains(nextRequirements = chainForm.requirements, options = {}) {
    const pinToSave = options.pin || chainPin;
    const nextDescription =
      options.description !== undefined
        ? options.description
        : chainForm.description.trim();

    if (!mapAccess.canEditPins || !pinToSave) return;

    try {
      const response = await fetch(`/api/pins/${pinToSave._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chainRequirements: nextRequirements,
          chainDescription: nextDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar chain.");
        return;
      }

      const updatedPin = {
        ...pinToSave,
        chainRequirements: nextRequirements,
        chainDescription: nextDescription,
      };

      setPins((prev) =>
        prev.map((pin) => (pin._id === pinToSave._id ? updatedPin : pin))
      );
      setSelectedPin((prev) =>
        prev?._id === pinToSave._id ? updatedPin : prev
      );
      setChainPin((prev) => (prev?._id === pinToSave._id ? updatedPin : prev));
      recordMapActivity("Chain do pin editada");

      if (options.close !== false) {
        closeChainModal();
      }
    } catch (error) {
      console.error("Erro ao salvar chain:", error);
      alert("Erro ao salvar chain.");
    }
  }

  async function deletePinChainRequirement(pinToUpdate, requirement) {
    if (!pinToUpdate || !requirement) return;

    const requirementKey = getChainRequirementKey(requirement);
    const currentRequirements = Array.isArray(pinToUpdate.chainRequirements)
      ? pinToUpdate.chainRequirements
      : [];
    const nextRequirements = currentRequirements.filter(
      (currentRequirement) =>
        getChainRequirementKey(currentRequirement) !== requirementKey
    );

    await savePinChains(nextRequirements, {
      pin: pinToUpdate,
      description: pinToUpdate.chainDescription || "",
      close: false,
    });
  }

  function requestDeletePinChainRequirement(requirement) {
    if (!chainPin || !requirement) return;

    setDeleteConfirm({
      type: "chainRequirement",
      payload: {
        pin: chainPin,
        requirement,
      },
      title: "Deletar chain?",
      message: `Deletar "${getChainRequirementLabel(requirement)}" dos requirements deste pin?`,
    });
  }

  async function resetPinChains(pinToReset = chainPin) {
    if (!mapAccess.canEditPins || !pinToReset) return;

    try {
      const response = await fetch(`/api/pins/${pinToReset._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chainRequirements: [],
          chainDescription: "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao resetar chains.");
        return;
      }

      const updatedPin = {
        ...pinToReset,
        chainRequirements: [],
        chainDescription: "",
      };

      setPins((prev) =>
        prev.map((pin) => (pin._id === pinToReset._id ? updatedPin : pin))
      );
      setSelectedPin((prev) =>
        prev?._id === pinToReset._id ? updatedPin : prev
      );
      recordMapActivity("Chains do pin resetadas");
      closeChainModal();
    } catch (error) {
      console.error("Erro ao resetar chains:", error);
      alert("Erro ao resetar chains.");
    }
  }

  function requestResetPinChains() {
    if (!chainPin) return;

    setDeleteConfirm({
      type: "chainReset",
      payload: chainPin,
      title: "Reset chains?",
      message: "Reset chains?",
    });
  }

  async function addPinChainRequirement(requirementPin) {
    if (!mapAccess.canEditPins || !chainPinPickTarget || !requirementPin) return;

    if (requirementPin._id === chainPinPickTarget._id) {
      showMapToast("Um pin nao pode requerer ele mesmo.");
      setChainPinPickTarget(null);
      return;
    }

    const requirement = getChainRequirementFromPin(requirementPin);
    const currentRequirements = Array.isArray(chainPinPickTarget.chainRequirements)
      ? chainPinPickTarget.chainRequirements
      : [];
    const alreadySelected = currentRequirements.some(
      (currentRequirement) =>
        getChainRequirementKey(currentRequirement) === getChainRequirementKey(requirement)
    );
    const nextRequirements = alreadySelected
      ? currentRequirements
      : [...currentRequirements, requirement];

    try {
      const response = await fetch(`/api/pins/${chainPinPickTarget._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chainRequirements: nextRequirements,
          chainDescription: chainPinPickTarget.chainDescription || "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar chain.");
        return;
      }

      const updatedPin = {
        ...chainPinPickTarget,
        chainRequirements: nextRequirements,
      };

      setPins((prev) =>
        prev.map((pin) => (pin._id === chainPinPickTarget._id ? updatedPin : pin))
      );
      setSelectedPin(updatedPin);
      setPinPopupPosition({
        x: updatedPin.x,
        y: updatedPin.y,
      });
      recordMapActivity("Chain do pin editada");
    } catch (error) {
      console.error("Erro ao salvar chain:", error);
      alert("Erro ao salvar chain.");
    } finally {
      setChainPinPickTarget(null);
    }
  }

  function isPortalPin(pin) {
    return (
      pin?.systemType === PORTAL_SYSTEM_TYPE ||
      ((pin?.category || "geral") === SYSTEM_PIN_CATEGORY_VALUE &&
        (pin?.typeName || pin?.name) === PORTAL_TYPE_NAME)
    );
  }

  function isSystemGroup(group) {
    return group?.value === SYSTEM_PIN_CATEGORY_VALUE || group?.systemLocked;
  }

  function isSystemPortalType(type) {
    return (
      type?.systemType === PORTAL_SYSTEM_TYPE ||
      ((type?.category || "geral") === SYSTEM_PIN_CATEGORY_VALUE &&
        type?.label === PORTAL_TYPE_NAME)
    );
  }

  async function openDestinationModal(pin) {
    if (!mapAccess.canEditPins || !isPortalPin(pin)) return;

    closeNoteEditor();
    setDestinationPin(pin);
    setDestinationMapId(pin.destinationMapId || "");
    setDestinationModalOpen(true);
    setDestinationLoading(true);

    try {
      const response = await fetch(`/api/maps/${mapId}/destinations`);
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao buscar mapas de destino.");
        setDestinationMaps([]);
        return;
      }

      setDestinationMaps(data.maps || []);
    } catch (error) {
      console.error("Erro ao buscar mapas de destino:", error);
      alert("Erro ao buscar mapas de destino.");
      setDestinationMaps([]);
    } finally {
      setDestinationLoading(false);
    }
  }

  function closeDestinationModal() {
    setDestinationModalOpen(false);
    setDestinationPin(null);
    setDestinationMaps([]);
    setDestinationMapId("");
    setDestinationLoading(false);
  }

  async function savePinDestination() {
    if (!mapAccess.canEditPins || !destinationPin) return;

    try {
      const response = await fetch(`/api/pins/${destinationPin._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destinationMapId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar destino.");
        return;
      }

      const destinationMap = destinationMaps.find(
        (destination) => destination._id === destinationMapId
      );
      const updatedPin = {
        ...destinationPin,
        destinationMapId,
        destinationMapTitle: destinationMap?.title || "",
      };

      setPins((prev) =>
        prev.map((pin) => (pin._id === destinationPin._id ? updatedPin : pin))
      );
      setSelectedPin((prev) =>
        prev?._id === destinationPin._id ? updatedPin : prev
      );
      recordMapActivity("Destino do portal editado");

      try {
        const connectedResponse = await fetch(`/api/maps/${mapId}/connected`);
        const connectedData = await connectedResponse.json();

        if (connectedResponse.ok) {
          setConnectedMaps(connectedData.maps || []);
        }
      } catch (error) {
        console.error("Erro ao atualizar mapas conectados:", error);
      }

      closeDestinationModal();
    } catch (error) {
      console.error("Erro ao salvar destino:", error);
      alert("Erro ao salvar destino.");
    }
  }

  function applyExistingPinType(pinTypeId) {
    const selectedType = pinTypes.find((type) => type._id === pinTypeId);

    if (!selectedType) return;

    setForm((prev) => ({
      ...prev,
      typeName: selectedType.typeName,
      category: selectedType.category || "geral",
      icon: normalizePinIcon(selectedType.icon),
      iconType: selectedType.iconType || "emoji",
      iconImageUrl: selectedType.iconImageUrl || "",
    }));
  }

  async function savePin() {
    if (!mapAccess.canEditPins) return;

    if (!form.name.trim()) {
      alert("Digite um nome para o pin.");
      return;
    }

    if (!form.typeName.trim()) {
      alert("Selecione uma categoria.");
      return;
    }

    const finalCategory = form.category || "geral";
    const finalTypeName = form.typeName.trim();

    try {
      if (editingPin) {
        const response = await fetch(`/api/pins/${editingPin._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            typeName: finalTypeName,
            description: form.description.trim(),
            icon: form.icon,
            iconType: form.iconType,
            iconImageUrl: form.iconImageUrl,
            category: finalCategory,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || "Erro ao editar pin.");
          return;
        }

        const selectedType = pinTypes.find(
          (type) =>
            type.typeName === finalTypeName &&
            (type.category || "geral") === finalCategory
        );

        const updatedPin = {
          ...editingPin,
          name: form.name.trim(),
          typeName: finalTypeName,
          description: form.description.trim(),
          icon: normalizePinIcon(form.icon),
          iconType: form.iconType,
          iconImageUrl: form.iconImageUrl,
          iconKey:
            selectedType?.iconKey ||
            (form.iconType === "custom"
              ? `custom:${form.iconImageUrl || ""}`
              : `emoji:${normalizePinIcon(form.icon)}`),
          category: finalCategory,
        };

        setPins((prev) =>
          prev.map((pin) => (pin._id === editingPin._id ? updatedPin : pin))
        );

        setSelectedPin(updatedPin);
        recordMapActivity("Pin editado");
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
          typeName: finalTypeName,
          description: form.description.trim(),
          icon: form.icon,
          iconType: form.iconType,
          iconImageUrl: form.iconImageUrl,
          category: finalCategory,
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
      setSelectedRoute(null);
      setIsEditingRoute(false);
      setPinPopupPosition({
        x: data.pin.x,
        y: data.pin.y,
      });
      recordMapActivity("Pin criado");
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar pin.");
    }
  }

  function requestDeletePin(pinId) {
    if (!mapAccess.canEditPins) return;

    setDeleteConfirm({
      type: "pin",
      payload: pinId,
      title: "Deletar pin?",
      message: "Deseja deletar este pin?",
    });
  }

  async function deletePin(pinId) {
    if (!mapAccess.canEditPins) return;

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
      recordMapActivity("Pin deletado");
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar pin.");
    }
  }

  async function clearPins() {
    if (!deleteConfirm || deleteConfirm.type !== "clearPins") {
      setDeleteConfirm({
        type: "clearPins",
        title: "Limpar pins?",
        message: "Tem certeza que deseja limpar todos os pins?",
      });
      return;
    }

    setDeleteConfirm(null);

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
      recordMapActivity("Pins limpos");
    } catch (error) {
      console.error(error);
      alert("Erro ao limpar pins.");
    }
  }

  function copyPublicLink() {
    closeNoteEditor();
    navigator.clipboard.writeText(`${window.location.origin}/map/${mapId}`);
    showMapToast("Public link copied");
  }

  function openShareModal() {
    closeNoteEditor();
    setSelectedPin(null);
    setSelectedRoute(null);
    setPinPopupPosition(null);
    setShareModalOpen(true);
  }

  function openMapSettings() {
    if (!mapAccess.canManageSettings) return;

    setHeaderConfigMenuOpen(false);
    closeNoteEditor();
    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);
    setIsAddingPin(false);
    setIsDrawingRoute(false);
    setAddEditorOpen(false);
    setEditorSearch("");
    setEditorSearchResults([]);
    setEditorPermissionDrafts(
      Object.fromEntries(
        (mapData?.editors || []).map((editor) => [
          getPublicUsername(editor.username || editor.name, "editor"),
          editor.permission || editor.role || editor.access || "",
        ])
      )
    );
    closeContextMenu();
    setScaleSettingsOpen(false);

    setMapSettingsForm({
      title: mapData?.title || "",
      description: mapData?.description || "",
      tags: Array.isArray(mapData?.tags) ? mapData.tags.join(", ") : "",
      visibility: mapData?.visibility || "public",
      routeEffectsEnabled,
    });
    setMapSettingsOpen(true);
  }

  function openScaleSettings() {
    if (!mapAccess.canManageSettings) return;

    closeNoteEditor();
    closeContextMenu();
    setMapSettingsOpen(false);
    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);
    setIsAddingPin(false);
    setIsDrawingRoute(false);
    setScaleSettingsForm({
      pinSize: Math.max(MIN_MAP_PIN_SIZE, mapPinSize),
      routeSize: Math.max(MIN_MAP_ROUTE_SIZE, mapRouteSize),
      noteSize: Math.max(MIN_MAP_NOTE_SIZE, mapNoteSize),
    });
    setScaleSettingsOpen(true);
  }

  function closeMapSettings() {
    if (savingMapSettings) return;
    setAddEditorOpen(false);
    setEditorSearch("");
    setEditorSearchResults([]);
    setEditorPermissionDrafts({});
    setMapSettingsOpen(false);
  }

  function closeScaleSettings() {
    if (savingMapSettings) return;
    setMapPinSize(
      Math.max(MIN_MAP_PIN_SIZE, mapData?.pinSize ?? DEFAULT_MAP_PIN_SIZE)
    );
    setMapRouteSize(
      Math.max(MIN_MAP_ROUTE_SIZE, mapData?.routeSize ?? DEFAULT_MAP_ROUTE_SIZE)
    );
    setMapNoteSize(
      Math.max(MIN_MAP_NOTE_SIZE, mapData?.noteSize ?? DEFAULT_MAP_NOTE_SIZE)
    );
    setScaleSettingsOpen(false);
  }

  async function saveMapSettings() {
    if (!mapSettingsForm.title.trim()) {
      alert("Nome do mapa obrigatorio.");
      return;
    }

    setSavingMapSettings(true);

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mapSettingsForm.title,
          description: mapSettingsForm.description,
          tags: mapSettingsForm.tags,
          visibility: mapSettingsForm.visibility,
          routeEffectsEnabled: mapSettingsForm.routeEffectsEnabled,
          editorPermissions: editorPermissionDrafts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar configuracoes do mapa.");
        return;
      }

      setMapData((prev) => ({
        ...prev,
        title: mapSettingsForm.title.trim(),
        description: mapSettingsForm.description.trim(),
        visibility: mapSettingsForm.visibility,
        tags: mapSettingsForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        routeEffectsEnabled: mapSettingsForm.routeEffectsEnabled,
        editors: (prev?.editors || []).map((editor) => {
          const username = getPublicUsername(
            editor.username || editor.name,
            "editor"
          );

          return {
            ...editor,
            username,
            permission: editorPermissionDrafts[username] || "",
          };
        }),
      }));
      setRouteEffectsEnabled(mapSettingsForm.routeEffectsEnabled);
      recordMapActivity("Configurações do mapa salvas");
      setMapSettingsOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar configuracoes do mapa.");
    } finally {
      setSavingMapSettings(false);
    }
  }

  async function saveScaleSettings() {
    setSavingMapSettings(true);

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: mapData?.title || "Map",
          pinSize: scaleSettingsForm.pinSize,
          routeSize: scaleSettingsForm.routeSize,
          noteSize: scaleSettingsForm.noteSize,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar escalas do mapa.");
        return;
      }

      const savedPinSize = Math.max(MIN_MAP_PIN_SIZE, scaleSettingsForm.pinSize);
      const savedRouteSize = Math.max(
        MIN_MAP_ROUTE_SIZE,
        scaleSettingsForm.routeSize
      );
      const savedNoteSize = Math.max(MIN_MAP_NOTE_SIZE, scaleSettingsForm.noteSize);

      setMapData((prev) => ({
        ...prev,
        pinSize: savedPinSize,
        routeSize: savedRouteSize,
        noteSize: savedNoteSize,
      }));
      setMapPinSize(savedPinSize);
      setMapRouteSize(savedRouteSize);
      setMapNoteSize(savedNoteSize);
      recordMapActivity("Escalas do mapa salvas");
      setScaleSettingsOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar escalas do mapa.");
    } finally {
      setSavingMapSettings(false);
    }
  }

  function renderPinIcon(pin) {
    if (pin.iconType === "custom" && pin.iconImageUrl) {
      return (
        <img src={pin.iconImageUrl} alt={pin.name} className="customPinIcon" />
      );
    }

    if (!pin.icon) {
      return (
        <img
          src={DEFAULT_PIN_ICON_IMAGE_URL}
          alt={pin.name || "Pin"}
          className="customPinIcon"
        />
      );
    }

    return normalizePinIcon(pin.icon);
  }

  function getActiveRouteColor() {
    return isDrawingRoute ? routeColor : editingRouteData?.color || "#3b82f6";
  }

  function showSupporterFeatureModal(feature = "Custom colors") {
    setSupporterFeatureModal({
      title: "Supporter feature",
      message: `${feature} is available only for Supporter accounts.`,
    });
  }

  function isRouteColorPreset(color) {
    const nextColor = normalizeHexColor(color);

    return ROUTE_COLOR_PRESETS.includes(nextColor);
  }

  function isPinColorPreset(color) {
    const nextColor = normalizeHexColor(color);

    return PIN_COLOR_PRESETS.includes(nextColor);
  }

  function setActiveRouteColor(color, options = {}) {
    const nextColor = normalizeHexColor(color);

    if (!nextColor) return;

    if (!isSupporterAccount && options.custom && !isRouteColorPreset(nextColor)) {
      showSupporterFeatureModal("Custom route colors");
      return;
    }

    if (isDrawingRoute) {
      setRouteColor(nextColor);
      return;
    }

    setEditingRouteData((prev) => ({
      ...prev,
      color: nextColor,
    }));
  }

  function rememberRouteColor(color) {
    const nextColor = normalizeHexColor(color);

    if (!nextColor) return;

    setRecentRouteColors((prev) => [
      nextColor,
      ...prev.filter((currentColor) => currentColor !== nextColor),
    ].slice(0, 5));
  }

  function handleRouteClick(event, route) {
    event.stopPropagation();

    if (mapDragRef.current) return;

    if (movingPin) return;

    if (isAddingPin) return;

    if (isDrawingRoute) return;
    if (!mapAccess.canEditRoutes) return;

    closeNoteEditor();
    setSelectedRoute(route);
    setSelectedPin(null);
    centerMapOnRoute(route);

    setEditingRouteData({
      name: route.name,
      color: route.color || "#ef4444",
      width: route.width || DEFAULT_ROUTE_WIDTH,
    });
    setIsEditingRoute(true);
  }

  function startPinMode() {
    if (!!movingPin || !mapAccess.canEditPins) return;

    closeNoteEditor();
    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);
    setIsAddingPin((prev) => !prev);
    setIsAddingNote(false);
    setIsDrawingRoute(false);
  }

  function startRouteMode() {
    if (!mapAccess.canEditRoutes) return;

    closeNoteEditor();
    setIsDrawingRoute(true);
    setIsAddingPin(false);
    setIsAddingNote(false);
    setSelectedPin(null);
    setSelectedRoute(null);
    setSelectedNote(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);
    setRoutePoints([]);
    setRouteName("");
    setRouteColor("#3b82f6");
    setRouteWidth(DEFAULT_ROUTE_WIDTH);
    setMousePoint(null);
  }

  function startNoteMode() {
    if (!mapAccess.canEditPins) return;

    closeNoteEditor();
    setIsAddingNote((prev) => !prev);
    setIsAddingPin(false);
    setIsDrawingRoute(false);
    setSelectedPin(null);
    setSelectedRoute(null);
    setSelectedNote(null);
    setPinPopupPosition(null);
    setNoteDragStart(null);
    setNoteDraftRect(null);
  }

  function cancelRouteMode() {
    setIsDrawingRoute(false);
    setRoutePoints([]);
    setRouteName("");
    setMousePoint(null);
    setRouteColorPickerOpen(false);
  }

  async function saveRoute() {
    if (!mapAccess.canEditRoutes) return;

    if (!routeName.trim()) {
      alert("Digite um nome para a rota.");
      return;
    }

    const nextRouteName = routeName.trim();

    if (nextRouteName.length > MAX_ROUTE_TITLE_LENGTH) {
      alert(`O titulo da rota pode ter no maximo ${MAX_ROUTE_TITLE_LENGTH} caracteres.`);
      return;
    }

    if (routePoints.length < 2) {
      alert("A rota precisa ter pelo menos 2 pontos.");
      return;
    }

    try {
      const response = await fetch(`/api/maps/${mapId}/routes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextRouteName,
          description: "",
          points: routePoints,
          color: routeColor,
          width: routeWidth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar rota.");
        return;
      }

      setRoutes((prev) => [...prev, data.route]);
      rememberRouteColor(routeColor);
      recordMapActivity("Rota criada");
      cancelRouteMode();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar rota.");
    }
  }

  function requestDeleteRoute(routeId) {
    if (!mapAccess.canEditRoutes) return;

    setDeleteConfirm({
      type: "route",
      payload: routeId,
      title: "Deletar rota?",
      message: "Deseja deletar esta rota?",
    });
  }

  async function deleteRoute(routeId) {
    if (!mapAccess.canEditRoutes) return;

    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao deletar rota.");
        return;
      }

      setRoutes((prev) => prev.filter((route) => route._id !== routeId));
      setHiddenRouteIds((prev) => prev.filter((id) => id !== routeId));
      setSelectedRoute(null);
      recordMapActivity("Rota deletada");
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar rota.");
    }
  }

  async function updateRoute() {
    if (!mapAccess.canEditRoutes) return;

    if (!editingRouteData.name.trim()) {
      alert("Digite um nome para a rota.");
      return;
    }

    const nextRouteName = editingRouteData.name.trim();
    const nextRouteDescription = editingRouteData.description?.trim() || "";

    if (nextRouteName.length > MAX_ROUTE_TITLE_LENGTH) {
      alert(`O titulo da rota pode ter no maximo ${MAX_ROUTE_TITLE_LENGTH} caracteres.`);
      return;
    }

    if (nextRouteDescription.length > MAX_ROUTE_DESCRIPTION_LENGTH) {
      alert(`A descricao da rota pode ter no maximo ${MAX_ROUTE_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    try {
      const response = await fetch(`/api/routes/${selectedRoute._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextRouteName,
          description: nextRouteDescription,
          color: editingRouteData.color,
          width: editingRouteData.width,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao atualizar rota.");
        return;
      }
      setRoutes((prev) =>
        prev.map((route) =>
          route._id === selectedRoute._id
            ? {
                ...route,
                name: nextRouteName,
                description: nextRouteDescription,
                color: editingRouteData.color,
                width: editingRouteData.width,
              }
            : route
        )
      );

      setSelectedRoute(null);
      setIsEditingRoute(false);
      setRouteColorPickerOpen(false);
      rememberRouteColor(editingRouteData.color);
      recordMapActivity("Rota editada");
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar rota.");
    }
  }

  function undoLastPoint() {
    setRoutePoints((prev) => prev.slice(0, -1));
  }

  function clearRoutePoints() {
    if (!deleteConfirm || deleteConfirm.type !== "clearRoutePoints") {
      setDeleteConfirm({
        type: "clearRoutePoints",
        title: "Limpar pontos?",
        message: "Limpar todos os pontos desta rota?",
      });
      return;
    }

    setDeleteConfirm(null);
    setRoutePoints([]);
  }

  function handleMapMouseMove(event) {
    if (noteMoveRef.current && selectedNote) {
      updateMovingNotePositionFromClient(event.clientX, event.clientY);
      return;
    }

    const dragPoint = mapMouseDownPointRef.current;

    if (dragPoint) {
      const distance = Math.hypot(
        event.clientX - dragPoint.clientX,
        event.clientY - dragPoint.clientY
      );

      if (distance > 4) {
        mapDragRef.current = true;
      }
    }

    if (isAddingNote && noteDragStart) {
      const point = getMapPointFromClient(event.clientX, event.clientY);

      if (point) {
        setNoteDraftRect(normalizeNoteRect(noteDragStart, point));
      }
      return;
    }

    if (!isDrawingRoute) return;

    const point = getMapPointFromClient(event.clientX, event.clientY);

    if (point) {
      setMousePoint(point);
    }
  }

  function normalizeNoteRect(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return clampNoteRect({
      x,
      y,
      width: Math.max(2, width),
      height: Math.max(2, height),
    });
  }

  function clampNoteRect(rect, imageWrapper = document.querySelector(".imageWrapper")) {
    if (!imageWrapper) return rect;

    const limits = getMapPointLimits(imageWrapper);
    const maxX = limits.maxX - rect.width;
    const maxY = limits.maxY - rect.height;

    return {
      ...rect,
      x: Math.max(limits.minX, Math.min(maxX, rect.x)),
      y: Math.max(limits.minY, Math.min(maxY, rect.y)),
    };
  }

  function openNoteEditor(note) {
    if (!mapAccess.canEditPins) return;

    closeContextMenu();
    setIsAddingPin(false);
    setIsAddingNote(false);
    setIsDrawingRoute(false);
    setRouteMouseDownPoint(null);
    setMousePoint(null);
    setSelectedNote(note);
    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);
    setNoteForm({
      title: note.title || "",
      text: note.text || "",
    });
  }

  async function createNote(rect) {
    if (!mapAccess.canEditPins) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...rect,
          title: "Note",
          text: "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao criar nota.");
        return;
      }

      setNotes((prev) => [...prev, data.note]);
      openNoteEditor(data.note);
      recordMapActivity("Nota criada");
    } catch (error) {
      console.error("Erro ao criar nota:", error);
      alert("Erro ao criar nota.");
    }
  }

  async function saveNote(note = selectedNote) {
    if (!mapAccess.canEditPins || !note) return;

    const noteElement = document.querySelector(`[data-note-id="${note._id}"]`);
    let nextNote = {
      ...note,
      title: noteForm.title.slice(0, MAX_NOTE_TITLE_LENGTH),
      text: noteForm.text.slice(0, MAX_NOTE_TEXT_LENGTH),
    };

    if (noteElement) {
      const wrapper = noteElement.closest(".imageWrapper");
      const wrapperRect = wrapper?.getBoundingClientRect();
      const noteRect = noteElement.getBoundingClientRect();
      const noteScale = Math.max(0.01, mapNoteSize / 50);

      if (wrapperRect?.width && wrapperRect?.height) {
        nextNote = clampNoteRect({
          ...nextNote,
          x: ((noteRect.left - wrapperRect.left) / wrapperRect.width) * 100,
          y: ((noteRect.top - wrapperRect.top) / wrapperRect.height) * 100,
          width: (noteRect.width / noteScale / wrapperRect.width) * 100,
          height: (noteRect.height / noteScale / wrapperRect.height) * 100,
        }, wrapper);
      }
    }

    try {
      const response = await fetch(`/api/notes/${note._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextNote),
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao salvar nota.");
        return;
      }

      setNotes((prev) =>
        prev.map((currentNote) =>
          currentNote._id === note._id ? nextNote : currentNote
        )
      );
      setSelectedNote(null);
      recordMapActivity("Nota editada");
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      alert("Erro ao salvar nota.");
    }
  }

  function cancelNoteEdit() {
    setSelectedNote(null);
    setNoteForm({ title: "", text: "" });
  }

  function closeNoteEditor() {
    setSelectedNote(null);
    setNoteForm({ title: "", text: "" });
    stopMoveNote();
  }

  function requestDeleteNote(note = selectedNote) {
    if (!note) return;

    setDeleteConfirm({
      type: "note",
      payload: note,
      title: "Deletar nota?",
      message: "Deseja deletar esta nota?",
    });
  }

  async function deleteNote(note = selectedNote) {
    if (!mapAccess.canEditPins || !note) return;

    try {
      const response = await fetch(`/api/notes/${note._id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao deletar nota.");
        return;
      }

      setNotes((prev) => prev.filter((currentNote) => currentNote._id !== note._id));
      setSelectedNote(null);
      recordMapActivity("Nota deletada");
    } catch (error) {
      console.error("Erro ao deletar nota:", error);
      alert("Erro ao deletar nota.");
    }
  }

  function startMoveNote(event, note) {
    event.preventDefault();
    event.stopPropagation();
    noteMoveCleanupRef.current?.();

    const cursorPoint = getMapPointFromClient(event.clientX, event.clientY);

    if (!cursorPoint) return;

    noteMoveRef.current = {
      noteId: note._id,
      offsetX: cursorPoint.x - note.x,
      offsetY: cursorPoint.y - note.y,
    };

    function handleDocumentNoteMouseMove(moveEvent) {
      moveEvent.preventDefault();
      updateMovingNotePositionFromClient(moveEvent.clientX, moveEvent.clientY);
    }

    function handleDocumentNoteMouseUp() {
      stopMoveNote();
    }

    window.addEventListener("mousemove", handleDocumentNoteMouseMove);
    window.addEventListener("mouseup", handleDocumentNoteMouseUp);

    noteMoveCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleDocumentNoteMouseMove);
      window.removeEventListener("mouseup", handleDocumentNoteMouseUp);
      noteMoveCleanupRef.current = null;
    };
  }

  function updateMovingNotePositionFromClient(clientX, clientY) {
    const moveState = noteMoveRef.current;

    if (!moveState) return;

    const point = getMapPointFromClient(clientX, clientY);

    if (!point) return;

    setSelectedNote((prev) =>
      prev?._id === moveState.noteId
        ? clampNoteRect({
            ...prev,
            x: point.x - moveState.offsetX,
            y: point.y - moveState.offsetY,
          })
        : prev
    );
  }

  function stopMoveNote() {
    noteMoveRef.current = null;
    noteMoveCleanupRef.current?.();
  }

  function handleNoteResize(event) {
    const noteElement = event.currentTarget;
    const wrapper = noteElement.closest(".imageWrapper");
    const wrapperRect = wrapper?.getBoundingClientRect();
    const noteRect = noteElement.getBoundingClientRect();
    const noteScale = Math.max(0.01, mapNoteSize / 50);

    if (!wrapperRect?.width || !wrapperRect?.height) return;

    setSelectedNote((prev) =>
      prev
        ? clampNoteRect({
            ...prev,
            width: (noteRect.width / noteScale / wrapperRect.width) * 100,
            height: (noteRect.height / noteScale / wrapperRect.height) * 100,
          }, wrapper)
        : prev
    );
  }

  function toggleRouteVisibility(routeId) {
    setHiddenRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  }

  function selectRouteFromList(route) {
    if (isAddingPin) return;
    if (!mapAccess.canEditRoutes) return;

    closeNoteEditor();
    const isSame = selectedRoute?._id === route._id;

    if (isSame) {
      // ðŸ”´ clicou na mesma â†’ deseleciona
      setSelectedRoute(null);
      setIsEditingRoute(false);
      return;
    }

    // ðŸŸ¢ nova seleÃ§Ã£o
    setSelectedRoute(route);
    setSelectedPin(null);
    centerMapOnRoute(route);

    setEditingRouteData({
      name: route.name,
      description: route.description || "",
      color: route.color || "#ef4444",
      width: route.width || DEFAULT_ROUTE_WIDTH,
    });

    setIsEditingRoute(true);
  }

  useEffect(() => {
    function handleChainPinPickEscape(event) {
      if (event.key === "Escape") {
        setChainPinPickTarget(null);
      }
    }

    if (!chainPinPickTarget) return undefined;

    window.addEventListener("keydown", handleChainPinPickEscape);

    return () => {
      window.removeEventListener("keydown", handleChainPinPickEscape);
    };
  }, [chainPinPickTarget]);

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
      closeNoteEditor();
      setSelectedRoute(route);
      setSelectedPin(null);
      setPinPopupPosition(null);
      setEditingRouteData({
        name: route.name,
        description: route.description || "",
        color: route.color || "#ef4444",
        width: route.width || DEFAULT_ROUTE_WIDTH,
      });
      setIsEditingRoute(true);
      centerMapOnRoute(route);
    }

    function selectPinByKeyboard(pin) {
      closeNoteEditor();
      setSelectedPin(pin);
      setSelectedRoute(null);
      setSelectedNote(null);
      setIsEditingRoute(false);
      setPinPopupPosition({
        x: pin.x,
        y: pin.y,
      });
      centerMapOnPin(pin);
    }

    function shouldBlockHeaderShortcut() {
      return (
        modalOpen ||
        mapSettingsOpen ||
        scaleSettingsOpen ||
        manageGroupsModalOpen ||
        manageRoutesModalOpen ||
        chainModalOpen ||
        destinationModalOpen ||
        chainChoiceOpen ||
        chainPinPickTarget ||
        activityLogOpen ||
        deleteConfirm ||
        movingPin ||
        isEditingRoute
      );
    }

    function handleHeaderShortcut(event) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return false;
      }

      const shortcut = event.key.toLowerCase();

      if (!["p", "r", "n", "s"].includes(shortcut)) {
        return false;
      }

      if (isTypingTarget(event.target) || shouldBlockHeaderShortcut()) {
        return false;
      }

      event.preventDefault();
      closeContextMenu();

      if (shortcut === "p") {
        startPinMode();
        return true;
      }

      if (shortcut === "r") {
        if (!isAddingPin) {
          startRouteMode();
        }
        return true;
      }

      if (shortcut === "n") {
        startNoteMode();
        return true;
      }

      if (shortcut === "s") {
        openScaleSettings();
        return true;
      }

      return false;
    }

    function handleKeyboardNavigation(event) {
      if (handleHeaderShortcut(event)) return;

      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (
        modalOpen ||
        mapSettingsOpen ||
        scaleSettingsOpen ||
        manageGroupsModalOpen ||
        manageRoutesModalOpen ||
        chainModalOpen ||
        destinationModalOpen ||
        chainChoiceOpen ||
        chainPinPickTarget ||
        activityLogOpen ||
        deleteConfirm ||
        isAddingPin ||
        isAddingNote ||
        isDrawingRoute ||
        movingPin
      ) {
        return;
      }

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
    activityLogOpen,
    chainChoiceOpen,
    chainModalOpen,
    chainPinPickTarget,
    deleteConfirm,
    destinationModalOpen,
    hiddenPinTypes,
    hiddenRouteIds,
    isAddingNote,
    isAddingPin,
    isDrawingRoute,
    isEditingRoute,
    manageGroupsModalOpen,
    manageRoutesModalOpen,
    mapSettingsOpen,
    scaleSettingsOpen,
    modalOpen,
    movingPin,
    orderedRoutes,
    pins,
    selectedPin,
    selectedRoute,
  ]);

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
          renderKey: `${category.value}:${type._id || type.iconKey}:${type.typeName}`,
          label: type.typeName,
          icon: type.icon,
          iconType: type.iconType || "emoji",
          iconImageUrl: type.iconImageUrl || "",
          backgroundColor: getPinBackgroundColor(type.backgroundColor),
          pinTypeId: type._id,
          count,
          iconKey: type.iconKey,
          category: type.category || "geral",
          systemType: type.systemType || null,
          systemLocked: !!type.systemLocked,
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

  const filteredPins = pins.filter((pin) => {
    const categoryMatches =
      categoryFilter === "all" || (pin.category || "geral") === categoryFilter;

    const typeKey = getPinIconKey(pin);
    const typeVisible = !hiddenPinTypes.includes(typeKey);

    return categoryMatches && typeVisible;
  });

  const mapEditorsCount = (() => {
    const editorKeys = new Set();
    const ownerKey =
      mapData?.ownerUsername || currentUser?.username || mapData?.ownerName;

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

  const mapEditorRows = Array.isArray(mapData?.editors)
    ? mapData.editors
        .map((editor) => {
          const username = getPublicUsername(
            editor.username || editor.name,
            "editor"
          );
          const userId = editor.userId || editor.user_id || "";

          return {
            ...editor,
            username,
            userId,
            key: userId || username,
            permission:
              editorPermissionDrafts[username] ??
              (editor.permission || editor.role || editor.access || ""),
          };
        })
        .filter((editor) => {
          const ownerUsername = getPublicUsername(
            mapData?.ownerUsername || currentUser?.username,
            "owner"
          );

          return editor.username !== ownerUsername;
        })
    : [];

  function editorHasPermission(editor, permission) {
    const value = String(editor.permission || "").toLowerCase();

    if (permission === "fullAccess") {
      return ["fullaccess", "full_access", "full", "editor"].includes(value);
    }

    if (permission === "pinEditor") {
      return ["pineditor", "pin_editor", "pin"].includes(value);
    }

    if (permission === "routeEditor") {
      return ["routeeditor", "route_editor", "route"].includes(value);
    }

    return false;
  }

  const availableEditorSearchResults = editorSearchResults.filter((user) => {
    const username = getPublicUsername(user.username, "");
    const ownerUsername = getPublicUsername(
      mapData?.ownerUsername || currentUser?.username,
      "owner"
    );

    if (!username || username === ownerUsername) return false;

    return !mapEditorRows.some((editor) => editor.username === username);
  });

  if (!loaded) {
    return <main className="loadingPage">Carregando...</main>;
  }

  if (!mapData) {
    return (
      <main className="loadingPage">
        <h1>Mapa nÃ£o encontrado</h1>
        <Link href="/">Voltar para dashboard</Link>
      </main>
    );
  }

  if (!mapAccess.canViewEditor) {
    return (
      <main className="loadingPage">
        <h1>VocÃª nÃ£o tem permissÃ£o para editar este mapa</h1>
        <Link href={`/map/${mapId}`}>Visualizar mapa</Link>
      </main>
    );
  }

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

  function openManageGroupsModal() {
    groupOrderSnapshotRef.current = pinCategories.map((category) => ({
      _id: category._id,
      sortOrder: category.sortOrder,
    }));
    setGroupOrderDirty(false);
    setManageGroupsModalOpen(true);
  }

  function restoreGroupOrderDraft() {
    const snapshot = groupOrderSnapshotRef.current;

    if (!groupOrderDirty || !snapshot) return;

    const sortOrderById = new Map(
      snapshot
        .filter((category) => category._id)
        .map((category) => [category._id, category.sortOrder])
    );

    setPinCategories((prev) =>
      prev.map((category) =>
        category._id && sortOrderById.has(category._id)
          ? {
              ...category,
              sortOrder: sortOrderById.get(category._id),
            }
          : category
      )
    );
  }

  function closeManageGroupsModal() {
    restoreGroupOrderDraft();
    setManageGroupsModalOpen(false);
    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
    setMoveMode(false);
    setMoveTargetGroup("");
    setCreateMode(null);
    setCreateValue("");
    resetCreateCategoryIcon();
    setCreateCategoryColor("#0f1014");
    setCategoryColorModal(null);
    setActiveManageUI(null);
    setGroupOrderDirty(false);
    setSavingGroupOrder(false);
    groupOrderSnapshotRef.current = null;
  }

  async function renameGroup(group) {
    if (isSystemGroup(group)) {
      alert("O grupo System nao pode ser renomeado.");
      return;
    }

    if (!group._id) {
      alert("Este grupo ainda nÃ£o tem ID editÃ¡vel.");
      return;
    }

    if (!renameValue.trim()) {
      alert("Digite um nome para o grupo.");
      return;
    }

    const newLabel = renameValue.trim();

    if (newLabel.length > MAX_GROUP_NAME_LENGTH) {
      alert(`O grupo pode ter no maximo ${MAX_GROUP_NAME_LENGTH} caracteres.`);
      return;
    }

    const response = await fetch(`/api/pin-categories/${group._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao renomear grupo.");
      return;
    }

    setPinCategories((prev) =>
      prev.map((category) =>
        category._id === group._id ? { ...category, label: newLabel } : category
      )
    );

    setExpandedManageItem((prev) => (prev ? { ...prev, label: newLabel } : prev));
    setRenameMode(false);
    setRenameValue(newLabel);
    recordMapActivity("Grupo renomeado");
  }

  function requestDeleteGroup(group) {
    if (isSystemGroup(group)) {
      alert("O grupo System nao pode ser deletado.");
      return;
    }

    if (!group._id) {
      alert("Este grupo ainda nÃƒÂ£o tem ID editÃƒÂ¡vel.");
      return;
    }

    setDeleteConfirm({
      type: "group",
      payload: group,
      title: "Deletar grupo?",
      message: "Deseja deletar este grupo e todos os pins dele?",
    });
  }

  async function deleteGroup(group) {
    if (!group._id) {
      alert("Este grupo ainda nÃ£o tem ID editÃ¡vel.");
      return;
    }

    const response = await fetch(`/api/pin-categories/${group._id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao deletar grupo.");
      return;
    }

    setPinCategories((prev) =>
      prev.filter((category) => category._id !== group._id)
    );

    setPins((prev) =>
      prev
        .filter((pin) => (pin.category || "geral") !== group.value)
        .map((pin) => ({
          ...pin,
          chainRequirements: Array.isArray(pin.chainRequirements)
            ? pin.chainRequirements.filter(
                (requirement) => requirement.category !== group.value
              )
            : [],
        }))
    );

    setSelectedPin((prev) => {
      if (!prev || (prev.category || "geral") === group.value) return null;

      return {
        ...prev,
        chainRequirements: Array.isArray(prev.chainRequirements)
          ? prev.chainRequirements.filter(
              (requirement) => requirement.category !== group.value
            )
          : [],
      };
    });

    setHiddenPinTypes((prev) =>
      prev.filter((key) => !group.types.some((type) => type.key === key))
    );

    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
    recordMapActivity("Grupo deletado");
  }

  async function renameCategory(type) {
    if (isSystemPortalType(type)) {
      alert("A categoria Portal nao pode ser renomeada.");
      return;
    }

    if (!type.pinTypeId) {
      alert("Esta categoria ainda nÃ£o tem ID editÃ¡vel.");
      return;
    }

    if (!renameValue.trim()) {
      alert("Digite um nome para a categoria.");
      return;
    }

    const newTypeName = renameValue.trim();

    if (newTypeName.length > MAX_CATEGORY_NAME_LENGTH) {
      alert(`A categoria pode ter no maximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.`);
      return;
    }

    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: newTypeName,
        category: type.category || "geral",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao renomear categoria.");
      return;
    }

    setPinTypes((prev) =>
      prev.map((pinType) =>
        pinType._id === type.pinTypeId
          ? { ...pinType, typeName: newTypeName }
          : pinType
      )
    );

    setPins((prev) =>
      prev.map((pin) =>
        getPinIconKey(pin) === type.iconKey
          ? { ...pin, typeName: newTypeName }
          : pin
      )
    );

    setExpandedManageItem((prev) =>
      prev ? { ...prev, label: newTypeName } : prev
    );

    setRenameMode(false);
    setRenameValue(newTypeName);
    recordMapActivity("Categoria renomeada");
  }

  async function deleteCategory(type) {
  console.log("Tentando deletar categoria:", type);

  if (isSystemPortalType(type)) {
    alert("A categoria Portal nao pode ser deletada.");
    return;
  }

  if (!type.pinTypeId) {
    alert("Esta categoria ainda nÃ£o tem ID editÃ¡vel.");
    return;
  }

  try {
    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "DELETE",
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    console.log("Resposta delete categoria:", response.status, data);

    if (!response.ok) {
      alert(data.error || "Erro ao deletar categoria.");
      return;
    }

    setPinTypes((prev) =>
      prev.filter((pinType) => pinType._id !== type.pinTypeId)
    );

    setPins((prev) =>
      prev
        .filter((pin) => getPinIconKey(pin) !== type.iconKey)
        .map((pin) => ({
          ...pin,
          chainRequirements: Array.isArray(pin.chainRequirements)
            ? pin.chainRequirements.filter(
                (requirement) =>
                  requirement.iconKey !== type.iconKey &&
                  !(
                    requirement.category === (type.category || "geral") &&
                    requirement.typeName === type.label
                  )
              )
            : [],
        }))
    );

    setSelectedPin((prev) => {
      if (!prev || getPinIconKey(prev) === type.iconKey) return null;

      return {
        ...prev,
        chainRequirements: Array.isArray(prev.chainRequirements)
          ? prev.chainRequirements.filter(
              (requirement) =>
                requirement.iconKey !== type.iconKey &&
                !(
                  requirement.category === (type.category || "geral") &&
                  requirement.typeName === type.label
                )
            )
          : [],
      };
    });

    setHiddenPinTypes((prev) => prev.filter((key) => key !== type.key));

    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
    setMoveMode(false);
    setActiveManageUI(null);
    recordMapActivity("Categoria deletada");
  } catch (error) {
    console.error("ERRO FRONT DELETE CATEGORY:", error);
    alert("Erro ao deletar categoria. Veja o console.");
  }
}

  function requestDeleteCategory(type) {
    if (!type.pinTypeId) {
      alert("Esta categoria ainda nÃƒÂ£o tem ID editÃƒÂ¡vel.");
      return;
    }

    setDeleteConfirm({
      type: "category",
      payload: type,
      title: "Deletar categoria?",
      message: "Deseja deletar esta categoria e todos os pins dela?",
    });
  }

  function requestRemoveEditor(editor) {
    setDeleteConfirm({
      type: "editor",
      payload: editor,
      title: "Remover editor?",
      message: `Deseja remover ${editor.username} da lista de editores?`,
    });
  }

  function canAddMoreEditors() {
    const editorCount = Array.isArray(mapData?.editors) ? mapData.editors.length : 0;

    return isSupporterAccount || editorCount < 1;
  }

  function showEditorSupporterLimit() {
    showSupporterFeatureModal("More than one editor");
  }

  async function addMapEditor(username) {
    const nextUsername = getPublicUsername(username, "").toLowerCase();

    if (!nextUsername) {
      alert("Digite um username.");
      return;
    }

    if (!canAddMoreEditors()) {
      showEditorSupporterLimit();
      return;
    }

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addEditor: { username: nextUsername },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.supporterOnly) {
          showEditorSupporterLimit();
          return;
        }

        alert(data.error || "Erro ao adicionar editor.");
        return;
      }

      setMapData((prev) => ({
        ...prev,
        editors: [...(prev?.editors || []), data.editor],
      }));
      setEditorPermissionDrafts((prev) => ({
        ...prev,
        [data.editor.username]: "",
      }));

      setAddEditorOpen(false);
      setEditorSearch("");
      setEditorSearchResults([]);
      recordMapActivity("Editor adicionado");
    } catch (error) {
      console.error("Erro ao adicionar editor:", error);
      alert("Erro ao adicionar editor.");
    }
  }

  function updateEditorPermission(editor, permission) {
    const nextPermission = editor.permission === permission ? "" : permission;
    setEditorPermissionDrafts((prev) => ({
      ...prev,
      [editor.username]: nextPermission,
    }));
  }

  async function removeEditor(editor) {
    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          removeEditor: {
            userId: editor.userId || "",
            username: editor.username || "",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao remover editor.");
        return;
      }

      setMapData((prev) => ({
        ...prev,
        editors: (prev?.editors || []).filter((currentEditor) => {
          const currentUserId = currentEditor.userId || currentEditor.user_id || "";
          const currentUsername = getPublicUsername(
            currentEditor.username || currentEditor.name,
            "editor"
          );

          if (editor.userId && currentUserId) {
            return currentUserId !== editor.userId;
          }

          return currentUsername !== editor.username;
        }),
      }));
      setEditorPermissionDrafts((prev) => {
        const next = { ...prev };
        delete next[editor.username];
        return next;
      });

      recordMapActivity("Editor removido");
    } catch (error) {
      console.error("Erro ao remover editor:", error);
      alert("Erro ao remover editor.");
    }
  }

  async function confirmDeleteAction() {
    if (!deleteConfirm) return;

    const pendingDelete = deleteConfirm;
    setDeleteConfirm(null);

    if (pendingDelete.type === "route") {
      await deleteRoute(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "pin") {
      await deletePin(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "note") {
      await deleteNote(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "group") {
      await deleteGroup(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "category") {
      await deleteCategory(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "editor") {
      await removeEditor(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "chainReset") {
      await resetPinChains(pendingDelete.payload);
      return;
    }

    if (pendingDelete.type === "chainRequirement") {
      await deletePinChainRequirement(
        pendingDelete.payload?.pin,
        pendingDelete.payload?.requirement
      );
      return;
    }

    if (pendingDelete.type === "clearPins") {
      await clearPins();
      return;
    }

    if (pendingDelete.type === "clearRoutePoints") {
      clearRoutePoints();
    }
  }

  async function moveCategory(type) {
    if (isSystemPortalType(type)) {
      alert("A categoria Portal nao pode ser movida.");
      return;
    }

    if (!type.pinTypeId) {
      alert("Categoria invÃ¡lida.");
      return;
    }

    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: type.label,
        category: moveTargetGroup,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao mover categoria.");
      return;
    }

    setPinTypes((prev) =>
      prev.map((pinType) =>
        pinType._id === type.pinTypeId
          ? { ...pinType, category: moveTargetGroup }
          : pinType
      )
    );

    setPins((prev) =>
      prev.map((pin) =>
        getPinIconKey(pin) === type.iconKey
          ? { ...pin, category: moveTargetGroup }
          : pin
      )
    );

    setMoveMode(false);
    setExpandedManageItem(null);
    recordMapActivity("Categoria movida");
  }

  async function createGroup() {
    if (!mapData?.groupId) {
      alert("Este mapa nÃ£o tem grupo de mapas.");
      return;
    }

    if (!createValue.trim()) {
      alert("Digite um nome para o grupo.");
      return;
    }

    const groupLabel = createValue.trim();

    if (groupLabel.length > MAX_GROUP_NAME_LENGTH) {
      alert(`O grupo pode ter no maximo ${MAX_GROUP_NAME_LENGTH} caracteres.`);
      return;
    }

    const maxOrder =
      pinCategories.length > 0
        ? Math.max(
            ...pinCategories.map((category, index) =>
              typeof category.sortOrder === "number"
                ? category.sortOrder
                : index + 1
            )
          )
        : 0;

    const response = await fetch(`/api/groups/${mapData.groupId}/pin-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: groupLabel,
        sortOrder: maxOrder + 1,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao criar grupo.");
      return;
    }

    const newGroup = data.category || data.pinCategory || data.group || data;

    setPinCategories((prev) => [
      ...prev,
      {
        ...newGroup,
        sortOrder:
          typeof newGroup.sortOrder === "number"
            ? newGroup.sortOrder
            : prev.length,
      },
    ]);
    setCreateMode(null);
    setCreateValue("");
    recordMapActivity("Grupo criado");
  }

  async function createCategoryInsideGroup(group) {
    if (!mapData?.groupId) {
      alert("Este mapa nÃ£o tem grupo de mapas.");
      return;
    }

    if (!createValue.trim()) {
      alert("Digite um nome para a categoria.");
      return;
    }

    const categoryName = createValue.trim();

    if (categoryName.length > MAX_CATEGORY_NAME_LENGTH) {
      alert(`A categoria pode ter no maximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.`);
      return;
    }

    const normalizedCategoryIcon = normalizePinIcon(createCategoryIcon);

    const isUsingPlaceholderIcon =
      createCategoryIconType === DEFAULT_PIN_ICON_TYPE &&
      createCategoryIconImageUrl === DEFAULT_PIN_ICON_IMAGE_URL;

    if (
      isUsingPlaceholderIcon ||
      (createCategoryIconType === "emoji" &&
      normalizedCategoryIcon === DEFAULT_PIN_ICON &&
      !createCategoryIconImageUrl)
    ) {
      alert("Escolha um Ã­cone para a categoria.");
      return;
    }

    const iconKey =
      createCategoryIconType === "custom"
        ? `custom:${createCategoryIconImageUrl}`
        : `emoji:${normalizedCategoryIcon}`;

    const iconAlreadyExists = pinTypes.some((type) => type.iconKey === iconKey);

    if (iconAlreadyExists) {
      alert("JÃ¡ existe uma categoria usando este Ã­cone.");
      return;
    }

    const response = await fetch(`/api/groups/${mapData.groupId}/pin-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: categoryName,
        category: group.value,
        icon: createCategoryIconType === "emoji" ? normalizedCategoryIcon : "",
        iconType: createCategoryIconType,
        iconImageUrl:
          createCategoryIconType === "custom" ? createCategoryIconImageUrl : "",
        backgroundColor: getPinBackgroundColor(createCategoryColor),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao criar categoria.");
      return;
    }

    setPinTypes((prev) => [...prev, data.pinType]);
    setCreateMode(null);
    setCreateValue("");
    resetCreateCategoryIcon();
    setCreateCategoryColor("#0f1014");
    rememberCategoryColor(createCategoryColor);
    setIconPickerOpen(false);
    recordMapActivity("Categoria criada");
  }

  function moveGroup(group, direction) {
    const currentIndex = sidebarCategories.findIndex(
      (category) => category.value === group.value
    );

    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sidebarCategories.length) return;

    const currentGroup = sidebarCategories[currentIndex];
    const targetGroup = sidebarCategories[targetIndex];

    if (!currentGroup._id || !targetGroup._id) {
      alert("NÃ£o Ã© possÃ­vel mover grupo virtual.");
      return;
    }

    const nextCategories = sidebarCategories.map((category, index) => ({
      ...category,
      sortOrder: index,
    }));

    const reordered = [...nextCategories];

    const [removed] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const finalCategories = reordered.map((category, index) => ({
      ...category,
      sortOrder: index,
    }));

    setPinCategories(finalCategories);
    setGroupOrderDirty(true);
  }

  async function saveGroupOrder() {
    if (!groupOrderDirty || savingGroupOrder) return;

    const categoriesToSave = sidebarCategories.filter((category) => category._id);

    if (categoriesToSave.length === 0) {
      setGroupOrderDirty(false);
      return;
    }

    setSavingGroupOrder(true);

    try {
      const responses = await Promise.all(
        categoriesToSave.map((category, index) =>
          fetch(`/api/pin-categories/${category._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sortOrder: index,
            }),
          })
        )
      );

      const failedResponse = responses.find((response) => !response.ok);

      if (failedResponse) {
        const data = await failedResponse.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao salvar ordem dos grupos.");
      }

      setPinCategories((prev) =>
        prev.map((category) => {
          const nextIndex = sidebarCategories.findIndex(
            (orderedCategory) => orderedCategory._id === category._id
          );

          return nextIndex >= 0
            ? {
                ...category,
                sortOrder: nextIndex,
              }
            : category;
        })
      );

      groupOrderSnapshotRef.current = sidebarCategories.map((category, index) => ({
        _id: category._id,
        sortOrder: index,
      }));
      setGroupOrderDirty(false);
      recordMapActivity("Grupos ordenados");
    } catch (error) {
      console.error("ERRO AO SALVAR ORDEM DOS GRUPOS:", error);
      alert(error.message || "Erro ao salvar ordem dos grupos.");
    } finally {
      setSavingGroupOrder(false);
    }
  }

  function openMapContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

      if (movingPin) return;
      if (isAddingPin) return;
      if (isDrawingRoute) return;
      if (!mapAccess.canEditPins && !mapAccess.canEditRoutes) return;

    closeNoteEditor();
    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
    setPinPopupPosition(null);

    const imageWrapper = event.currentTarget;
    const rect = imageWrapper.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setContextMenu({
      screenX: event.clientX,
      screenY: event.clientY,
      mapX: x,
      mapY: y,
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function addPinFromContextMenu() {
    if (!mapAccess.canEditPins) return;

    closeNoteEditor();
    const defaultForm = getDefaultPinForm();

    setPendingPosition({
      x: contextMenu.mapX,
      y: contextMenu.mapY,
    });

    setEditingPin(null);
    setForm(defaultForm);
    setModalOpen(true);
    setIsAddingPin(false);
    setIsDrawingRoute(false);
    closeContextMenu();
  }

  function addRouteFromContextMenu() {
    if (!mapAccess.canEditRoutes) return;

    closeContextMenu();
    startRouteMode();
  }

  function addNoteFromContextMenu() {
    if (!mapAccess.canEditPins || !contextMenu) return;

    closeNoteEditor();
    const rect = {
      x: contextMenu.mapX,
      y: contextMenu.mapY,
      width: 7,
      height: 5,
    };

    closeContextMenu();
    createNote(clampNoteRect(rect));
  }

  function getMapPointFromEvent(event) {
    const point = getMapPointFromClient(event.clientX, event.clientY);

    return {
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function handleMapMouseDown(event) {
    const point = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    mapMouseDownPointRef.current = point;
    mapDragRef.current = false;
    setMapMouseDownPoint(point);

    if (isAddingNote && event.button === 0) {
      const mapPoint = getMapPointFromEvent(event);
      setNoteDragStart(mapPoint);
      setNoteDraftRect({
        x: mapPoint.x,
        y: mapPoint.y,
        width: 2,
        height: 2,
      });
      return;
    }

    if (!isDrawingRoute || event.button !== 0) return;

    setRouteMouseDownPoint(getMapPointFromEvent(event));
  }

  function handleMapMouseUp(event) {
    if (noteMoveRef.current) {
      stopMoveNote();
      return;
    }

    if (
      event.target.closest?.(".routeSnapHitbox") ||
      event.target.closest?.(".routeSnapButton")
    ) {
      return;
    }

    if (isAddingNote && event.button === 0 && noteDragStart) {
      const point = getMapPointFromEvent(event);
      const rect = normalizeNoteRect(noteDragStart, point);
      setNoteDragStart(null);
      setNoteDraftRect(null);
      setIsAddingNote(false);

      if (rect.width >= 2 && rect.height >= 2) {
        createNote(rect);
      }
      return;
    }

    if (!isDrawingRoute || event.button !== 0 || !routeMouseDownPoint) return;

    const point = getMapPointFromEvent(event);

    const distance = Math.hypot(
      point.clientX - routeMouseDownPoint.clientX,
      point.clientY - routeMouseDownPoint.clientY
    );

    setRouteMouseDownPoint(null);

    if (distance > 4) return;

    setRoutePoints((prev) => [
      ...prev,
      {
        x: point.x,
        y: point.y,
      },
    ]);
  }

  function centerMap() {
    if (!transformApiRef.current?.setTransform) return;

    const wrapper = document.querySelector(".transformWrapper");
    const content = document.querySelector(".imageWrapper");

    if (!wrapper || !content) return;

    const scale = 1;

    const x = (wrapper.clientWidth - content.offsetWidth * scale) / 2;
    const y = (wrapper.clientHeight - content.offsetHeight * scale) / 2;

    transformApiRef.current.setTransform(x, y, scale, 200);
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

  async function updateCategoryIcon(type, iconData) {
    const iconKey =
      iconData.iconType === "custom"
        ? `custom:${iconData.iconImageUrl}`
        : `emoji:${iconData.icon}`;

    const iconAlreadyExists = pinTypes.some(
      (pinType) =>
        pinType.iconKey === iconKey &&
        pinType._id !== type.pinTypeId
    );

    if (iconAlreadyExists) {
      alert("JÃ¡ existe uma categoria usando este Ã­cone.");
      return;
    }

    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: type.label,
        category: type.category || "geral",
        icon: iconData.icon || "",
        iconType: iconData.iconType,
        iconImageUrl: iconData.iconImageUrl || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao alterar Ã­cone.");
      return;
    }

    setPinTypes((prev) =>
      prev.map((pinType) =>
        pinType._id === type.pinTypeId
          ? {
              ...pinType,
              icon: iconData.icon || "",
              iconType: iconData.iconType,
              iconImageUrl: iconData.iconImageUrl || "",
              iconKey,
            }
          : pinType
      )
    );

    setPins((prev) =>
      prev.map((pin) =>
        getPinIconKey(pin) === type.iconKey
          ? {
              ...pin,
              icon: iconData.icon || "",
              iconType: iconData.iconType,
              iconImageUrl: iconData.iconImageUrl || "",
              iconKey,
            }
          : pin
      )
    );

    setIconPickerOpen(false);
    setEditingIconCategory(null);
    setIconPickerMode("create");
    setIconPickerDraft(null);
    recordMapActivity("Icone da categoria alterado");
  }

  async function updateCategoryColor(type, color) {
    const nextColor = getPinBackgroundColor(color);

    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: type.label,
        category: type.category || "geral",
        icon: type.icon || "",
        iconType: type.iconType || "emoji",
        iconImageUrl: type.iconImageUrl || "",
        backgroundColor: nextColor,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao alterar cor.");
      return;
    }

    setPinTypes((prev) =>
      prev.map((pinType) =>
        pinType._id === type.pinTypeId
          ? {
              ...pinType,
              backgroundColor: nextColor,
            }
          : pinType
      )
    );

    rememberCategoryColor(nextColor);
    recordMapActivity("Cor da categoria alterada");
  }

  function openCreateIconPicker() {
    setIconPickerMode("create");
    setEditingIconCategory(null);
    setIconPickerDraft({
      icon: normalizePinIcon(createCategoryIcon),
      iconType: createCategoryIconType,
      iconImageUrl: createCategoryIconImageUrl,
    });
    setIconPickerOpen(true);
    setIconPickerTab("default");
  }

  function openEditIconPicker(type) {
    const iconImageUrl = type.iconImageUrl || "";

    setIconPickerMode("edit");
    setEditingIconCategory(type);
    setIconPickerDraft({
      icon: normalizePinIcon(type.icon),
      iconType: type.iconType || "emoji",
      iconImageUrl,
    });
    setIconPickerOpen(true);
    setIconPickerTab(
      type.iconType === "custom" && !isDefaultPinIconImageUrl(iconImageUrl)
        ? "custom"
        : "default"
    );
    setRenameMode(false);
    setMoveMode(false);
  }

  function closeIconPicker() {
    setIconPickerOpen(false);
    setEditingIconCategory(null);
    setIconPickerMode("create");
    setIconPickerDraft(null);
  }

  function saveIconPickerSelection() {
    if (!iconPickerDraft) return;

    if (iconPickerMode === "edit" && editingIconCategory) {
      updateCategoryIcon(editingIconCategory, iconPickerDraft);
      return;
    }

    setCreateCategoryIconType(iconPickerDraft.iconType);
    setCreateCategoryIcon(
      iconPickerDraft.iconType === "emoji" ? iconPickerDraft.icon : DEFAULT_PIN_ICON
    );
    setCreateCategoryIconImageUrl(
      iconPickerDraft.iconType === "custom"
        ? iconPickerDraft.iconImageUrl || DEFAULT_PIN_ICON_IMAGE_URL
        : ""
    );
    closeIconPicker();
  }

  function openManageUI(key) {
    closeNoteEditor();
    setActiveManageUI((prev) => (prev === key ? null : key));

    setRenameMode(false);
    setMoveMode(false);
    setExpandedManageItem(null);
    setCategoryColorModal(null);
  }

  function renderCategoryColorPicker({ mode, type, groupValue, value }) {
    const currentColor = getPinBackgroundColor(value);

    return (
      <div className="categoryColorPicker">
        <button
          type="button"
          className="categoryColorButton"
          style={{ backgroundColor: currentColor }}
          title="Cor da categoria"
          onClick={(event) => {
            event.stopPropagation();
            setCategoryColorModal({
              mode,
              groupValue,
              type,
              draft: currentColor,
            });
          }}
        />
      </div>
    );
  }

  function closeCategoryColorModal() {
    setCategoryColorModal(null);
  }

  async function saveCategoryColorModal() {
    if (!categoryColorModal) return;

    const nextColor = getPinBackgroundColor(categoryColorModal.draft);

    if (categoryColorModal.mode === "create") {
      setCreateCategoryColor(nextColor);
      rememberCategoryColor(nextColor);
      closeCategoryColorModal();
      return;
    }

    if (categoryColorModal.type) {
      await updateCategoryColor(categoryColorModal.type, nextColor);
    }

    closeCategoryColorModal();
  }

  function moveRoute(route, direction) {
    const currentIndex = routeOrderDraft.findIndex(
      (item) => item._id === route._id
    );

    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= routeOrderDraft.length) return;

    const reordered = [...routeOrderDraft];
    const [removed] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    const finalRoutes = reordered.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    setRouteOrderDraft(finalRoutes);
  }

  async function saveRouteOrder() {
    try {
      await Promise.all(
        routeOrderDraft.map((route, index) =>
          fetch(`/api/routes/${route._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: index }),
          })
        )
      );

      setRoutes(
        routeOrderDraft.map((route, index) => ({
          ...route,
          sortOrder: index,
        }))
      );

      setManageRoutesModalOpen(false);
      recordMapActivity("Rotas ordenadas");
    } catch (error) {
      console.error("ERRO AO SALVAR ORDEM DAS ROTAS:", error);
      alert("Erro ao salvar ordem das rotas.");
    }
  }

  function startMovePin(pin, event) {
    if (!mapAccess.canEditPins) return;

    const cursorPosition = event
      ? getMapPointFromClient(event.clientX, event.clientY)
      : null;

    setMovingPin(pin);
    setMovingPinPosition({
      x: cursorPosition?.x ?? pin.x,
      y: cursorPosition?.y ?? pin.y,
    });

    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
  }

  function updateMovingPinPositionFromClient(clientX, clientY) {
    if (!movingPin) return;

    const point = getMapPointFromClient(clientX, clientY);

    if (!point) return;

    setMovingPinPosition({
      x: point.x,
      y: point.y,
    });
  }

  function handleMovePinMouseMove(event) {
    updateMovingPinPositionFromClient(event.clientX, event.clientY);
  }

  async function finishMovePin(pinToMove = movingPin, positionToSave = movingPinPosition) {
    if (!mapAccess.canEditPins) return;

    if (!pinToMove || !positionToSave) return;

    try {
      const response = await fetch(`/api/pins/${pinToMove._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: pinToMove.name,
          typeName: pinToMove.typeName,
          description: pinToMove.description || "",
          icon: normalizePinIcon(pinToMove.icon),
          iconType: pinToMove.iconType || "emoji",
          iconImageUrl: pinToMove.iconImageUrl || "",
          iconKey: pinToMove.iconKey || getPinIconKey(pinToMove),
          category: pinToMove.category || "geral",
          x: positionToSave.x,
          y: positionToSave.y,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Erro ao mover pin.");
        return;
      }

      setPins((prev) =>
        prev.map((pin) =>
          pin._id === pinToMove._id
            ? {
                ...pin,
                x: positionToSave.x,
                y: positionToSave.y,
              }
            : pin
        )
      );

      setMovingPin(null);
      setMovingPinPosition(null);
      recordMapActivity("Pin movido");
    } catch (error) {
      console.error(error);
      alert("Erro ao mover pin.");
    }
  }

  function cancelMovePin() {
    setMovingPin(null);
    setMovingPinPosition(null);
  }

  return (
    <main className="page" onClick={closeContextMenu}>
      {isMounted &&
        headerConfigMenuOpen &&
        headerConfigMenuPosition &&
        createPortal(
          <div
            className="headerConfigMenu"
            role="menu"
            style={{
              top: `${headerConfigMenuPosition.top}px`,
              left: `${headerConfigMenuPosition.left}px`,
            }}
          >
            <button type="button" onClick={openMapSettings}>
              <img src="/api/site-icons/cog_settings_2" alt="" />
              Configurações do mapa
            </button>
            <button type="button" onClick={openActivityLog}>
              <img src="/api/site-icons/book_settings" alt="" />
              Log History
            </button>
          </div>,
          document.body
        )}

      <aside
        className={sidebarCollapsed ? "mapSidebar collapsed" : "mapSidebar"}
        onClickCapture={closeNoteEditor}
      >
        <button
          className="sidebarCollapseButton"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
        >
          {sidebarCollapsed ? "\u203A" : "\u2039"}
        </button>

        {!sidebarCollapsed && (
          <PinSidebarContent
            title={mapData.title}
            subtitle={t("map.interactiveMap")}
            pinGroups={pinGroups}
            hiddenPinTypes={hiddenPinTypes}
            hideEmptyGroups={hideEmptyGroups}
            search={sidebarSearch}
            canManage={mapAccess.canManagePinGroups}
            manageDisabled={!!movingPin}
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
            onManage={openManageGroupsModal}
            onToggleCategoryVisibility={toggleCategoryVisibility}
            onTogglePinTypeVisibility={togglePinTypeVisibility}
          />
        )}

        {false && !sidebarCollapsed && (
          <>
            <div className="sidebarHeader">
              <h2>{mapData.title}</h2>
              <p>Editor Map</p>
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

            <button
              disabled={!!movingPin}
              className="sidebarEditButton"
              onClick={openManageGroupsModal}
            >
              Gerenciar Grupo | Categoria
            </button>

            {pinGroups.length === 0 ? (
              <div className="sidebarPlaceholder">Nenhum grupo encontrado.</div>
            ) : (
              <div className="sidebarCategoryList">
                {pinGroups.map((category) => {
                  const allHidden =
                    category.types.length > 0 &&
                    category.types.every((type) =>
                      hiddenPinTypes.includes(type.key)
                    );

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
                              key={type.renderKey}
                              className={
                                typeHidden
                                  ? "sidebarTypeItem hidden"
                                  : "sidebarTypeItem"
                              }
                              onClick={() => togglePinTypeVisibility(type.key)}
                            >
                              <span className="sidebarTypeIcon">
                                {type.iconType === "custom" && type.iconImageUrl ? (
                                  <img src={type.iconImageUrl} alt={type.label} />
                                ) : (
                                  normalizePinIcon(type.icon)
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

          </>
        )}
      </aside>

      <aside
        className={
          routeSidebarCollapsed
            ? "mapSidebar routeMapSidebar collapsed"
            : "mapSidebar routeMapSidebar"
        }
        onClickCapture={closeNoteEditor}
      >
        <button
          className="sidebarCollapseButton"
          onClick={() => setRouteSidebarCollapsed((prev) => !prev)}
        >
          {routeSidebarCollapsed ? "\u2039" : "\u203A"}
        </button>

        {!routeSidebarCollapsed && (
          <RouteSidebarContent
            routes={routes}
            filteredRoutes={filteredRoutes}
            hiddenRouteIds={hiddenRouteIds}
            selectedRoute={selectedRoute}
            routeSearch={routeSearch}
            routeEffectsEnabled={routeEffectsEnabled}
            canManage={mapAccess.canManageRoutes}
            manageDisabled={!!movingPin}
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
              save: t("actions.save"),
              cancel: t("actions.cancel"),
            }}
            onSearchChange={setRouteSearch}
            onShowAll={showAllRoutes}
            onHideAll={hideAllRoutes}
            onToggleEffects={() => setRouteEffectsEnabled((prev) => !prev)}
            onExportTxtRoutes={exportRoutesTxt}
            onExportLivesplitRoutes={exportRoutesLivesplit}
            onManageRoutes={() => {
              setRouteOrderDraft(orderedRoutes);
              setManageRoutesModalOpen(true);
            }}
            onSelectRoute={(route) => {
              if (movingPin) return;
              selectRouteFromList(route);
            }}
            onToggleRouteVisibility={toggleRouteVisibility}
            selectedRouteDescriptionValue={editingRouteData?.description || ""}
            routeDescriptionMaxLength={MAX_ROUTE_DESCRIPTION_LENGTH}
            onSelectedRouteDescriptionChange={(description) => {
              if (isDrawingRoute || !selectedRoute) return;

              setEditingRouteData((prev) =>
                prev
                  ? {
                      ...prev,
                      description: description.slice(0, MAX_ROUTE_DESCRIPTION_LENGTH),
                    }
                  : prev
              );
            }}
            onSaveSelectedRouteDescription={updateRoute}
            onCancelSelectedRouteDescription={() => {
              if (!selectedRoute) return;

              setEditingRouteData((prev) =>
                prev
                  ? {
                      ...prev,
                      description: selectedRoute.description || "",
                    }
                  : prev
              );
            }}
          />
        )}

        {false && !routeSidebarCollapsed && (
          <>
            <div className="sidebarHeader">
              <h2>Rotas</h2>
              <p>{routes.length} rota(s)</p>
            </div>

            <div className="sidebarActions">
              <button onClick={showAllRoutes}>Show All</button>
              <button onClick={hideAllRoutes}>Hide All</button>

              <button onClick={() => setRouteEffectsEnabled((prev) => !prev)}>
                {routeEffectsEnabled ? "Effect ON" : "Effect OFF"}
              </button>
            </div>

            <div className="sidebarSearch">
              <input
                value={routeSearch}
                onChange={(event) => setRouteSearch(event.target.value)}
                placeholder="Search routes..."
              />
            </div>

            <button
              disabled={!!movingPin}
              className="sidebarEditButton"
              onClick={() => {
                setRouteOrderDraft(orderedRoutes);
                setManageRoutesModalOpen(true);
              }}
            >
              Ordenar Rotas
            </button>

            {filteredRoutes.length === 0 ? (
              <div className="sidebarPlaceholder">Nenhuma rota encontrada.</div>
            ) : (
              <div className="routeList">
                {filteredRoutes.map((route, index) => {
                  const isHidden = hiddenRouteIds.includes(route._id);
                  const isSelected = selectedRoute?._id === route._id;

                  return (
                    <div
                      key={route._id}
                      className={isSelected ? "routeListItem selected" : "routeListItem"}
                    >
                      <button
                        className="routeListMain"
                        onClick={() => {
                            if (movingPin) return;
                            selectRouteFromList(route);
                          }}
                        title={route.name}
                      >
                        <span className="routeIndex">{index + 1}</span>

                        <span
                          className="routeColorDot"
                          style={{
                            background:
                              selectedRoute?._id === route._id
                                ? editingRouteData?.color || route.color || "#ef4444"
                                : route.color || "#ef4444",
                          }}
                        />

                        <span className={isHidden ? "routeHiddenText" : ""}>
                          {route.name}
                        </span>
                      </button>

                      <button
                        className={isHidden ? "routeEyeButton hidden" : "routeEyeButton"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRouteVisibility(route._id);
                        }}
                        title={isHidden ? "Mostrar rota" : "Ocultar rota"}
                      >
                        {isHidden ? "\uD83D\uDE48" : "\uD83D\uDC41\uFE0F"}
                      </button>

                      {isSelected && (
                        <div className="routeListDescription">
                          {route.description || "Sem descriÃ§Ã£o."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </aside>

      <header className="topbar editorTopbar">
        <div>
          <h1>{mapData.title}</h1>
          <p>{t("map.subtitleEditor")}</p>
        </div>

        <div className="topbarRight">
        {movingPin ? (
            <div className="movePinHeader">
              <span className="movePinText">
                {t("map.movePin")}
              </span>

              <button className="secondary" onClick={cancelMovePin}>
                {t("actions.cancel")}
              </button>
            </div>
          ) : (
            <>
              {isDrawingRoute || selectedRoute ? (
                <div className="routeEditingBar">
                  <div className="routeLeft">
                    <strong>
                      {isDrawingRoute ? t("route.creating") : t("route.editing")}
                    </strong>
                    <span>
                      {isDrawingRoute
                        ? `${routePoints.length} ${t("route.points")}`
                        : t("map.editMode")}
                    </span>
                  </div>

                  <div className="routeCenter">
                    <input
                      value={isDrawingRoute ? routeName : editingRouteData?.name || ""}
                      maxLength={MAX_ROUTE_TITLE_LENGTH}
                      onChange={(event) => {
                        const nextName = event.target.value.slice(
                          0,
                          MAX_ROUTE_TITLE_LENGTH
                        );

                        if (isDrawingRoute) {
                          setRouteName(nextName);
                        } else {
                          setEditingRouteData((prev) => ({
                            ...prev,
                            name: nextName,
                          }));
                        }
                      }}
                      placeholder={t("route.name")}
                    />

                  </div>

                  <div className="routeRight">
                    <div>
                    <div
                      ref={routeColorPickerRef}
                      className="routeColorPicker"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="routeColorPickerButton"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRouteColorPickerOpen((prev) => !prev);
                        }}
                        title={t("common.color")}
                      >
                        <span
                          className="routeColorPreview"
                          style={{ background: getActiveRouteColor() }}
                        />
                      </button>

                      {routeColorPickerOpen && (
                        <div className="routeColorPopover">
                          <div className="routeColorRows">
                            <div className="routeColorRow">
                              <span>Recent</span>
                              <div className="routeColorSwatches">
                                {recentRouteColors.length > 0 ? (
                                  recentRouteColors.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      className="routeColorSwatch"
                                      style={{ background: color }}
                                      title={color}
                                      onClick={() =>
                                        setActiveRouteColor(color, {
                                          custom: !isRouteColorPreset(color),
                                        })
                                      }
                                    />
                                  ))
                                ) : (
                                  <span className="routeColorEmpty">-</span>
                                )}
                              </div>
                            </div>

                            <div className="routeColorRow">
                              <span>Presets</span>
                              <div className="routeColorSwatches">
                                {ROUTE_COLOR_PRESETS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    className={
                                      getActiveRouteColor() === color
                                        ? "routeColorSwatch selected"
                                        : "routeColorSwatch"
                                    }
                                    style={{ background: color }}
                                    title={color}
                                    onClick={() => setActiveRouteColor(color)}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="routeColorPopoverFields">
                            <div className="routeColorNative">
                              <span>Custom</span>
                              <span
                                className={
                                  isSupporterAccount
                                    ? "routeNativeColorControl"
                                    : "routeNativeColorControl disabled"
                                }
                                onClick={() => {
                                  if (!isSupporterAccount) {
                                    showSupporterFeatureModal("Custom route colors");
                                  }
                                }}
                              >
                                <span
                                  className="routeNativeColorFill"
                                  style={{ background: getActiveRouteColor() }}
                                />
                                <input
                                  type="color"
                                  className="routeNativeColorInput"
                                  value={getActiveRouteColor()}
                                  disabled={!isSupporterAccount}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onInput={(event) =>
                                    setActiveRouteColor(event.currentTarget.value, {
                                      custom: true,
                                    })
                                  }
                                  onChange={(event) =>
                                    setActiveRouteColor(event.target.value, {
                                      custom: true,
                                    })
                                  }
                                />
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <label>
                      {isDrawingRoute ? routeWidth : editingRouteData?.width || DEFAULT_ROUTE_WIDTH}px
                      <input
                        type="range"
                        min="2"
                        max="10"
                        value={isDrawingRoute ? routeWidth : editingRouteData?.width || DEFAULT_ROUTE_WIDTH}
                        onChange={(event) => {
                          const value = Number(event.target.value);

                          if (isDrawingRoute) {
                            setRouteWidth(value);
                          } else {
                            setEditingRouteData((prev) => ({
                              ...prev,
                              width: value,
                            }));
                          }
                        }}
                      />
                    </label>
                    </div>
                    <div>
                    {isDrawingRoute && (
                      <>
                        <button onClick={undoLastPoint} disabled={routePoints.length === 0}>
                          {"\u21B6"}
                        </button>

                        <button onClick={clearRoutePoints} disabled={routePoints.length === 0}>
                          {"\u00D7"}
                        </button>
                      </>
                    )}

                    {isDrawingRoute ? (
                      <>
                        <button className="primary" onClick={saveRoute}>
                          {t("actions.save")}
                        </button>

                        <button className="danger" onClick={cancelRouteMode}>
                          {t("actions.cancel")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="primary" onClick={updateRoute}>
                          {t("actions.save")}
                        </button>

                        <button
                          className="danger"
                          onClick={() => requestDeleteRoute(selectedRoute._id)}
                        >
                          {t("actions.delete")}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedRoute(null);
                            setIsEditingRoute(false);
                          }}
                        >
                          {t("actions.cancel")}
                        </button>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              ) : (

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

                <div className="headerMainActions" onClickCapture={closeNoteEditor}>
                <Link className="backLink" href="/dashboard">
                  Maps
                </Link>

                <button
                  disabled={!!movingPin || !mapAccess.canEditPins}
                  className={isAddingPin ? "activeAddButton" : "addButton"}
                  onClick={startPinMode}
                >
                  {isAddingPin ? t("map.addingPin") : "+ Pin"}
                </button>

                <button
                  disabled={!!movingPin || !mapAccess.canEditRoutes}
                  className={isDrawingRoute ? "activeAddButton" : "addButton"}
                  onClick={() => {
                    if (isAddingPin) return;
                    startRouteMode();
                  }}
                >
                  {isDrawingRoute ? t("map.drawRoute") : "+ Route"}
                </button>

                <button
                  disabled={!!movingPin || !mapAccess.canEditPins}
                  className={isAddingNote ? "activeAddButton" : "addButton"}
                  onClick={startNoteMode}
                >
                  {isAddingNote ? "Draw note" : "+ Note"}
                </button>

                {mapAccess.canManageSettings && (
                  <button
                    disabled={!!movingPin}
                    className="addButton"
                    onClick={openScaleSettings}
                  >
                    Scale
                  </button>
                )}

                {mapAccess.canManageSettings && (
                  <div className="headerConfigMenuWrap" ref={headerConfigMenuRef}>
                    <button
                      disabled={!!movingPin}
                      className="headerIconButton"
                      onClick={() => setHeaderConfigMenuOpen((open) => !open)}
                      title="Config"
                      aria-label="Config"
                      aria-haspopup="menu"
                      aria-expanded={headerConfigMenuOpen}
                    >
                      <img src="/api/site-icons/cog_settings" alt="" />
                    </button>

                  </div>
                )}
                </div>

                <div className="headerSettings" onClickCapture={closeNoteEditor}>
                  <button
                    className="publicLinkButton"
                    disabled={isAddingPin}
                    onClick={openShareModal}
                  >
                    Share
                  </button>

                  <MapLanguageSelect locale={locale} onLocaleChange={setLocale} />
                  <AccountMenu />
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </header>

      <div
        className="mapViewport"
      >
        <section
          className="mapArea"
          onClick={handleMapAreaClick}
          onContextMenu={openMapAreaContextMenu}
          onMouseDown={handleMapAreaMouseDown}
          onMouseUp={handleMapAreaMouseUp}
          onMouseMove={handleMapAreaMouseMove}
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
            panning={{ disabled: isAddingNote }}
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
                      <img src="/api/site-icons/map_connected_icon" alt="" />
                    </button>

                    <button onClick={centerMap} title={t("map.center")}>
                      {"\u25CE"}
                    </button>

                    {connectedMapsOpen && (
                      <div className="connectedMapsMenu">
                        {connectedMaps.length === 0 ? (
                          <span>No connected maps</span>
                        ) : (
                          connectedMaps.map((connectedMap) => (
                            <button
                              key={connectedMap._id}
                              onClick={() => openConnectedEditorMap(connectedMap._id)}
                            >
                              <img src="/api/site-icons/map_connected" alt="" />
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
                    className={[
                      "imageWrapper",
                      isDrawingRoute ? "drawingRoute" : "",
                      isAddingPin ? "addingPin" : "",
                      isAddingNote ? "addingNote" : "",
                      chainPinPickTarget ? "chainPicking" : "",
                      isMapPanning ? "mapPanning" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      "--map-pin-scale": mapPinSize / 50,
                      "--map-pin-zoom-scale": getPinZoomScale(),
                      "--map-note-scale": mapNoteSize / 50,
                    }}
                    onClick={(event) => {
                      if (movingPin) {
                        setConfirmMovePinOpen(true);
                        return;
                      }
                      closeContextMenu();

                      const mapClickPoint =
                        mapMouseDownPointRef.current || mapMouseDownPoint;

                      if (mapClickPoint) {
                        const distance = Math.hypot(
                          event.clientX - mapClickPoint.clientX,
                          event.clientY - mapClickPoint.clientY
                        );

                        if (distance <= 4 && !isAddingPin && !isDrawingRoute && !isAddingNote) {
                          setSelectedPin(null);
                          setSelectedRoute(null);
                          setSelectedNote(null);
                          setIsEditingRoute(false);
                        }
                      }

                      mapMouseDownPointRef.current = null;
                      setMapMouseDownPoint(null);
                      handleMapClick(event);
                    }}
                    onContextMenu={openMapContextMenu}
                    onMouseDown={handleMapMouseDown}
                    onMouseUp={handleMapMouseUp}
                    onMouseMove={(event) => {
                      handleMapMouseMove(event);
                      handleMovePinMouseMove(event);
                    }}

                    onMouseLeave={() => {
                      if (isDrawingRoute) {
                        setMousePoint(null);
                      }
                    }}
                  >
                    <TiledMapLayer
                      map={mapData}
                      scale={mapScale}
                      onLoad={() => {
                        updateMapContentSize(document.querySelector(".imageWrapper"));
                        setTimeout(centerMap, 50);
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
                              .map((point) => `${point.x},${point.y}`)
                              .join(" ")}
                            fill="none"
                            stroke={
                              selectedRoute?._id === route._id
                                ? editingRouteData?.color || route.color || "#ef4444"
                                : route.color || "#ef4444"
                            }
                            strokeWidth={
                              selectedRoute?._id === route._id
                                ? getRouteDisplayWidth(
                                    editingRouteData?.width || route.width || DEFAULT_ROUTE_WIDTH
                                  )
                                : hoveredRouteId === route._id
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
                              !isDrawingRoute &&
                              routeEffectsEnabled &&
                              (selectedRoute?._id === route._id || hoveredRouteId === route._id)
                                ? "routeLine routeLineActive"
                                : "routeLine"
                            }
                            opacity={
                              movingPin
                                ? 0.25
                                : isDrawingRoute
                                ? 1
                                : selectedRoute?._id && selectedRoute._id !== route._id
                                ? 0.35
                                : hoveredRouteId && hoveredRouteId !== route._id
                                ? 0.55
                                : 1
                            }
                            onMouseEnter={() => {
                              if (isDrawingRoute) return;
                              setHoveredRouteId(route._id);
                            }}
                            onMouseLeave={() => {
                              if (isDrawingRoute) return;
                              setHoveredRouteId(null);
                            }}
                            onClick={(event) => handleRouteClick(event, route)}
                          />
                        ))}

                      {routePoints.length > 1 && (
                        <polyline
                          points={routePoints
                            .map((point) => `${point.x},${point.y}`)
                            .join(" ")}
                          fill="none"
                          stroke={routeColor}
                          strokeWidth={getRouteDisplayWidth(routeWidth)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={getRouteDashArray()}
                        />
                      )}

                      {isDrawingRoute && routePoints.length > 0 && mousePoint && (
                        <line
                          x1={routePoints[routePoints.length - 1].x}
                          y1={routePoints[routePoints.length - 1].y}
                          x2={mousePoint.x}
                          y2={mousePoint.y}
                          stroke={routeColor}
                          strokeWidth={getRouteDisplayWidth(routeWidth)}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={getRouteDashArray()}
                          opacity="0.75"
                        />
                      )}

                      {isDrawingRoute &&
                        routes
                          .filter((route) => !hiddenRouteIds.includes(route._id))
                          .flatMap((route) =>
                            route.points.map((point, index) => (
                              <circle
                                key={`snap-${route._id}-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={getRoutePointRadius(route.width || DEFAULT_ROUTE_WIDTH)}
                                className="routeSnapPoint"
                                style={{ "--route-color": routeColor }}
                                onMouseDown={(event) => {
                                  event.stopPropagation();
                                  setRouteMouseDownPoint(null);
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setRouteMouseDownPoint(null);

                                  setRoutePoints((prev) => [
                                    ...prev,
                                    {
                                      x: point.x,
                                      y: point.y,
                                    },
                                  ]);
                                }}
                              />
                            ))
                          )}

                          {isDrawingRoute &&
                            routePoints.map((point, index) => (
                              <circle
                                key={`current-snap-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={getRoutePointRadius(routeWidth)}
                                className="routeSnapPoint currentRouteSnapPoint"
                                style={{ "--route-color": routeColor }}
                                onMouseDown={(event) => {
                                  event.stopPropagation();
                                  setRouteMouseDownPoint(null);
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRouteMouseDownPoint(null);

                                  setRoutePoints((prev) => [
                                    ...prev,
                                    {
                                      x: point.x,
                                      y: point.y,
                                    },
                                  ]);
                                }}
                              />
                            ))}

                      {routePoints.map((point, index) => (
                        <circle
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r={getRoutePointRadius(routeWidth)}
                          fill={routeColor}
                        />
                      ))}
                    </svg>

                    {notes.map((note) => {
                      const isSelected = selectedNote?._id === note._id;
                      const notesDisabled =
                        isAddingPin ||
                        isDrawingRoute ||
                        isEditingRoute ||
                        modalOpen ||
                        !!editingPin ||
                        !!movingPin;
                      const displayNote = isSelected ? selectedNote : note;

                      return (
                        <div
                          key={note._id}
                          data-note-id={note._id}
                          className={[
                            "mapNote",
                            isSelected ? "mapNoteEditing" : "",
                            notesDisabled ? "mapNoteDisabled" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            left: `${displayNote.x}%`,
                            top: `${displayNote.y}%`,
                            width: `${displayNote.width}%`,
                            height: `${displayNote.height}%`,
                          }}
                          onClick={(event) => {
                            if (notesDisabled) return;
                            event.stopPropagation();
                            if (!isSelected) openNoteEditor(note);
                          }}
                          onMouseDown={(event) => {
                            if (isSelected) event.stopPropagation();
                          }}
                          onPointerDown={(event) => {
                            if (isSelected) event.stopPropagation();
                          }}
                          onWheel={(event) => event.stopPropagation()}
                          onMouseUp={isSelected ? handleNoteResize : undefined}
                        >
                          {isSelected ? (
                            <>
                              <div
                                className="mapNoteMoveBar"
                                onMouseDown={(event) => startMoveNote(event, displayNote)}
                              >
                                Move note
                              </div>
                              <input
                                className="mapNoteTitleInput"
                                value={noteForm.title}
                                maxLength={MAX_NOTE_TITLE_LENGTH}
                                onChange={(event) =>
                                  setNoteForm((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                  }))
                                }
                                placeholder="Title"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <textarea
                                className="mapNoteTextInput"
                                value={noteForm.text}
                                maxLength={MAX_NOTE_TEXT_LENGTH}
                                onChange={(event) =>
                                  setNoteForm((prev) => ({
                                    ...prev,
                                    text: event.target.value,
                                  }))
                                }
                                placeholder="Write a note..."
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <div className="mapNoteFooter">
                                <span>{noteForm.text.length}/{MAX_NOTE_TEXT_LENGTH}</span>
                                <button onClick={() => saveNote(displayNote)}>Save</button>
                                <button onClick={() => requestDeleteNote(displayNote)}>Delete</button>
                                <button onClick={cancelNoteEdit}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              {note.title && <strong>{note.title}</strong>}
                              <p>{note.text}</p>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {noteDraftRect && (
                      <div
                        className="mapNote mapNoteDraft"
                        style={{
                          left: `${noteDraftRect.x}%`,
                          top: `${noteDraftRect.y}%`,
                          width: `${noteDraftRect.width}%`,
                          height: `${noteDraftRect.height}%`,
                        }}
                      />
                    )}

                    {filteredPins.map((pin) => (
                      <button
                        key={pin._id}
                        className={[
                          "pin",
                          pin.iconType === "custom" ? "customPin" : "emojiPin",
                          (pin.category || "geral") === SYSTEM_PIN_CATEGORY_VALUE
                            ? "systemPin"
                            : "",
                          movingPin
                            ? movingPin._id === pin._id
                              ? "movingPinActive"
                              : "routeEditingDimmed"
                            : isDrawingRoute
                            ? "routeEditingDimmed"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={{
                          left: `${
                            movingPin?._id === pin._id && movingPinPosition
                              ? movingPinPosition.x
                              : pin.x
                          }%`,
                          top: `${
                            movingPin?._id === pin._id && movingPinPosition
                              ? movingPinPosition.y
                              : pin.y
                          }%`,
                          "--pin-bg": getPinCategoryColor(pin),
                        }}
                        onClick={(event) => {
                          if (movingPin) {
                            event.stopPropagation();
                            setConfirmMovePinOpen(true);
                            return;
                          }

                          handlePinClick(event, pin);
                      }}
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
                          onClick={() => setSelectedPin(null)}
                        >
                          {"\u00D7"}
                        </button>

                        <div className="pinPopupHeader">
                          <div className="pinPopupIcon">
                            {selectedPin.iconType === "custom" ? (
                              <img src={selectedPin.iconImageUrl} alt={selectedPin.name} />
                            ) : (
                              normalizePinIcon(selectedPin.icon)
                            )}
                          </div>

                          <div className="pinPopupTitle">
                            {selectedPin.name || t("common.noName")}
                          </div>
                        </div>

                        {selectedPin.description && (
                          <div className="pinPopupDescription">
                            {selectedPin.description}
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
                                    {requirement.iconType === "custom" &&
                                    requirement.iconImageUrl ? (
                                      <img
                                        src={requirement.iconImageUrl}
                                        alt={requirement.typeName || "Chain"}
                                      />
                                    ) : (
                                      normalizePinIcon(requirement.icon)
                                    )}
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
                              (group) => group.value === (selectedPin.category || "geral")
                            )?.label || "â€”"}
                          </div>

                          <div>
                            <strong>{t("common.category")}:</strong>{" "}
                            {selectedPin.typeName || "â€”"}
                          </div>
                        </div>

                        {mapAccess.canEditPins && (
                          <div className="pinPopupActions">
                            <button className="secondary" onClick={() => openEditModal(selectedPin)}>
                              {t("actions.edit")}
                            </button>

                            <button
                              className="secondary"
                              onClick={() => openChainChoice(selectedPin)}
                            >
                              Chain
                            </button>

                            {isPortalPin(selectedPin) && (
                              <button
                                className="secondary"
                                onClick={() => openDestinationModal(selectedPin)}
                              >
                                Destination
                              </button>
                            )}

                            <button
                              className="secondary"
                              onClick={(event) => startMovePin(selectedPin, event)}
                            >
                              {t("actions.move")}
                            </button>

                            <button
                              className="danger"
                              onClick={() => requestDeletePin(selectedPin._id)}
                            >
                              {t("actions.delete")}
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
      </div>

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
              usuarios possam visualizar. A visibilidade pode ser alterada nas
              configuracoes do mapa.
            </p>

            <label>
              Link
              <input
                readOnly
                value={
                  typeof window === "undefined"
                    ? ""
                    : `${window.location.origin}/map/${mapId}`
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

      {activityLogOpen && (
        <div className="modalOverlay" onClick={() => setActivityLogOpen(false)}>
          <div
            className="modal activityLogModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="closeButton"
              onClick={() => setActivityLogOpen(false)}
            >
              {"\u00D7"}
            </button>

            <div className="mapSettingsHeader">
              <h2>Log</h2>
            </div>

            {loadingActivityLogs ? (
              <p className="emptyText">Carregando historico...</p>
            ) : activityLogs.length === 0 ? (
              <p className="emptyText">Nenhuma modificacao registrada.</p>
            ) : (
              <div className="activityLogList">
                {activityLogs.map((log) => (
                  <div className="activityLogItem" key={log._id}>
                    <time>{formatActivityTimestamp(log.createdAt)}</time>
                    <span>
                      {getPublicUsername(log.userName)}: {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mapSettingsOpen && (
        <div className="modalOverlay">
          <div
            className="modal mapSettingsModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeMapSettings}>
              {"\u00D7"}
            </button>

            <div className="mapSettingsHeader">
              <h2>{t("settings.title")}</h2>
            </div>

            <div className="mapSettingsContent">
              <section className="mapSettingsSection">
                <h3>{t("settings.mapUser")}</h3>

                <div className="mapSettingsGrid">
                  <div className="mapSettingsFieldColumn">
                    <label>
                      <span>{t("settings.titlePlaceholder")}</span>
                      <input
                        value={mapSettingsForm.title}
                        onChange={(event) =>
                          setMapSettingsForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        placeholder={t("settings.titlePlaceholder")}
                      />
                    </label>

                    <div className="mapSettingsVisibility">
                      <span className="mapSettingsLabelWithHelp">
                        Visibility
                        <span className="settingsHelp">
                          ?
                          <span className="settingsHelpTooltip">
                            <span>Public: Mapas aparecem na biblioteca publica.</span>
                            <span>Not Listed: Somente quem tem o link pode visualizar o mapa.</span>
                            <span>Private: Somente o owner pode visualizar e editar o mapa.</span>
                          </span>
                        </span>
                      </span>

                      <div
                        className="visibilitySegment"
                        role="radiogroup"
                        aria-label="Visibilidade"
                      >
                        {[
                          ["public", "Public"],
                          ["notListed", "Not Listed"],
                          ["private", "Private"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={
                              mapSettingsForm.visibility === value ? "active" : ""
                            }
                            onClick={() =>
                              setMapSettingsForm((prev) => ({
                                ...prev,
                                visibility: value,
                              }))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label>
                      <span className="mapSettingsLabelWithHelp">
                        {t("settings.tags")}
                        <span className="settingsHelp">
                          ?
                          <span className="settingsHelpTooltip">
                            <span>{t("settings.tagsHelp")}</span>
                          </span>
                        </span>
                      </span>
                      <input
                        value={mapSettingsForm.tags}
                        onChange={(event) =>
                          setMapSettingsForm((prev) => ({
                            ...prev,
                            tags: event.target.value,
                          }))
                        }
                        placeholder={t("settings.tagsPlaceholder")}
                      />
                    </label>
                  </div>

                  <label>
                    <span>{t("settings.descriptionPlaceholder")}</span>
                    <textarea
                      value={mapSettingsForm.description}
                      onChange={(event) =>
                        setMapSettingsForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder={t("settings.descriptionPlaceholder")}
                      rows={4}
                    />
                  </label>
                </div>

                <div className="mapEditorsPanel">
                  <div className="mapEditorsToolbar">
                    <div className="mapEditorsTitle">
                      <strong>
                        {t("settings.editors")} ({mapEditorsCount})
                      </strong>
                      <span className="settingsHelp">
                        ?
                        <span className="settingsHelpTooltip">
                          <span>Owner: criador do mapa e unico com controle total.</span>
                          <span>Full Access: edita pins, rotas e categorias.</span>
                          <span>Pin Editor: edita apenas pins.</span>
                          <span>Route Editor: edita apenas rotas.</span>
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => {
                        if (!canAddMoreEditors()) {
                          showEditorSupporterLimit();
                          return;
                        }

                        setAddEditorOpen((prev) => !prev);
                        setEditorSearch("");
                        setEditorSearchResults([]);
                      }}
                    >
                      {t("settings.addEditor")}
                    </button>
                  </div>

                  {addEditorOpen && (
                    <div className="mapEditorSearchBox">
                      <div className="mapEditorSearchField">
                        <input
                          value={editorSearch}
                          onChange={(event) =>
                            setEditorSearch(
                              event.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, "")
                                .slice(0, 15)
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              addMapEditor(editorSearch);
                            }
                          }}
                          placeholder="username"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => addMapEditor(editorSearch)}
                          disabled={!editorSearch.trim()}
                        >
                          Add
                        </button>
                      </div>

                      {editorSearch.trim() && (
                        <div className="mapEditorSearchResults">
                        {editorSearchLoading ? (
                          <span className="mapEditorSearchEmpty">Buscando...</span>
                        ) : availableEditorSearchResults.length === 0 ? (
                          <span className="mapEditorSearchEmpty">
                            Nenhum usuario encontrado.
                          </span>
                        ) : (
                          availableEditorSearchResults.map((user) => (
                            <button
                              key={user.username}
                              type="button"
                              onClick={() => setEditorSearch(user.username)}
                            >
                              {user.username}
                            </button>
                          ))
                        )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mapEditorPermissionsTable">
                    <div className="mapEditorPermissionsHeader">
                      <span>User</span>
                      <span>Owner</span>
                      <span>Full Access</span>
                      <span>Pin Editor</span>
                      <span>Route Editor</span>
                      <span>Remove</span>
                    </div>

                    <div className="mapEditorPermissionRow ownerRow">
                      <div className="mapEditorIdentity">
                        <strong>
                          {getPublicUsername(
                            mapData.ownerUsername || currentUser?.username,
                            "owner"
                          )}
                        </strong>
                      </div>

                      <span className="permissionRadioCell checked disabled" />
                      <span className="permissionRadioCell disabled" />
                      <span className="permissionRadioCell disabled" />
                      <span className="permissionRadioCell disabled" />
                      <span className="mapEditorRemoveCell" />
                    </div>

                    {mapEditorRows.map((editor) => (
                      <div className="mapEditorPermissionRow" key={editor.key}>
                        <div className="mapEditorIdentity">
                          <strong>{editor.username}</strong>
                        </div>

                        <span className="permissionRadioCell disabled" />
                        <button
                          type="button"
                          className={
                            editorHasPermission(editor, "fullAccess")
                              ? "permissionRadioCell checked"
                              : "permissionRadioCell"
                          }
                          onClick={() => updateEditorPermission(editor, "fullAccess")}
                        />
                        <button
                          type="button"
                          className={
                            editorHasPermission(editor, "pinEditor")
                              ? "permissionRadioCell checked"
                              : "permissionRadioCell"
                          }
                          onClick={() => updateEditorPermission(editor, "pinEditor")}
                        />
                        <button
                          type="button"
                          className={
                            editorHasPermission(editor, "routeEditor")
                              ? "permissionRadioCell checked"
                              : "permissionRadioCell"
                          }
                          onClick={() => updateEditorPermission(editor, "routeEditor")}
                        />
                        <span className="mapEditorRemoveCell">
                          <button
                            type="button"
                            className="mapEditorRemoveButton"
                            onClick={() => requestRemoveEditor(editor)}
                            title="Remove editor"
                          >
                            {"\u00D7"}
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mapSettingsSection">
                <h3>{t("settings.general")}</h3>

                <div className="mapSettingsControls">
                  <div className="mapSettingsButtonGroup">
                    <button
                      className={
                        mapSettingsForm.routeEffectsEnabled
                          ? "settingsToggleButton"
                          : "settingsToggleButton activeHidden"
                      }
                      onClick={() =>
                        setMapSettingsForm((prev) => ({
                          ...prev,
                          routeEffectsEnabled: !prev.routeEffectsEnabled,
                        }))
                      }
                    >
                      {mapSettingsForm.routeEffectsEnabled
                        ? t("route.effectOn")
                        : t("route.effectOff")}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="modalActions">
              <button
                className="primary"
                disabled={savingMapSettings}
                onClick={saveMapSettings}
              >
                {t("actions.save")}
              </button>

              <button
                className="secondary"
                disabled={savingMapSettings}
                onClick={closeMapSettings}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmMovePinOpen && (
        <div className="modalOverlay">
          <div className="modal smallModal" onClick={(event) => event.stopPropagation()}>
            <h2>Mover pin?</h2>
            <p className="modalSubtitle">
              Deseja salvar a nova posição deste pin?
            </p>

            <div className="modalActions">
              <button
                className="primary"
                onClick={() => {
                  const pinToMove = movingPin;
                  const positionToSave = movingPinPosition;

                  if (!pinToMove || !positionToSave) {
                    alert("Não foi possível salvar: posição do pin não encontrada.");
                    return;
                  }

                  setConfirmMovePinOpen(false);
                  finishMovePin(pinToMove, positionToSave);
                }}
              >
                {t("actions.save")}
              </button>

              <button
                className="secondary"
                onClick={() => {
                  setConfirmMovePinOpen(false);
                  cancelMovePin();
                }}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modalOverlay confirmDeleteOverlay">
          <div className="modal smallModal" onClick={(event) => event.stopPropagation()}>
            <h2>{deleteConfirm.title}</h2>
            <p className="modalSubtitle">
              {deleteConfirm.type === "chainReset"
                ? "Você quer resetar os chains deste pin?"
                : deleteConfirm.message}
            </p>

            <div className="modalActions">
              <button className="danger" onClick={confirmDeleteAction}>
                {deleteConfirm.type === "editor"
                  ? "Remover"
                  : deleteConfirm.type === "chainReset" ||
                    deleteConfirm.type === "chainRequirement" ||
                    deleteConfirm.type === "clearPins" ||
                    deleteConfirm.type === "clearRoutePoints"
                  ? "Sim"
                  : t("actions.delete")}
              </button>

              <button
                className="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                {t("actions.cancel")}
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

      {contextMenu && (
        <div
          className="mapContextMenu"
          style={{
            left: contextMenu.screenX,
            top: contextMenu.screenY,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {mapAccess.canEditPins && (
            <button onClick={addPinFromContextMenu}>
              <span className="mapContextMenuIcon" aria-hidden="true">
                P
              </span>
              <span>Add Pin</span>
            </button>
          )}
          {mapAccess.canEditRoutes && (
            <button onClick={addRouteFromContextMenu}>
              <span className="mapContextMenuIcon" aria-hidden="true">
                R
              </span>
              <span>Add Route</span>
            </button>
          )}
          {mapAccess.canEditPins && (
            <button onClick={addNoteFromContextMenu}>
              <span className="mapContextMenuIcon" aria-hidden="true">
                N
              </span>
              <span>Add Note</span>
            </button>
          )}
          {mapAccess.canManageSettings && (
            <button onClick={openScaleSettings}>
              <span className="mapContextMenuIcon" aria-hidden="true">
                S
              </span>
              <span>Change Scale</span>
            </button>
          )}
        </div>
      )}



      {manageGroupsModalOpen && (
        <div className="modalOverlay">
          <div
            className="modal manageGroupsModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manageGroupsHeader">
              <div className="manageHeaderTop">
                <div>
                  <h2>{t("manage.manage")}</h2>
                  <p>{t("manage.groupDescription")}</p>
                </div>

                <button className="closeButton" onClick={closeManageGroupsModal}>
                  {"\u00D7"}
                </button>
              </div>

              <div className="manageHeaderActions">
                <button
                  className="primary manageAddGroupButton"
                  onClick={() => {
                    openManageUI("create-group");
                    setCreateValue("");
                  }}
                >
                  {t("manage.addGroup")}
                </button>

                <button
                  className="primary"
                  disabled={!groupOrderDirty || savingGroupOrder}
                  onClick={saveGroupOrder}
                >
                  {savingGroupOrder
                    ? t("manage.savingOrder")
                    : t("manage.saveOrder")}
                </button>
              </div>
            </div>

            {activeManageUI === "create-group" && (
              <div className="manageCreateBox">
                <input
                  value={createValue}
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  onChange={(event) =>
                    setCreateValue(event.target.value.slice(0, MAX_GROUP_NAME_LENGTH))
                  }
                  placeholder={t("manage.newGroupName")}
                  autoFocus
                />

                <button className="primary" onClick={createGroup}>
                  {t("manage.create")}
                </button>

                <button
                  className="secondary"
                  onClick={() => {
                    setCreateMode(null);
                    setActiveManageUI(null);
                    setCreateValue("");
                  }}
                >
                  {t("actions.cancel")}
                </button>
              </div>
            )}

            <div className="manageGroupsList">
              {pinGroups.length === 0 ? (
                <p className="emptyText">{t("manage.noGroups")}</p>
              ) : (
                pinGroups.map((group) => (
                  <div className="manageGroupBlock" key={group.value}>
                    <button
                      className="manageGroupHeader"
                      onClick={() => {
                        const uiKey = `edit-group:${group.value}`;

                        const isSameItem =
                          expandedManageItem?.kind === "group" &&
                          expandedManageItem?.value === group.value;

                        if (isSameItem || activeManageUI === uiKey) {
                          setExpandedManageItem(null);
                          setActiveManageUI(null);
                          setRenameMode(false);
                          setRenameValue("");
                          setMoveMode(false);
                          return;
                        }

                        setActiveManageUI(uiKey);

                        setExpandedManageItem({
                          kind: "group",
                          id: group._id,
                          value: group.value,
                          label: group.label,
                        });

                        setRenameMode(false);
                        setRenameValue(group.label);
                        setMoveMode(false);
                      }}
                    >
                      <span>{group.label}</span>
                      <strong>{group.count}</strong>
                    </button>

                    {expandedManageItem?.kind === "group" &&
                      expandedManageItem?.value === group.value && (
                        <div className="manageInlineActions">
                          {renameMode ? (
                            <>
                              <input
                                value={renameValue}
                                maxLength={MAX_GROUP_NAME_LENGTH}
                                onChange={(event) =>
                                  setRenameValue(
                                    event.target.value.slice(0, MAX_GROUP_NAME_LENGTH)
                                  )
                                }
                                autoFocus
                              />

                              <button
                                className="primary"
                                onClick={() => renameGroup(group)}
                              >
                                {t("actions.save")}
                              </button>

                              <button
                                className="secondary"
                                onClick={() => {
                                  setRenameMode(false);
                                  setRenameValue(group.label);
                                }}
                              >
                                {t("actions.cancel")}
                              </button>
                            </>
                          ) : (
                            <>
                              {!isSystemGroup(group) && (
                                <button
                                  className="primary"
                                  onClick={() => {
                                    setRenameMode(true);
                                    setRenameValue(group.label);
                                    setMoveMode(false);
                                  }}
                                >
                                  {t("manage.rename")}
                                </button>
                              )}

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "up")}
                                title={t("manage.moveUp")}
                              >
                                {"\u2191"}
                              </button>

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "down")}
                                title={t("manage.moveDown")}
                              >
                                {"\u2193"}
                              </button>

                              {isSystemGroup(group) ? (
                                <span className="manageLockedText">
                                  Fixed system group
                                </span>
                              ) : (
                                <button
                                  className="danger"
                                  onClick={() => requestDeleteGroup(group)}
                                >
                                  {t("actions.delete")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                    {!isSystemGroup(group) && (
                      <div className="manageAddCategoryRow">
                        <button
                          className="secondary"
                          onClick={() => {
                            openManageUI(`create-category:${group.value}`);
                            setCreateValue("");
                            resetCreateCategoryIcon();
                            setCreateCategoryColor("#0f1014");
                          }}
                        >
                          {t("manage.addCategory")}
                        </button>
                      </div>
                    )}

                    {activeManageUI === `create-category:${group.value}` && (
                      <div className="manageCreateBox manageCreateBoxNested">
                        <button
                          type="button"
                          className="iconPickerButton"
                          onClick={openCreateIconPicker}
                        >
                          {createCategoryIconType === "custom" && createCategoryIconImageUrl ? (
                            <img src={createCategoryIconImageUrl} alt="Ãcone selecionado" />
                          ) : (
                            <span>{normalizePinIcon(createCategoryIcon)}</span>
                          )}
                        </button>

                        <input
                          value={createValue}
                          maxLength={MAX_CATEGORY_NAME_LENGTH}
                          onChange={(event) =>
                            setCreateValue(
                              event.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH)
                            )
                          }
                          placeholder={t("manage.newCategoryName")}
                          autoFocus
                        />

                        {renderCategoryColorPicker({
                          mode: "create",
                          groupValue: group.value,
                          value: createCategoryColor,
                        })}

                        <button
                          className="primary"
                          onClick={() => createCategoryInsideGroup(group)}
                        >
                          {t("manage.create")}
                        </button>

                        <button
                          className="secondary"
                          onClick={() => {
                            setCreateMode(null);
                            setActiveManageUI(null);
                            setCreateValue("");
                            resetCreateCategoryIcon();
                            setCreateCategoryColor("#0f1014");
                          }}
                        >
                          {t("actions.cancel")}
                        </button>
                      </div>
                    )}

                    <div className="manageCategoryList">
                      {[...group.types]
                        .sort((a, b) =>
                          a.label.localeCompare(b.label, "pt-BR", {
                            sensitivity: "base",
                          })
                        )
                        .map((type) => (
                          <div key={type.renderKey}>
                            <button
                              className="manageCategoryItem"
                              onClick={() => {
                                const isSameItem =
                                  expandedManageItem?.kind === "category" &&
                                  expandedManageItem?.key === type.key;

                                if (isSameItem) {
                                  setExpandedManageItem(null);
                                  setRenameMode(false);
                                  setRenameValue("");
                                  setMoveMode(false);
                                  return;
                                }

                                setExpandedManageItem({
                                  kind: "category",
                                  id: type.pinTypeId,
                                  key: type.key,
                                  label: type.label,
                                });

                                setRenameMode(false);
                                setRenameValue(type.label);
                                setMoveMode(false);
                                setActiveManageUI(`edit:${type.key}`);
                              }}
                            >
                              <span className="sidebarTypeIcon">
                                {type.iconType === "custom" && type.iconImageUrl ? (
                                  <img src={type.iconImageUrl} alt={type.label} />
                                ) : (
                                  normalizePinIcon(type.icon)
                                )}
                              </span>

                              <span>{type.label}</span>
                              <strong>{type.count}</strong>
                            </button>

                            {expandedManageItem?.kind === "category" &&
                              expandedManageItem?.key === type.key && (
                                <div className="manageInlineActions manageInlineActionsNested">
                                  {moveMode ? (
                                    <>
                                      <select
                                        value={moveTargetGroup}
                                        onChange={(event) =>
                                          setMoveTargetGroup(event.target.value)
                                        }
                                      >
                                        {pinCategories.map((cat) => (
                                          <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        className="primary"
                                        onClick={() => moveCategory(type)}
                                      >
                                        {t("actions.save")}
                                      </button>

                                      <button
                                        className="secondary"
                                        onClick={() => setMoveMode(false)}
                                      >
                                        {t("actions.cancel")}
                                      </button>
                                    </>
                                  ) : renameMode ? (
                                    <>
                                      <input
                                        value={renameValue}
                                        maxLength={MAX_CATEGORY_NAME_LENGTH}
                                        onChange={(event) =>
                                          setRenameValue(
                                            event.target.value.slice(
                                              0,
                                              MAX_CATEGORY_NAME_LENGTH
                                            )
                                          )
                                        }
                                        autoFocus
                                      />

                                      <button
                                        className="primary"
                                        onClick={() => renameCategory(type)}
                                      >
                                        {t("actions.save")}
                                      </button>

                                      <button
                                        className="secondary"
                                        onClick={() => {
                                          setRenameMode(false);
                                          setRenameValue(type.label);
                                        }}
                                      >
                                        {t("actions.cancel")}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {renderCategoryColorPicker({
                                        mode: "edit",
                                        type,
                                        value: type.backgroundColor,
                                      })}

                                      <button
                                        type="button"
                                        className="iconPickerButton"
                                        onClick={() => openEditIconPicker(type)}
                                        title={t("manage.changeIcon")}
                                      >
                                        {type.iconType === "custom" && type.iconImageUrl ? (
                                          <img src={type.iconImageUrl} alt={type.label} />
                                        ) : (
                                          <span>{normalizePinIcon(type.icon)}</span>
                                        )}
                                      </button>

                                      <button
                                        className="primary"
                                        disabled={isSystemPortalType(type)}
                                        onClick={() => {
                                          setRenameMode(true);
                                          setRenameValue(type.label);
                                          setMoveMode(false);
                                        }}
                                      >
                                        {t("manage.rename")}
                                      </button>

                                      <button
                                        className="secondary"
                                        disabled={isSystemPortalType(type)}
                                        onClick={() => {
                                          setMoveMode(true);
                                          setMoveTargetGroup(
                                            type.category || "geral"
                                          );
                                          setRenameMode(false);
                                        }}
                                      >
                                        {t("actions.move")}
                                      </button>

                                      <button
                                        className="danger"
                                        disabled={isSystemPortalType(type)}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          requestDeleteCategory(type);
                                        }}
                                      >
                                        {t("actions.delete")}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {manageRoutesModalOpen && (
        <div className="modalOverlay">
          <div className="modal manageGroupsModal">
            <div className="manageGroupsHeader">
              <div className="manageHeaderTop">
                <div>
                  <h2>{t("actions.orderRoutes")}</h2>
                  <p>{t("manage.routeDescription")}</p>
                </div>

                <button
                  className="closeButton"
                  onClick={() => setManageRoutesModalOpen(false)}
                >
                  {"\u00D7"}
                </button>
              </div>
            </div>

            <div className="manageGroupsList">
              {routeOrderDraft.length === 0 ? (
                <p className="emptyText">{t("route.empty")}</p>
              ) : (
                routeOrderDraft.map((route, index) => (
                  <div className="manageRouteOrderItem" key={route._id}>
                    <span className="routeIndex">{index + 1}</span>

                    <span
                      className="routeColorDot"
                      style={{ background: route.color || "#ef4444" }}
                    />

                    <span className="manageRouteOrderName">{route.name}</span>

                    <button
                      className="secondary iconButton"
                      disabled={index === 0}
                      onClick={() => moveRoute(route, "up")}
                      title={t("manage.moveUp")}
                    >
                      {"\u2191"}
                    </button>

                    <button
                      className="secondary iconButton"
                      disabled={index === routeOrderDraft.length - 1}
                      onClick={() => moveRoute(route, "down")}
                      title={t("manage.moveDown")}
                    >
                      {"\u2193"}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="modalActions">
              <button className="primary" onClick={saveRouteOrder}>
                {t("actions.save")}
              </button>

              <button
                className="secondary"
                onClick={() => {
                  setRouteOrderDraft([]);
                  setManageRoutesModalOpen(false);
                }}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryColorModal && (
        <div className="modalOverlay colorModalOverlay" onClick={closeCategoryColorModal}>
          <div
            className="modal categoryColorModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeCategoryColorModal}>
              {"\u00D7"}
            </button>

            <h2>Cor da categoria</h2>
            <p className="modalSubtitle">
              Ajuste a cor do fundo dos pins desta categoria.
            </p>

            <div className="categoryColorPreview">
              <div
                className={[
                  "pinColorPreviewPin",
                  categoryColorModal.type?.category === SYSTEM_PIN_CATEGORY_VALUE
                    ? "systemPreview"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  "--preview-pin-bg": getPinBackgroundColor(
                    categoryColorModal.draft
                  ),
                }}
              >
                <span>
                  {categoryColorModal.mode === "create" ? (
                    createCategoryIconType === "custom" &&
                    createCategoryIconImageUrl ? (
                      <img
                        src={createCategoryIconImageUrl}
                        alt="Preview"
                      />
                    ) : (
                      normalizePinIcon(createCategoryIcon)
                    )
                  ) : categoryColorModal.type?.iconType === "custom" &&
                    categoryColorModal.type?.iconImageUrl ? (
                    <img
                      src={categoryColorModal.type.iconImageUrl}
                      alt={categoryColorModal.type.label || "Preview"}
                    />
                  ) : (
                    normalizePinIcon(categoryColorModal.type?.icon)
                  )}
                </span>
              </div>
            </div>

            <div className="categoryColorRows">
              <div className="routeColorRow">
                <span>Recent</span>
                <div className="routeColorSwatches">
                  {recentCategoryColors.length > 0 ? (
                    recentCategoryColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={
                          getPinBackgroundColor(categoryColorModal.draft) === color
                            ? "routeColorSwatch selected"
                            : "routeColorSwatch"
                        }
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          isSupporterAccount || isPinColorPreset(color)
                            ? setCategoryColorModal((prev) => ({
                                ...prev,
                                draft: color,
                              }))
                            : showSupporterFeatureModal("Custom pin colors")
                        }
                      />
                    ))
                  ) : (
                    <span className="routeColorEmpty">-</span>
                  )}
                </div>
              </div>

              <div className="routeColorRow">
                <span>Presets</span>
                <div className="routeColorSwatches">
                  {PIN_COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        getPinBackgroundColor(categoryColorModal.draft) === color
                          ? "routeColorSwatch selected"
                          : "routeColorSwatch"
                      }
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setCategoryColorModal((prev) => ({
                          ...prev,
                          draft: color,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="categoryColorCustomRow">
                <span>Custom</span>
                <label
                  className={
                    isSupporterAccount
                      ? "categoryNativeColorControl"
                      : "categoryNativeColorControl disabled"
                  }
                  onClick={() => {
                    if (!isSupporterAccount) {
                      showSupporterFeatureModal("Custom pin colors");
                    }
                  }}
                >
                  <span
                    className="pinNativeColorFill"
                    style={{
                      backgroundColor: getPinBackgroundColor(
                        categoryColorModal.draft
                      ),
                    }}
                  />
                  <input
                    className="pinNativeColorInput"
                    type="color"
                    value={getPinBackgroundColor(categoryColorModal.draft)}
                    disabled={!isSupporterAccount}
                    onChange={(event) =>
                      isSupporterAccount
                        ? setCategoryColorModal((prev) => ({
                            ...prev,
                            draft: event.target.value,
                          }))
                        : showSupporterFeatureModal("Custom pin colors")
                    }
                    aria-label="Selecionar cor da categoria"
                  />
                </label>
              </div>
            </div>

            <div className="modalActions">
              <button className="primary" onClick={saveCategoryColorModal}>
                {t("actions.save")}
              </button>
              <button className="secondary" onClick={closeCategoryColorModal}>
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {supporterFeatureModal && (
        <div
          className="modalOverlay supporterFeatureOverlay"
          onClick={() => setSupporterFeatureModal(null)}
        >
          <div
            className="modal supporterFeatureModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="closeButton"
              onClick={() => setSupporterFeatureModal(null)}
            >
              {"\u00D7"}
            </button>
            <h2>{supporterFeatureModal.title}</h2>
            <p>{supporterFeatureModal.message}</p>
            <div className="modalActions">
              <Link
                className="primary"
                href="/support"
                target="_blank"
                rel="noreferrer"
              >
                Go to Support
              </Link>
              <button
                className="secondary"
                onClick={() => setSupporterFeatureModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {iconPickerOpen && (
        <div className="modalOverlay" onClick={closeIconPicker}>
          <div className="modal iconPickerModal" onClick={(e) => e.stopPropagation()}>
            <div className="manageGroupsHeader">
              <div>
                <h2>{t("manage.iconPickerTitle")}</h2>
                <p>{t("manage.iconPickerDescription")}</p>
              </div>

              <button className="closeButton" onClick={closeIconPicker}>
                {"\u00D7"}
              </button>
            </div>

            <div className="iconPickerTabs">
              <button
                className={iconPickerTab === "default" ? "selectedToggle" : ""}
                onClick={() => setIconPickerTab("default")}
              >
                {t("manage.iconDefault")}
              </button>

              <button
                className={iconPickerTab === "custom" ? "selectedToggle" : ""}
                onClick={() => setIconPickerTab("custom")}
              >
                {t("manage.iconCustom")}
              </button>
            </div>

            {iconPickerTab === "default" ? (
              <div className="iconPickerGrid">
                {DEFAULT_ICONS.map((icon) => {
                  const option = getDefaultIconOption(icon);
                  const used = pinTypes.some(
                    (type) =>
                      type.iconKey === option.key &&
                      type._id !== editingIconCategory?.pinTypeId
                  );
                  const selected =
                    iconPickerDraft?.iconType === option.iconType &&
                    (option.iconType === "custom"
                      ? iconPickerDraft?.iconImageUrl === option.iconImageUrl
                      : iconPickerDraft?.icon === option.icon);

                  return (
                    <button
                      key={option.key}
                      disabled={used}
                      className={
                        selected
                          ? `iconPickerItem ${
                              option.iconType === "custom" ? "custom " : ""
                            }selected`
                          : used
                          ? `iconPickerItem ${
                              option.iconType === "custom" ? "custom " : ""
                            }disabled`
                          : `iconPickerItem${
                              option.iconType === "custom" ? " custom" : ""
                            }`
                      }
                      onClick={() => {
                        if (used) return;

                        setIconPickerDraft({
                          icon: option.icon,
                          iconType: option.iconType,
                          iconImageUrl: option.iconImageUrl,
                        });
                      }}
                      title={used ? t("manage.iconInUse") : option.label}
                    >
                      {option.iconType === "custom" ? (
                        <img src={option.iconImageUrl} alt={option.label} />
                      ) : (
                        option.icon
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="iconPickerGrid">
                {assets.length === 0 ? (
                  <p className="emptyText">{t("manage.iconEmpty")}</p>
                ) : (
                  assets.map((asset) => {
                    const iconKey = `custom:${asset.imageUrl}`;
                    const used = pinTypes.some(
                      (type) =>
                        type.iconKey === iconKey &&
                        type._id !== editingIconCategory?.pinTypeId
                    );
                    const selected =
                      iconPickerDraft?.iconType === "custom" &&
                      iconPickerDraft?.iconImageUrl === asset.imageUrl;

                    return (
                      <button
                        key={asset._id}
                        disabled={used}
                        className={
                          selected
                            ? "iconPickerItem custom selected"
                            : used
                            ? "iconPickerItem custom disabled"
                            : "iconPickerItem custom"
                        }
                        onClick={() => {
                          if (used) return;

                          setIconPickerDraft({
                            icon: "",
                            iconType: "custom",
                            iconImageUrl: asset.imageUrl,
                          });
                        }}
                        title={used ? t("manage.iconInUse") : asset.name}
                      >
                        <img src={asset.imageUrl} alt={asset.name} />
                        <span>{asset.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <div className="iconPickerActions">
              <button
                className="primary"
                disabled={!iconPickerDraft}
                onClick={saveIconPickerSelection}
              >
                {t("actions.save")}
              </button>

              <button className="secondary" onClick={closeIconPicker}>
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {destinationModalOpen && (
        <div className="modalOverlay" onClick={closeDestinationModal}>
          <div
            className="modal destinationModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeDestinationModal}>
              {"\u00D7"}
            </button>

            <h2>Portal Destination</h2>
            <p className="modalSubtitle">
              Selecione um mapa deste grupo para abrir quando este portal for usado.
            </p>

            <div className="destinationMapList">
              {destinationLoading ? (
                <p className="emptyText">Carregando mapas...</p>
              ) : destinationMaps.filter((destination) => destination._id !== mapId)
                  .length === 0 ? (
                <p className="emptyText">Nenhum outro mapa encontrado neste grupo.</p>
              ) : (
                <>
                  <label
                    className={`destinationMapOption${
                      !destinationMapId ? " selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="destinationMap"
                      checked={!destinationMapId}
                      onChange={() => setDestinationMapId("")}
                    />
                    <span className="destinationMapRadio" aria-hidden="true" />
                    <span className="destinationMapName">Sem destino</span>
                  </label>

                  {destinationMaps
                    .filter((destination) => destination._id !== mapId)
                    .map((destination) => (
                      <label
                        key={destination._id}
                        className={`destinationMapOption${
                          destinationMapId === destination._id ? " selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="destinationMap"
                          checked={destinationMapId === destination._id}
                          onChange={() => setDestinationMapId(destination._id)}
                        />
                        <span className="destinationMapRadio" aria-hidden="true" />
                        <span className="destinationMapName">
                          {destination.title || "Untitled map"}
                        </span>
                      </label>
                    ))}
                </>
              )}
            </div>

            <div className="modalActions">
              <button
                className="primary"
                disabled={destinationLoading}
                onClick={savePinDestination}
              >
                {t("actions.save")}
              </button>
              <button className="secondary" onClick={closeDestinationModal}>
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {chainChoiceOpen && (
        <div className="modalOverlay" onClick={closeChainModal}>
          <div
            className="modal chainChoiceModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeChainModal}>
              {"\u00D7"}
            </button>

            <h2>Chain Requirements</h2>
            <p className="modalSubtitle">
              Gerencie os requirements vinculados a este pin.
            </p>

            <div className="chainRequirementList">
              {Array.isArray(chainPin?.chainRequirements) &&
              chainPin.chainRequirements.length > 0 ? (
                chainPin.chainRequirements.map((requirement) => (
                  <div
                    className="chainRequirementRow"
                    key={getChainRequirementKey(requirement)}
                  >
                    <span className="chainRequirementIcon">
                      {requirement.iconType === "custom" &&
                      requirement.iconImageUrl ? (
                        <img
                          src={requirement.iconImageUrl}
                          alt={getChainRequirementLabel(requirement)}
                        />
                      ) : (
                        normalizePinIcon(requirement.icon)
                      )}
                    </span>
                    <span className="chainRequirementName">
                      {getChainRequirementLabel(requirement)}
                    </span>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => requestDeletePinChainRequirement(requirement)}
                    >
                      Deletar
                    </button>
                  </div>
                ))
              ) : (
                <p className="emptyText">Nenhum chain vinculado.</p>
              )}
            </div>

            <div className="chainChoiceActions">
              <button className="secondary" onClick={() => openChainModal()}>
                Chain Category
              </button>
              <button className="secondary" onClick={() => startChainPinPick()}>
                Chain Pin
              </button>
              <button
                className="danger"
                disabled={
                  !Array.isArray(chainPin?.chainRequirements) ||
                  chainPin.chainRequirements.length === 0
                }
                onClick={requestResetPinChains}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {chainModalOpen && (
        <div className="modalOverlay" onClick={closeChainModal}>
          <div
            className="modal chainModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeChainModal}>
              {"\u00D7"}
            </button>

            <h2>Chain Requirements</h2>
            <p className="modalSubtitle">
              Selecione as categorias que fazem partes da corrente de requerimentos.
            </p>

            <div className="pinCategoryPicker chainCategoryPicker">
              {pinGroups.map((group) => (
                <div className="pinCategoryGroup" key={group.value}>
                  <h4>{group.label}</h4>

                  {group.types.length === 0 ? (
                    <p className="emptyText">{t("manage.noCategories")}</p>
                  ) : (
                    <div className="pinCategoryGrid">
                      {group.types.map((type) => {
                        const selected = chainForm.requirements.some(
                          (requirement) =>
                            getChainRequirementKey(requirement) ===
                            getChainRequirementKey(
                              getChainRequirementFromType(group, type)
                            )
                        );

                        return (
                          <button
                            key={type.renderKey}
                            type="button"
                            title={type.label}
                            className={
                              selected
                                ? "pinCategoryOption chainCategoryOption selected"
                                : "pinCategoryOption chainCategoryOption"
                            }
                            onClick={() => toggleChainRequirement(group, type)}
                          >
                            <span className="pinCategoryOptionIcon">
                              {type.iconType === "custom" && type.iconImageUrl ? (
                                <img src={type.iconImageUrl} alt={type.label} />
                              ) : (
                                normalizePinIcon(type.icon)
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label>
              Descrição
              <textarea
                value={chainForm.description}
                onChange={(event) =>
                  setChainForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Ex: Precisa concluir as categorias selecionadas antes deste pin."
              />
            </label>

            <div className="modalActions">
              <button className="primary" onClick={() => savePinChains()}>
                Salvar
              </button>
              <button className="secondary" onClick={closeChainModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {scaleSettingsOpen && (
        <div className="modalOverlay">
          <div
            className="modal mapSettingsModal scaleSettingsModal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="closeButton" onClick={closeScaleSettings}>
              {"\u00D7"}
            </button>

            <div className="mapSettingsHeader">
              <h2>Map Scale</h2>
            </div>

            <div className="mapSettingsContent">
              <section className="mapSettingsSection">
                <h3>Sizes</h3>

                <div className="mapSettingsControls">
                  <label className="rangeSetting">
                    <span>
                      {t("settings.pinSize")}
                      <strong>{scaleSettingsForm.pinSize}%</strong>
                    </span>
                    <input
                      type="range"
                      min={MIN_MAP_PIN_SIZE}
                      max="100"
                      value={scaleSettingsForm.pinSize}
                      onChange={(event) => {
                        const pinSize = Number(event.target.value);
                        setMapPinSize(pinSize);
                        setScaleSettingsForm((prev) => ({ ...prev, pinSize }));
                      }}
                    />
                  </label>

                  <label className="rangeSetting">
                    <span>
                      {t("settings.routeSize")}
                      <strong>{scaleSettingsForm.routeSize}%</strong>
                    </span>
                    <input
                      type="range"
                      min={MIN_MAP_ROUTE_SIZE}
                      max="100"
                      value={scaleSettingsForm.routeSize}
                      onChange={(event) => {
                        const routeSize = Number(event.target.value);
                        setMapRouteSize(routeSize);
                        setScaleSettingsForm((prev) => ({ ...prev, routeSize }));
                      }}
                    />
                  </label>

                  <label className="rangeSetting">
                    <span>
                      {t("settings.noteSize")}
                      <strong>{scaleSettingsForm.noteSize}%</strong>
                    </span>
                    <input
                      type="range"
                      min={MIN_MAP_NOTE_SIZE}
                      max="100"
                      value={scaleSettingsForm.noteSize}
                      onChange={(event) => {
                        const noteSize = Number(event.target.value);
                        setMapNoteSize(noteSize);
                        setScaleSettingsForm((prev) => ({ ...prev, noteSize }));
                      }}
                    />
                  </label>

                  <div className="mapSettingsButtonGroup">
                    <button
                      className="settingsDefaultButton"
                      type="button"
                      onClick={() => {
                        setMapPinSize(DEFAULT_MAP_PIN_SIZE);
                        setMapRouteSize(DEFAULT_MAP_ROUTE_SIZE);
                        setMapNoteSize(DEFAULT_MAP_NOTE_SIZE);
                        setScaleSettingsForm({
                          pinSize: DEFAULT_MAP_PIN_SIZE,
                          routeSize: DEFAULT_MAP_ROUTE_SIZE,
                          noteSize: DEFAULT_MAP_NOTE_SIZE,
                        });
                      }}
                    >
                      {t("settings.default")}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="modalActions">
              <button
                className="primary"
                disabled={savingMapSettings}
                onClick={saveScaleSettings}
              >
                {t("actions.save")}
              </button>

              <button
                className="secondary"
                disabled={savingMapSettings}
                onClick={closeScaleSettings}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="closeButton" onClick={closeModal}>
              {"\u00D7"}
            </button>

            <h2>{editingPin ? "Editar pin" : "Novo pin"}</h2>
            <p className="modalSubtitle">
              Escolha uma categoria para o pin e depois preencha as informaÃ§Ãµes.
            </p>

            <div className="pinCategoryPicker">
              {pinGroups.map((group) => (
                <div className="pinCategoryGroup" key={group.value}>
                  <h4>{group.label}</h4>

                  {group.types.length === 0 ? (
                    <p className="emptyText">{t("manage.noCategories")}</p>
                  ) : (
                    <div className="pinCategoryGrid">
                      {group.types.map((type) => {
                        const selected =
                          form.typeName === type.label &&
                          form.category === group.value &&
                          form.iconType === type.iconType &&
                          (form.iconImageUrl || "") === (type.iconImageUrl || "");

                        return (
                          <button
                            key={type.renderKey}
                            type="button"
                            title={type.label}
                            className={
                              selected
                                ? "pinCategoryOption selected"
                                : "pinCategoryOption"
                            }
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                typeName: type.label,
                                category: group.value,
                                icon: normalizePinIcon(type.icon),
                                iconType: type.iconType || "emoji",
                                iconImageUrl: type.iconImageUrl || "",
                              }));
                            }}
                          >
                            <span className="pinCategoryOptionIcon">
                              {type.iconType === "custom" && type.iconImageUrl ? (
                                <img src={type.iconImageUrl} alt={type.label} />
                              ) : (
                                normalizePinIcon(type.icon)
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Ex: Quest do velho pescador"
              />
            </label>

            <label>
              DescriÃ§Ã£o
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Ex: Fica atrÃ¡s da cachoeira."
              />
            </label>

            <div className="modalActions">
              <button className="primary" onClick={savePin}>
                {editingPin ? "Salvar alterações" : "Salvar"}
              </button>
              <button className="secondary" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
