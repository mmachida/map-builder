"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";
import { DEFAULT_ICONS } from "@/lib/constants/icons";
import PinSidebarContent from "@/app/components/map/PinSidebarContent";
import RouteSidebarContent from "@/app/components/map/RouteSidebarContent";
import MapLanguageSelect from "@/app/components/map/MapLanguageSelect";
import useMapLocale from "@/app/components/map/useMapLocale";
import { MAP_ACCESS } from "@/lib/mapAccess";

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "bau", label: "Baú" },
  { value: "boss", label: "Boss" },
  { value: "npc", label: "NPC" },
  { value: "item", label: "Item" },
  { value: "segredo", label: "Segredo" },
];

export default function EditorPage() {
  const params = useParams();
  const mapId = params.id;
  const { locale, setLocale, t } = useMapLocale();

  const [mapData, setMapData] = useState(null);
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedPin, setSelectedPin] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [pendingPosition, setPendingPosition] = useState(null);

  const [isAddingPin, setIsAddingPin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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

  const [createMode, setCreateMode] = useState(null);
  const [createValue, setCreateValue] = useState("");
  const [createCategoryIcon, setCreateCategoryIcon] = useState("📍");

  const [createCategoryIconType, setCreateCategoryIconType] = useState("emoji");
  const [createCategoryIconImageUrl, setCreateCategoryIconImageUrl] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTab, setIconPickerTab] = useState("default");
  const [contextMenu, setContextMenu] = useState(null);

  const [routeDescription, setRouteDescription] = useState("");
  const [routeMouseDownPoint, setRouteMouseDownPoint] = useState(null);

  const [routeSidebarCollapsed, setRouteSidebarCollapsed] = useState(false);
  const [routeSearch, setRouteSearch] = useState("");

  const [mapMouseDownPoint, setMapMouseDownPoint] = useState(null);
  const mapMouseDownPointRef = useRef(null);
  const mapDragRef = useRef(false);

  const [iconPickerMode, setIconPickerMode] = useState("create");
  const [editingIconCategory, setEditingIconCategory] = useState(null);

  const [activeManageUI, setActiveManageUI] = useState(null);

  const [manageRoutesModalOpen, setManageRoutesModalOpen] = useState(false);
  const [routeOrderDraft, setRouteOrderDraft] = useState([]);

  const [movingPin, setMovingPin] = useState(null);
  const [movingPinPosition, setMovingPinPosition] = useState(null);

  const [confirmMovePinOpen, setConfirmMovePinOpen] = useState(false);


  const [form, setForm] = useState({
    name: "",
    typeName: "",
    description: "",
    icon: "📍",
    iconType: "emoji",
    iconImageUrl: "",
    category: "geral",
  });

  const [routes, setRoutes] = useState([]);
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeColor, setRouteColor] = useState("#3b82f6");
  const [routeWidth, setRouteWidth] = useState(4);
  const [mousePoint, setMousePoint] = useState(null);

  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [editingRouteData, setEditingRouteData] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [hiddenRouteIds, setHiddenRouteIds] = useState([]);

  const [pinPopupPosition, setPinPopupPosition] = useState(null);

  const [activeUI, setActiveUI] = useState(null);

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

        setMapData(mapDataResult.map);
        setIsOwner(mapDataResult.isOwner);

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

  function getPinIconKey(pin) {
    if (pin.iconKey) return pin.iconKey;

    if (pin.iconType === "custom") {
      return `custom:${pin.iconImageUrl || ""}`;
    }

    return `emoji:${pin.icon || "📍"}`;
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
      icon: "📍",
      iconType: "emoji",
      iconImageUrl: "",
      category: firstGroup,
    };
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

  function handlePinClick(event, pin) {
    event.stopPropagation();

    if (mapDragRef.current) return;

    if (movingPin) return;

    if (isDrawingRoute) return;

    setSelectedPin(pin);
    setSelectedRoute(null);
    setIsEditingRoute(false);

    setPinPopupPosition({
      x: pin.x,
      y: pin.y,
    });
  }

  function openEditModal(pin) {
    setEditingPin(pin);
    setPendingPosition(null);

    setForm({
      name: pin.name || "",
      typeName: pin.typeName || pin.name || "",
      description: pin.description || "",
      icon: pin.icon || "📍",
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

  function applyExistingPinType(pinTypeId) {
    const selectedType = pinTypes.find((type) => type._id === pinTypeId);

    if (!selectedType) return;

    setForm((prev) => ({
      ...prev,
      typeName: selectedType.typeName,
      category: selectedType.category || "geral",
      icon: selectedType.icon || "📍",
      iconType: selectedType.iconType || "emoji",
      iconImageUrl: selectedType.iconImageUrl || "",
    }));
  }

  async function savePin() {
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
          icon: form.icon,
          iconType: form.iconType,
          iconImageUrl: form.iconImageUrl,
          iconKey:
            selectedType?.iconKey ||
            (form.iconType === "custom"
              ? `custom:${form.iconImageUrl || ""}`
              : `emoji:${form.icon || "📍"}`),
          category: finalCategory,
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

  function renderPinIcon(pin) {
    if (pin.iconType === "custom" && pin.iconImageUrl) {
      return (
        <img src={pin.iconImageUrl} alt={pin.name} className="customPinIcon" />
      );
    }

    return pin.icon || "📍";
  }

  function handleRouteClick(event, route) {
    event.stopPropagation();

    if (mapDragRef.current) return;

    if (movingPin) return;

    if (isDrawingRoute) return;

    setSelectedRoute(route);
    setSelectedPin(null);

    setEditingRouteData({
      name: route.name,
      color: route.color || "#ef4444",
      width: route.width || 4,
    });

    setIsEditingRoute(true);
  }

  function startRouteMode() {
    setIsDrawingRoute(true);
    setIsAddingPin(false);
    setRoutePoints([]);
    setRouteName("");
    setRouteColor("#3b82f6");
    setRouteWidth(4);
    setMousePoint(null);
    setRouteDescription("");
  }

  function cancelRouteMode() {
    setIsDrawingRoute(false);
    setRoutePoints([]);
    setRouteName("");
    setMousePoint(null);
  }

  async function saveRoute() {
    if (!routeName.trim()) {
      alert("Digite um nome para a rota.");
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
          name: routeName.trim(),
          description: routeDescription.trim(),
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
      cancelRouteMode();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar rota.");
    }
  }

  async function deleteRoute(routeId) {
    const confirmDelete = confirm("Tem certeza que deseja deletar esta rota?");

    if (!confirmDelete) return;

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
    } catch (error) {
      console.error(error);
      alert("Erro ao deletar rota.");
    }
  }

  async function updateRoute() {
    if (!editingRouteData.name.trim()) {
      alert("Digite um nome para a rota.");
      return;
    }

    try {
      const response = await fetch(`/api/routes/${selectedRoute._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingRouteData.name.trim(),
          description: editingRouteData.description?.trim() || "",
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
                name: editingRouteData.name.trim(),
                description: editingRouteData.description?.trim() || "",
                color: editingRouteData.color,
                width: editingRouteData.width,
              }
            : route
        )
      );

      setSelectedRoute(null);
      setIsEditingRoute(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar rota.");
    }
  }

  function undoLastPoint() {
    setRoutePoints((prev) => prev.slice(0, -1));
  }

  function clearRoutePoints() {
    const confirmClear = confirm("Limpar todos os pontos?");
    if (!confirmClear) return;
    setRoutePoints([]);
  }

  function handleMapMouseMove(event) {
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

    if (!isDrawingRoute) return;

    const imageWrapper = event.currentTarget;
    const rect = imageWrapper.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setMousePoint({ x, y });
  }

  function toggleRouteVisibility(routeId) {
    setHiddenRouteIds((prev) =>
      prev.includes(routeId)
        ? prev.filter((id) => id !== routeId)
        : [...prev, routeId]
    );
  }

  function selectRouteFromList(route) {
    const isSame = selectedRoute?._id === route._id;

    if (isSame) {
      // 🔴 clicou na mesma → deseleciona
      setSelectedRoute(null);
      setIsEditingRoute(false);
      return;
    }

    // 🟢 nova seleção
    setSelectedRoute(route);
    setSelectedPin(null);

    setEditingRouteData({
      name: route.name,
      description: route.description || "",
      color: route.color || "#ef4444",
      width: route.width || 4,
    });

    setIsEditingRoute(true);
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
          category: type.category || "geral",
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

  function closeManageGroupsModal() {
    setManageGroupsModalOpen(false);
    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
    setMoveMode(false);
    setMoveTargetGroup("");
    setCreateMode(null);
    setCreateValue("");
    setCreateCategoryIcon("📍");
    setActiveManageUI(null);
  }

  async function renameGroup(group) {
    if (!group._id) {
      alert("Este grupo ainda não tem ID editável.");
      return;
    }

    if (!renameValue.trim()) {
      alert("Digite um nome para o grupo.");
      return;
    }

    const newLabel = renameValue.trim();

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
  }

  async function deleteGroup(group) {
    if (!group._id) {
      alert("Este grupo ainda não tem ID editável.");
      return;
    }

    const confirmDelete = confirm("Deletar este grupo e todos os pins dele?");
    if (!confirmDelete) return;

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
      prev.filter((pin) => (pin.category || "geral") !== group.value)
    );

    setHiddenPinTypes((prev) =>
      prev.filter((key) => !group.types.some((type) => type.key === key))
    );

    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
  }

  async function renameCategory(type) {
    if (!type.pinTypeId) {
      alert("Esta categoria ainda não tem ID editável.");
      return;
    }

    if (!renameValue.trim()) {
      alert("Digite um nome para a categoria.");
      return;
    }

    const newTypeName = renameValue.trim();

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
  }

  async function deleteCategory(type) {
  console.log("Tentando deletar categoria:", type);

  if (!type.pinTypeId) {
    alert("Esta categoria ainda não tem ID editável.");
    return;
  }

  const confirmDelete = confirm("Deletar esta categoria e todos os pins dela?");
  if (!confirmDelete) return;

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
      prev.filter((pin) => getPinIconKey(pin) !== type.iconKey)
    );

    setHiddenPinTypes((prev) => prev.filter((key) => key !== type.key));

    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
    setMoveMode(false);
    setActiveManageUI(null);
  } catch (error) {
    console.error("ERRO FRONT DELETE CATEGORY:", error);
    alert("Erro ao deletar categoria. Veja o console.");
  }
}

  async function moveCategory(type) {
    if (!type.pinTypeId) {
      alert("Categoria inválida.");
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
  }

  async function createGroup() {
    if (!mapData?.groupId) {
      alert("Este mapa não tem grupo de mapas.");
      return;
    }

    if (!createValue.trim()) {
      alert("Digite um nome para o grupo.");
      return;
    }

    const realCategories = pinCategories.filter(
      (category) => category._id !== "default-geral" && !category.isDefault
    );

    const maxOrder =
      realCategories.length > 0
        ? Math.max(
            ...realCategories.map((category, index) =>
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
        label: createValue.trim(),
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
  }

  async function createCategoryInsideGroup(group) {
    if (!mapData?.groupId) {
      alert("Este mapa não tem grupo de mapas.");
      return;
    }

    if (!createValue.trim()) {
      alert("Digite um nome para a categoria.");
      return;
    }

    if (
      createCategoryIconType === "emoji" &&
      createCategoryIcon === "📍" &&
      !createCategoryIconImageUrl
    ) {
      alert("Escolha um ícone para a categoria.");
      return;
    }

    const iconKey =
      createCategoryIconType === "custom"
        ? `custom:${createCategoryIconImageUrl}`
        : `emoji:${createCategoryIcon}`;

    const iconAlreadyExists = pinTypes.some((type) => type.iconKey === iconKey);

    if (iconAlreadyExists) {
      alert("Já existe uma categoria usando este ícone.");
      return;
    }

    const response = await fetch(`/api/groups/${mapData.groupId}/pin-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typeName: createValue.trim(),
        category: group.value,
        icon: createCategoryIconType === "emoji" ? createCategoryIcon : "",
        iconType: createCategoryIconType,
        iconImageUrl:
          createCategoryIconType === "custom" ? createCategoryIconImageUrl : "",
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
    setCreateCategoryIcon("📍");
    setCreateCategoryIconType("emoji");
    setCreateCategoryIconImageUrl("");
    setIconPickerOpen(false);
  }

  async function moveGroup(group, direction) {
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
      alert("Não é possível mover grupo virtual.");
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

    try {
      await Promise.all([
        fetch(`/api/pin-categories/${currentGroup._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sortOrder: finalCategories.find(
              (category) => category._id === currentGroup._id
            ).sortOrder,
          }),
        }),
        fetch(`/api/pin-categories/${targetGroup._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sortOrder: finalCategories.find(
              (category) => category._id === targetGroup._id
            ).sortOrder,
          }),
        }),
      ]);
    } catch (error) {
      console.error("ERRO AO MOVER GRUPO:", error);
      alert("Erro ao mover grupo.");
    }
  }

  function openMapContextMenu(event) {
    event.preventDefault();

      if (movingPin) return;
      if (isDrawingRoute) return;

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
    setIsDrawingRoute(true);
    setIsAddingPin(false);
    setRoutePoints([]);

    setRouteName("");
    setRouteColor("#3b82f6");
    setRouteWidth(4);
    setMousePoint(null);
    closeContextMenu();
    setRouteDescription("");
  }

  function getMapPointFromEvent(event) {
    const imageWrapper = event.currentTarget;
    const rect = imageWrapper.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
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

    if (!isDrawingRoute || event.button !== 0) return;

    setRouteMouseDownPoint(getMapPointFromEvent(event));
  }

  function handleMapMouseUp(event) {
    if (
      event.target.closest?.(".routeSnapHitbox") ||
      event.target.closest?.(".routeSnapButton")
    ) {
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
    const wrapper = document.querySelector(".transformWrapper");
    const content = document.querySelector(".imageWrapper");

    if (!wrapper || !content) return;

    const scale = 1;

    const x = (wrapper.clientWidth - content.offsetWidth * scale) / 2;
    const y = (wrapper.clientHeight - content.offsetHeight * scale) / 2;

    setTransform(x, y, scale, 200);
  }

  function showAllRoutes() {
    setHiddenRouteIds([]);
  }

  function hideAllRoutes() {
    setHiddenRouteIds(routes.map((route) => route._id));
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
      alert("Já existe uma categoria usando este ícone.");
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
      alert(data.error || "Erro ao alterar ícone.");
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
  }

  function openManageUI(key) {
    setActiveManageUI((prev) => (prev === key ? null : key));

    setRenameMode(false);
    setMoveMode(false);
    setExpandedManageItem(null);
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
    } catch (error) {
      console.error("ERRO AO SALVAR ORDEM DAS ROTAS:", error);
      alert("Erro ao salvar ordem das rotas.");
    }
  }

  function startMovePin(pin) {
    setMovingPin(pin);
    setMovingPinPosition({
      x: pin.x,
      y: pin.y,
    });

    setSelectedPin(null);
    setSelectedRoute(null);
    setIsEditingRoute(false);
  }

  function handleMovePinMouseMove(event) {
    if (!movingPin) return;

    const imageWrapper = event.currentTarget;
    const rect = imageWrapper.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setMovingPinPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  async function finishMovePin(pinToMove = movingPin, positionToSave = movingPinPosition) {
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
          icon: pinToMove.icon || "📍",
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
            canManage={MAP_ACCESS.editor.canManagePinGroups}
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
            onManage={() => setManageGroupsModalOpen(true)}
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
              onClick={() => setManageGroupsModalOpen(true)}
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
                              key={type.key}
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

          </>
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
            canManage={MAP_ACCESS.editor.canEditRoutes}
            manageDisabled={!!movingPin}
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
            onManageRoutes={() => {
              setRouteOrderDraft(orderedRoutes);
              setManageRoutesModalOpen(true);
            }}
            onSelectRoute={(route) => {
              if (movingPin) return;
              selectRouteFromList(route);
            }}
            onToggleRouteVisibility={toggleRouteVisibility}
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
                        {isHidden ? "🙈" : "👁️"}
                      </button>

                      {isSelected && (
                        <div className="routeListDescription">
                          {route.description || "Sem descrição."}
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
                      onChange={(event) => {
                        if (isDrawingRoute) {
                          setRouteName(event.target.value);
                        } else {
                          setEditingRouteData((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }));
                        }
                      }}
                      placeholder={t("route.name")}
                    />

                    <input
                      value={
                        isDrawingRoute
                          ? routeDescription
                          : editingRouteData?.description || ""
                      }
                      onChange={(event) => {
                        if (isDrawingRoute) {
                          setRouteDescription(event.target.value);
                        } else {
                          setEditingRouteData((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }));
                        }
                      }}
                      placeholder={t("common.description")}
                    />
                  </div>

                  <div className="routeRight">
                    <div>
                    <label>
                      {t("common.color")}
                      <input
                        type="color"
                        value={
                          isDrawingRoute
                            ? routeColor
                            : editingRouteData?.color || "#3b82f6"
                        }
                        onChange={(event) => {
                          if (isDrawingRoute) {
                            setRouteColor(event.target.value);
                          } else {
                            setEditingRouteData((prev) => ({
                              ...prev,
                              color: event.target.value,
                            }));
                          }
                        }}
                      />
                    </label>

                    <label>
                      {isDrawingRoute ? routeWidth : editingRouteData?.width || 4}px
                      <input
                        type="range"
                        min="2"
                        max="10"
                        value={isDrawingRoute ? routeWidth : editingRouteData?.width || 4}
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
                          ↶
                        </button>

                        <button onClick={clearRoutePoints} disabled={routePoints.length === 0}>
                          ✕
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
                          onClick={() => deleteRoute(selectedRoute._id)}
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
                <Link className="backLink" href="/">
                  {t("actions.dashboard")}
                </Link>

                <button
                  disabled={!!movingPin}
                  className={isAddingPin ? "activeAddButton" : "addButton"}
                  onClick={() => {
                    setIsAddingPin((prev) => !prev);
                    setIsDrawingRoute(false);
                  }}
                >
                  {isAddingPin ? t("map.addingPin") : t("actions.addPin")}
                </button>

                <button
                  disabled={!!movingPin}
                  className={isDrawingRoute ? "activeAddButton" : "addButton"}
                  onClick={startRouteMode}
                >
                  {isDrawingRoute ? t("map.drawRoute") : t("actions.addRoute")}
                </button>

                <button onClick={copyPublicLink}>{t("actions.copyLink")}</button>
                </div>

                <div className="headerSettings">
                  <MapLanguageSelect locale={locale} onLocaleChange={setLocale} />
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
                    className={
                      isDrawingRoute
                        ? "imageWrapper drawingRoute"
                        : isAddingPin
                        ? "imageWrapper addingPin"
                        : "imageWrapper"
                    }
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

                        if (distance <= 4 && !isAddingPin && !isDrawingRoute) {
                          setSelectedPin(null);
                          setSelectedRoute(null);
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
                    <img
                      src={mapData.imageUrl}
                      alt={mapData.title}
                      className="mapImage"
                      draggable="false"
                      onLoad={() => {
                        setTimeout(centerMap, 50);
                      }}
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
                                ? editingRouteData?.width || route.width || 4
                                : hoveredRouteId === route._id
                                ? (route.width || 4) + 1
                                : route.width || 4
                            }
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray="8 6"
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
                          strokeWidth={routeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="8 6"
                        />
                      )}

                      {isDrawingRoute && routePoints.length > 0 && mousePoint && (
                        <line
                          x1={routePoints[routePoints.length - 1].x}
                          y1={routePoints[routePoints.length - 1].y}
                          x2={mousePoint.x}
                          y2={mousePoint.y}
                          stroke={routeColor}
                          strokeWidth={routeWidth}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray="8 6"
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
                                r="0.75"
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
                                r="0.75"
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
                          r="0.8"
                          fill={routeColor}
                        />
                      ))}
                    </svg>

                    {filteredPins.map((pin) => (
                      <button
                        key={pin._id}
                        className={
                          movingPin
                            ? movingPin._id === pin._id
                              ? pin.iconType === "custom"
                                ? "pin customPin movingPinActive"
                                : "pin emojiPin movingPinActive"
                              : pin.iconType === "custom"
                              ? "pin customPin routeEditingDimmed"
                              : "pin emojiPin routeEditingDimmed"
                            : isDrawingRoute
                            ? pin.iconType === "custom"
                              ? "pin customPin routeEditingDimmed"
                              : "pin emojiPin routeEditingDimmed"
                            : pin.iconType === "custom"
                            ? "pin customPin"
                            : "pin emojiPin"
                        }
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
                          onClick={() => setSelectedPin(null)}
                        >
                          ×
                        </button>

                        <div className="pinPopupHeader">
                          <div className="pinPopupIcon">
                            {selectedPin.iconType === "custom" ? (
                              <img src={selectedPin.iconImageUrl} alt={selectedPin.name} />
                            ) : (
                              selectedPin.icon || "📍"
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

                        <div className="pinPopupMeta">
                          <div>
                            <strong>{t("common.group")}:</strong>{" "}
                            {pinGroups.find(
                              (group) => group.value === (selectedPin.category || "geral")
                            )?.label || "—"}
                          </div>

                          <div>
                            <strong>{t("common.category")}:</strong>{" "}
                            {selectedPin.typeName || "—"}
                          </div>
                        </div>

                        <div className="pinPopupActions">
                          <button className="secondary" onClick={() => openEditModal(selectedPin)}>
                            {t("actions.edit")}
                          </button>

                          <button className="secondary" onClick={() => startMovePin(selectedPin)}>
                            {t("actions.move")}
                          </button>

                          <button className="danger" onClick={() => deletePin(selectedPin._id)}>
                            {t("actions.delete")}
                          </button>
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

      {contextMenu && (
        <div
          className="mapContextMenu"
          style={{
            left: contextMenu.screenX,
            top: contextMenu.screenY,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={addPinFromContextMenu}>Adicionar Pin</button>
          <button onClick={addRouteFromContextMenu}>Adicionar Rota</button>
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
                  ×
                </button>
              </div>

              <button
                className="primary manageAddGroupButton"
                onClick={() => {
                  openManageUI("create-group");
                  setCreateValue("");
                }}
              >
                {t("manage.addGroup")}
              </button>
            </div>

            {activeManageUI === "create-group" && (
              <div className="manageCreateBox">
                <input
                  value={createValue}
                  onChange={(event) => setCreateValue(event.target.value)}
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
                                onChange={(event) =>
                                  setRenameValue(event.target.value)
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

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "up")}
                                title={t("manage.moveUp")}
                              >
                                ↑
                              </button>

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "down")}
                                title={t("manage.moveDown")}
                              >
                                ↓
                              </button>

                              <button
                                className="danger"
                                onClick={() => deleteGroup(group)}
                              >
                                {t("actions.delete")}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                    <div className="manageAddCategoryRow">
                      <button
                        className="secondary"
                        onClick={() => {
                          openManageUI(`create-category:${group.value}`);
                          setCreateValue("");
                          setCreateCategoryIcon("📍");
                        }}
                      >
                        {t("manage.addCategory")}
                      </button>
                    </div>

                    {activeManageUI === `create-category:${group.value}` && (
                      <div className="manageCreateBox manageCreateBoxNested">
                        <button
                          type="button"
                          className="iconPickerButton"
                          onClick={() => {
                            setIconPickerOpen(true);
                            setIconPickerTab("default");
                          }}
                        >
                          {createCategoryIconType === "custom" && createCategoryIconImageUrl ? (
                            <img src={createCategoryIconImageUrl} alt="Ícone selecionado" />
                          ) : (
                            <span>{createCategoryIcon}</span>
                          )}
                        </button>

                        <input
                          value={createValue}
                          onChange={(event) => setCreateValue(event.target.value)}
                          placeholder={t("manage.newCategoryName")}
                          autoFocus
                        />

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
                            setCreateCategoryIcon("📍");
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
                          <div key={type.key}>
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
                                  type.icon || "📍"
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
                                        onChange={(event) =>
                                          setRenameValue(event.target.value)
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

                                      <button
                                        className="secondary"
                                        onClick={() => {
                                          setIconPickerMode("edit");
                                          setEditingIconCategory(type);
                                          setIconPickerOpen(true);
                                          setIconPickerTab("default");
                                          setRenameMode(false);
                                          setMoveMode(false);
                                        }}
                                      >
                                        {t("manage.changeIcon")}
                                      </button>

                                      <button
                                        className="primary"
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
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          deleteCategory(type);
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
                  ×
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
                      ↑
                    </button>

                    <button
                      className="secondary iconButton"
                      disabled={index === routeOrderDraft.length - 1}
                      onClick={() => moveRoute(route, "down")}
                      title={t("manage.moveDown")}
                    >
                      ↓
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

      {iconPickerOpen && (
        <div className="modalOverlay" onClick={() => setIconPickerOpen(false)}>
          <div className="modal iconPickerModal" onClick={(e) => e.stopPropagation()}>
            <div className="manageGroupsHeader">
              <div>
                <h2>{t("manage.iconPickerTitle")}</h2>
                <p>{t("manage.iconPickerDescription")}</p>
              </div>

              <button className="closeButton" onClick={() => setIconPickerOpen(false)}>
                ×
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
                  const iconKey = `emoji:${icon}`;
                  const used = pinTypes.some((type) => type.iconKey === iconKey);
                  const selected =
                    createCategoryIconType === "emoji" &&
                    createCategoryIcon === icon;

                  return (
                    <button
                      key={icon}
                      disabled={used}
                      className={
                        selected
                          ? "iconPickerItem selected"
                          : used
                          ? "iconPickerItem disabled"
                          : "iconPickerItem"
                      }
                      onClick={() => {
                        if (used) return;

                        if (iconPickerMode === "edit" && editingIconCategory) {
                          updateCategoryIcon(editingIconCategory, {
                            icon,
                            iconType: "emoji",
                            iconImageUrl: "",
                          });
                          return;
                        }

                        setCreateCategoryIconType("emoji");
                        setCreateCategoryIcon(icon);
                        setCreateCategoryIconImageUrl("");
                        setIconPickerOpen(false);
                      }}
                      title={used ? t("manage.iconInUse") : icon}
                    >
                      {icon}
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
                    const used = pinTypes.some((type) => type.iconKey === iconKey);
                    const selected =
                      createCategoryIconType === "custom" &&
                      createCategoryIconImageUrl === asset.imageUrl;

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

                          if (iconPickerMode === "edit" && editingIconCategory) {
                            updateCategoryIcon(editingIconCategory, {
                              icon: "",
                              iconType: "custom",
                              iconImageUrl: asset.imageUrl,
                            });
                            return;
                          }

                          setCreateCategoryIconType("custom");
                          setCreateCategoryIconImageUrl(asset.imageUrl);
                          setCreateCategoryIcon("📍");
                          setIconPickerOpen(false);
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
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{editingPin ? "Editar pin" : "Novo pin"}</h2>
            <p className="modalSubtitle">
              Escolha uma categoria para o pin e depois preencha as informações.
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
                            key={type.key}
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
                                icon: type.icon || "📍",
                                iconType: type.iconType || "emoji",
                                iconImageUrl: type.iconImageUrl || "",
                              }));
                            }}
                          >
                            <span className="pinCategoryOptionIcon">
                              {type.iconType === "custom" && type.iconImageUrl ? (
                                <img src={type.iconImageUrl} alt={type.label} />
                              ) : (
                                type.icon || "📍"
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
