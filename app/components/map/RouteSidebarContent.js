"use client";

import { useState } from "react";

export default function RouteSidebarContent({
  routes,
  filteredRoutes,
  hiddenRouteIds,
  selectedRoute,
  routeSearch,
  routeEffectsEnabled,
  canManage = false,
  manageDisabled = false,
  labels = {},
  onSearchChange,
  onShowAll,
  onHideAll,
  onToggleEffects,
  onManageRoutes,
  onExportTxtRoutes,
  onExportLivesplitRoutes,
  onSelectRoute,
  onToggleRouteVisibility,
  selectedRouteDescriptionValue,
  routeDescriptionMaxLength,
  onSelectedRouteDescriptionChange,
  onSaveSelectedRouteDescription,
  onCancelSelectedRouteDescription,
}) {
  const [activeDescriptionRouteId, setActiveDescriptionRouteId] = useState(null);
  const text = {
    title: "Rotas",
    count: "rota(s)",
    showAll: "Show All",
    hideAll: "Hide All",
    effectOn: "Effect ON",
    effectOff: "Effect OFF",
    search: "Search routes...",
    manage: "Ordenar Rotas",
    exportTxt: "Export .txt",
    exportLivesplit: "Export Livesplit",
    empty: "Nenhuma rota encontrada.",
    showRoute: "Mostrar rota",
    hideRoute: "Ocultar rota",
    noDescription: "Sem descrição.",
    ...labels,
  };
  text.save ??= "Salvar";
  text.cancel ??= "Cancelar";
  const visibleRoutes = routes.filter((route) => !hiddenRouteIds.includes(route._id));
  const exportDisabled = visibleRoutes.length === 0;

  return (
    <>
      <div className="sidebarHeader">
        <h2>{text.title}</h2>
        <p>
          {routes.length} {text.count}
        </p>
      </div>

      <div className="sidebarActions">
        <button onClick={onShowAll}>{text.showAll}</button>
        <button onClick={onHideAll}>{text.hideAll}</button>

        <button
          className={
            routeEffectsEnabled
              ? "sidebarActionButton"
              : "sidebarActionButton activeHidden"
          }
          onClick={onToggleEffects}
        >
          {routeEffectsEnabled ? text.effectOn : text.effectOff}
        </button>
      </div>

      <div className="sidebarSearch">
        <input
          value={routeSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={text.search}
        />
      </div>

      {canManage && (
        <button
          disabled={manageDisabled}
          className="sidebarEditButton"
          onClick={onManageRoutes}
        >
          {text.manage}
        </button>
      )}

      <div
        className={
          canManage
            ? "sidebarExportActions"
            : "sidebarExportActions sidebarExportActionsWithoutManage"
        }
      >
        <button
          className="sidebarEditButton sidebarHeaderAction"
          disabled={exportDisabled}
          onClick={onExportTxtRoutes}
        >
          {text.exportTxt}
        </button>

        <button
          className="sidebarEditButton sidebarHeaderAction"
          disabled={exportDisabled}
          onClick={onExportLivesplitRoutes}
        >
          {text.exportLivesplit}
        </button>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="sidebarPlaceholder">{text.empty}</div>
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
                  onClick={() => onSelectRoute(route)}
                  title={route.name}
                >
                  <span className="routeIndex">{index + 1}</span>

                  <span
                    className="routeColorDot"
                    style={{ background: route.color || "#ef4444" }}
                  />

                  <span className={isHidden ? "routeHiddenText" : ""}>
                    {route.name}
                  </span>
                </button>

                <button
                  className={isHidden ? "routeEyeButton hidden" : "routeEyeButton"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleRouteVisibility(route._id);
                  }}
                  title={isHidden ? text.showRoute : text.hideRoute}
                >
                  {isHidden ? "🙈" : "👁️"}
                </button>

                {isSelected &&
                  (onSelectedRouteDescriptionChange ? (
                    <div className="routeListDescriptionEditor">
                      <textarea
                        className="routeListDescription routeListDescriptionInput"
                        value={selectedRouteDescriptionValue ?? route.description ?? ""}
                        maxLength={routeDescriptionMaxLength}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onFocus={() => setActiveDescriptionRouteId(route._id)}
                        onChange={(event) =>
                          onSelectedRouteDescriptionChange(event.target.value)
                        }
                        placeholder={text.noDescription}
                      />

                      {activeDescriptionRouteId === route._id && (
                        <div
                          className="routeListDescriptionActions"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="routeDescriptionSaveButton"
                            onClick={() => {
                              setActiveDescriptionRouteId(null);
                              onSaveSelectedRouteDescription?.();
                            }}
                          >
                            {text.save}
                          </button>

                          <button
                            type="button"
                            className="routeDescriptionCancelButton"
                            onClick={() => {
                              setActiveDescriptionRouteId(null);
                              onCancelSelectedRouteDescription?.();
                            }}
                          >
                            {text.cancel}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="routeListDescription">
                      {route.description || text.noDescription}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
