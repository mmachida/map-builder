"use client";

export default function PinSidebarContent({
  title,
  subtitle,
  pinGroups,
  hiddenPinTypes,
  hideEmptyGroups,
  search,
  canManage = false,
  manageDisabled = false,
  emptyText = "Nenhum grupo encontrado.",
  labels = {},
  onSearchChange,
  onShowAll,
  onHideAll,
  onToggleHideEmpty,
  onManage,
  onToggleCategoryVisibility,
  onTogglePinTypeVisibility,
}) {
  const text = {
    showAll: "Show All",
    hideAll: "Hide All",
    hideEmpty: "Hide Empty",
    search: "Search...",
    manage: "Gerenciar Grupo | Categoria",
    ...labels,
  };

  return (
    <>
      <div className="sidebarHeader">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="sidebarActions">
        <button onClick={onShowAll}>{text.showAll}</button>
        <button onClick={onHideAll}>{text.hideAll}</button>

        <button
          className={
            hideEmptyGroups
              ? "sidebarActionButton activeHidden"
              : "sidebarActionButton"
          }
          onClick={onToggleHideEmpty}
        >
          {text.hideEmpty}
        </button>
      </div>

      <div className="sidebarSearch">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={text.search}
        />
      </div>

      {canManage && (
        <button
          disabled={manageDisabled}
          className="sidebarEditButton"
          onClick={onManage}
        >
          {text.manage}
        </button>
      )}

      {pinGroups.length === 0 ? (
        <div className="sidebarPlaceholder">{emptyText}</div>
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
                  onClick={() => onToggleCategoryVisibility(category)}
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
                        onClick={() => onTogglePinTypeVisibility(type.key)}
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
  );
}
