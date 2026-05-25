// /lib/constants/icons.js

export const DEFAULT_PIN_ICON_FILE = "default-pin.svg";
export const PORTAL_PIN_ICON_FILE = "portal.svg";
export const DEFAULT_PIN_ICON_URL = `/api/pin-icons/${DEFAULT_PIN_ICON_FILE}`;
export const PORTAL_PIN_ICON_URL = `/api/pin-icons/${PORTAL_PIN_ICON_FILE}`;

export const DEFAULT_PIN_ICON_FILES = [
  "airplane.svg",
  "apple.svg",
  "battle-axe.svg",
  "bomb.svg",
  "book-closed.svg",
  "bow-high.svg",
  "box.svg",
  "broadhead-arrow.svg",
  "cactus.svg",
  "castle.svg",
  "checked-shield.svg",
  "christmas-cold-ice.svg",
  "clock.svg",
  "cog.svg",
  "coin.svg",
  "compass.svg",
  "crossed-swords.svg",
  "cut-diamond.svg",
  "daemon-skull.svg",
  "default-pin.svg",
  "door.svg",
  "door-2.svg",
  "drop-blue.svg",
  "drop-red.svg",
  "duality-mask.svg",
  "evergreen-tree.svg",
  "fire.svg",
  "flag-red.svg",
  "fox.svg",
  "glock.svg",
  "grenade.svg",
  "heart.svg",
  "heavy-bullets.svg",
  "house.svg",
  "key.svg",
  "light-bulb.svg",
  "lightning.svg",
  "magnet.svg",
  "magnifier.svg",
  "meat-on-bone.svg",
  "money-bag.svg",
  "mushroom.svg",
  "paper-document.svg",
  "pick.svg",
  "pin.svg",
  "plant.svg",
  "polar-star.svg",
  "portal.svg",
  "puzzle-piece.svg",
  "question-mark.svg",
  "revolver.svg",
  "robot-one.svg",
  "round-star.svg",
  "rupee.svg",
  "shotgun-rounds.svg",
  "skeleton-key.svg",
  "skull-1.svg",
  "skull-2.svg",
  "skull-3.svg",
  "snake.svg",
  "sparkles.svg",
  "spyglass.svg",
  "sun.svg",
  "target.svg",
  "treasure-map.svg",
  "user.svg",
  "viking-shield.svg",
  "wolf.svg",
  "wood-axe.svg",
];

export const DEFAULT_SELECTABLE_PIN_ICON_FILES = DEFAULT_PIN_ICON_FILES.filter(
  (fileName) => fileName !== DEFAULT_PIN_ICON_FILE
);

export const DEFAULT_ICONS = DEFAULT_SELECTABLE_PIN_ICON_FILES.map((fileName) => {
  const label = fileName.replace(/\.svg$/i, "").replace(/-/g, " ");
  const iconImageUrl = `/api/pin-icons/${fileName}`;

  return {
    icon: "",
    iconType: "custom",
    iconImageUrl,
    key: `custom:${iconImageUrl}`,
    label,
  };
});
