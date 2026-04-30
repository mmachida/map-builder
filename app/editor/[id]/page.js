"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "../../page.css";

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

  const [routeEffectsEnabled, setRouteEffectsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;

    const saved = localStorage.getItem("routeEffectsEnabled");
    return saved !== null ? JSON.parse(saved) : true;
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
    if (isDrawingRoute) {
      const imageWrapper = event.currentTarget;
      const rect = imageWrapper.getBoundingClientRect();

      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setRoutePoints((prev) => [...prev, { x, y }]);
      return;
    }

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
    setSelectedPin(pin);
    setSelectedRoute(null);
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

        const updatedPin = {
          ...editingPin,
          name: form.name.trim(),
          typeName: finalTypeName,
          description: form.description.trim(),
          icon: form.icon,
          iconType: form.iconType,
          iconImageUrl: form.iconImageUrl,
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
    if (!isDrawingRoute || routePoints.length === 0) return;

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
    setSelectedRoute(route);
    setSelectedPin(null);

    setEditingRouteData({
      name: route.name,
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
    if (!type.pinTypeId) {
      alert("Esta categoria ainda não tem ID editável.");
      return;
    }

    const confirmDelete = confirm("Deletar esta categoria e todos os pins dela?");
    if (!confirmDelete) return;

    const response = await fetch(`/api/pin-types/${type.pinTypeId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao deletar categoria.");
      return;
    }

    setPinTypes((prev) =>
      prev.filter((pinType) => pinType._id !== type.pinTypeId)
    );

    setPins((prev) => prev.filter((pin) => getPinIconKey(pin) !== type.iconKey));
    setHiddenPinTypes((prev) => prev.filter((key) => key !== type.key));

    setExpandedManageItem(null);
    setRenameMode(false);
    setRenameValue("");
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
          <p>Clique no mapa para adicionar pins.</p>
        </div>

        <div className="topbarActions">
          <span>{pins.length} pins</span>

          <Link className="backLink" href="/">
            Dashboard
          </Link>

          <button
            className={isAddingPin ? "activeAddButton" : "addButton"}
            onClick={() => {
              setIsAddingPin((prev) => !prev);
              setIsDrawingRoute(false);
            }}
          >
            {isAddingPin ? "Clique no mapa..." : "Adicionar pin"}
          </button>

          <button
            className={isDrawingRoute ? "activeAddButton" : "addButton"}
            onClick={startRouteMode}
          >
            {isDrawingRoute ? "Desenhando rota..." : "Adicionar rota"}
          </button>

          <button onClick={copyPublicLink}>Copiar link</button>
          <button onClick={clearPins}>Limpar pins</button>

          <select
            className="filterSelect"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Todas categorias</option>
            {pinCategories.length > 0
              ? pinCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))
              : CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
          </select>

          <button onClick={() => setRouteEffectsEnabled((prev) => !prev)}>
            {routeEffectsEnabled ? "Efeitos ON" : "Efeitos OFF"}
          </button>
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
                <div
                  className={
                    isDrawingRoute
                      ? "imageWrapper drawingRoute"
                      : isAddingPin
                      ? "imageWrapper addingPin"
                      : "imageWrapper"
                  }
                  onClick={handleMapClick}
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
                            .map((point) => `${point.x},${point.y}`)
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

      {isDrawingRoute && (
        <div className="routePanel">
          <h3>Nova rota</h3>

          <input
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            placeholder="Nome da rota"
          />

          <label>
            Cor
            <input
              type="color"
              value={routeColor}
              onChange={(event) => setRouteColor(event.target.value)}
            />
          </label>

          <label>
            Espessura
            <input
              type="range"
              min="2"
              max="10"
              value={routeWidth}
              onChange={(event) => setRouteWidth(Number(event.target.value))}
            />
          </label>

          <p>{routePoints.length} ponto(s)</p>

          <p className="routeHint">
            Clique no mapa para adicionar pontos
            <br />
            Enter = salvar • Esc = cancelar
          </p>

          <div className="routePanelActions">
            <button onClick={undoLastPoint} disabled={routePoints.length === 0}>
              Desfazer
            </button>

            <button
              onClick={clearRoutePoints}
              disabled={routePoints.length === 0}
            >
              Limpar
            </button>
          </div>

          <div className="routePanelActions">
            <button onClick={saveRoute}>Salvar</button>
            <button onClick={cancelRouteMode}>Cancelar</button>
          </div>
        </div>
      )}

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

                  <button
                    className="danger"
                    onClick={() => deleteRoute(route._id)}
                  >
                    Del
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRoute && (
        <div className="popup">
          <button
            className="closeButton"
            onClick={() => {
              setSelectedRoute(null);
              setIsEditingRoute(false);
            }}
          >
            ×
          </button>

          {isEditingRoute ? (
            <>
              <input
                value={editingRouteData.name}
                onChange={(event) =>
                  setEditingRouteData((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Nome da rota"
              />

              <label>
                Cor
                <input
                  type="color"
                  value={editingRouteData.color}
                  onChange={(event) =>
                    setEditingRouteData((prev) => ({
                      ...prev,
                      color: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Espessura
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={editingRouteData.width}
                  onChange={(event) =>
                    setEditingRouteData((prev) => ({
                      ...prev,
                      width: Number(event.target.value),
                    }))
                  }
                />
              </label>

              <div className="popupActions">
                <button onClick={updateRoute}>Salvar</button>
              </div>
            </>
          ) : (
            <>
              <h2>{selectedRoute.name}</h2>

              <p className="emptyText">
                {selectedRoute.points.length} pontos
              </p>

              <div className="popupActions">
                <button onClick={() => setIsEditingRoute(true)}>Editar</button>

                <button
                  className="danger"
                  onClick={() => deleteRoute(selectedRoute._id)}
                >
                  Deletar
                </button>
              </div>
            </>
          )}
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
              (category) =>
                category.value === (selectedPin.category || "geral")
            )?.label || "Geral"}
          </div>

          <div className="pinCategory">
            Categoria: {selectedPin.typeName || selectedPin.name}
          </div>

          <div className="coords">
            X: {selectedPin.x.toFixed(2)}% | Y: {selectedPin.y.toFixed(2)}%
          </div>

          <div className="popupActions">
            <button onClick={() => openEditModal(selectedPin)}>Editar</button>

            <button
              className="danger"
              onClick={() => deletePin(selectedPin._id)}
            >
              Deletar
            </button>
          </div>
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
                  <h2>Gerenciar</h2>
                  <p>Edite grupos e categorias compartilhados entre os mapas.</p>
                </div>

                <button className="closeButton" onClick={closeManageGroupsModal}>
                  ×
                </button>
              </div>

              <button
                className="primary manageAddGroupButton"
                onClick={() => {
                  setCreateMode(createMode === "group" ? null : "group");
                  setCreateValue("");
                  setExpandedManageItem(null);
                  setRenameMode(false);
                  setMoveMode(false);
                }}
              >
                + Grupo
              </button>
            </div>

            {createMode === "group" && (
              <div className="manageCreateBox">
                <input
                  value={createValue}
                  onChange={(event) => setCreateValue(event.target.value)}
                  placeholder="Nome do novo grupo"
                  autoFocus
                />

                <button className="primary" onClick={createGroup}>
                  Criar
                </button>

                <button
                  className="secondary"
                  onClick={() => {
                    setCreateMode(null);
                    setCreateValue("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}

            <div className="manageGroupsList">
              {pinGroups.length === 0 ? (
                <p className="emptyText">Nenhum grupo encontrado.</p>
              ) : (
                pinGroups.map((group) => (
                  <div className="manageGroupBlock" key={group.value}>
                    <button
                      className="manageGroupHeader"
                      onClick={() => {
                        const isSameItem =
                          expandedManageItem?.kind === "group" &&
                          expandedManageItem?.value === group.value;

                        if (isSameItem) {
                          setExpandedManageItem(null);
                          setRenameMode(false);
                          setRenameValue("");
                          setMoveMode(false);
                          return;
                        }

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
                                Salvar
                              </button>

                              <button
                                className="secondary"
                                onClick={() => {
                                  setRenameMode(false);
                                  setRenameValue(group.label);
                                }}
                              >
                                Cancelar
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
                                Renomear
                              </button>

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "up")}
                                title="Subir"
                              >
                                ↑
                              </button>

                              <button
                                className="secondary iconButton"
                                onClick={() => moveGroup(group, "down")}
                                title="Descer"
                              >
                                ↓
                              </button>

                              <button
                                className="danger"
                                onClick={() => deleteGroup(group)}
                              >
                                Deletar
                              </button>
                            </>
                          )}
                        </div>
                      )}

                    <div className="manageAddCategoryRow">
                      <button
                        className="secondary"
                        onClick={() => {
                          const modeKey = `category:${group.value}`;

                          setCreateMode(createMode === modeKey ? null : modeKey);
                          setCreateValue("");
                          setCreateCategoryIcon("📍");
                          setExpandedManageItem(null);
                          setRenameMode(false);
                          setMoveMode(false);
                        }}
                      >
                        + Categoria
                      </button>
                    </div>

                    {createMode === `category:${group.value}` && (
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
                          placeholder="Nome da nova categoria"
                          autoFocus
                        />

                        <button
                          className="primary"
                          onClick={() => createCategoryInsideGroup(group)}
                        >
                          Criar
                        </button>

                        <button
                          className="secondary"
                          onClick={() => {
                            setCreateMode(null);
                            setCreateValue("");
                            setCreateCategoryIcon("📍");
                          }}
                        >
                          Cancelar
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
                                        Salvar
                                      </button>

                                      <button
                                        className="secondary"
                                        onClick={() => setMoveMode(false)}
                                      >
                                        Cancelar
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
                                        Salvar
                                      </button>

                                      <button
                                        className="secondary"
                                        onClick={() => {
                                          setRenameMode(false);
                                          setRenameValue(type.label);
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        className="primary"
                                        onClick={() => {
                                          setRenameMode(true);
                                          setRenameValue(type.label);
                                          setMoveMode(false);
                                        }}
                                      >
                                        Renomear
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
                                        Mover
                                      </button>

                                      <button
                                        className="danger"
                                        onClick={() => deleteCategory(type)}
                                      >
                                        Deletar
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

      {iconPickerOpen && (
        <div className="modalOverlay" onClick={() => setIconPickerOpen(false)}>
          <div className="modal iconPickerModal" onClick={(e) => e.stopPropagation()}>
            <div className="manageGroupsHeader">
              <div>
                <h2>Escolher ícone</h2>
                <p>Ícones já usados em categorias ficam bloqueados.</p>
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
                Padrões
              </button>

              <button
                className={iconPickerTab === "custom" ? "selectedToggle" : ""}
                onClick={() => setIconPickerTab("custom")}
              >
                Customizados
              </button>
            </div>

            {iconPickerTab === "default" ? (
              <div className="iconPickerGrid">
                {ICONS.map((icon) => {
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

                        setCreateCategoryIconType("emoji");
                        setCreateCategoryIcon(icon);
                        setCreateCategoryIconImageUrl("");
                        setIconPickerOpen(false);
                      }}
                      title={used ? "Este ícone já está em uso" : icon}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="iconPickerGrid">
                {assets.length === 0 ? (
                  <p className="emptyText">Nenhum ícone customizado neste grupo.</p>
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

                          setCreateCategoryIconType("custom");
                          setCreateCategoryIconImageUrl(asset.imageUrl);
                          setCreateCategoryIcon("📍");
                          setIconPickerOpen(false);
                        }}
                        title={used ? "Este ícone já está em uso" : asset.name}
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

            <div className="pinFormGrid">
              <label className="pinFormField">
                Grupo
                <select
                  value={form.category}
                  onChange={(event) => {
                    const nextCategory = event.target.value;

                    setForm((prev) => ({
                      ...prev,
                      category: nextCategory,
                      typeName: "",
                      icon: "📍",
                      iconType: "emoji",
                      iconImageUrl: "",
                    }));
                  }}
                >
                  {pinCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pinFormField">
                Categoria
                <select
                  value={
                    pinTypes.find(
                      (type) =>
                        type.typeName === form.typeName &&
                        (type.category || "geral") === form.category
                    )?._id || ""
                  }
                  onChange={(event) => applyExistingPinType(event.target.value)}
                >
                  <option value="">Selecione uma categoria</option>

                  {pinTypes
                    .filter((type) => (type.category || "geral") === form.category)
                    .sort((a, b) =>
                      a.typeName.localeCompare(b.typeName, "pt-BR", {
                        sensitivity: "base",
                      })
                    )
                    .map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.iconType === "custom" ? "🖼️" : type.icon || "📍"}{" "}
                        {type.typeName}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {form.typeName && (
              <div className="assetPreview">
                {form.iconType === "custom" && form.iconImageUrl ? (
                  <img src={form.iconImageUrl} alt={form.typeName} />
                ) : (
                  <strong style={{ fontSize: "32px" }}>{form.icon || "📍"}</strong>
                )}

                <strong>{form.typeName}</strong>
              </div>
            )}

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