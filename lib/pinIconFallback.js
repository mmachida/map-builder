import { ObjectId } from "mongodb";
import {
  DEFAULT_PIN_ICON_FILES,
  DEFAULT_PIN_ICON_URL,
} from "@/lib/constants/icons";

const DEFAULT_PIN_ICON_FILE_SET = new Set(DEFAULT_PIN_ICON_FILES);

function getFallbackIconKey(pinTypeId) {
  return `custom:${DEFAULT_PIN_ICON_URL}:${pinTypeId}`;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getIconReferenceConditions(imageUrl) {
  const customIconKey = `custom:${imageUrl}`;
  const escapedImageUrl = escapeRegExp(imageUrl);

  return [
    { iconImageUrl: imageUrl },
    { iconKey: customIconKey },
    { key: customIconKey },
    { iconImageUrl: { $regex: escapedImageUrl } },
    { iconKey: { $regex: escapedImageUrl } },
    { key: { $regex: escapedImageUrl } },
  ];
}

function getChainReferenceConditions(imageUrl) {
  const customIconKey = `custom:${imageUrl}`;
  const escapedImageUrl = escapeRegExp(imageUrl);

  return [
    { "chainRequirements.iconImageUrl": imageUrl },
    { "chainRequirements.iconKey": customIconKey },
    { "chainRequirements.key": customIconKey },
    { "chainRequirements.iconImageUrl": { $regex: escapedImageUrl } },
    { "chainRequirements.iconKey": { $regex: escapedImageUrl } },
    { "chainRequirements.key": { $regex: escapedImageUrl } },
  ];
}

function getGroupIdValues(groupId) {
  if (!groupId) return [];

  const values = [groupId];

  if (typeof groupId === "string" && ObjectId.isValid(groupId)) {
    values.push(new ObjectId(groupId));
  }

  return values;
}

function addGroupIdFilter(query, groupId) {
  const groupIdValues = getGroupIdValues(groupId);

  if (groupIdValues.length > 0) {
    query.groupId = { $in: groupIdValues };
  }

  return query;
}

function getCustomIconUrl(record) {
  if (record?.iconImageUrl) return record.iconImageUrl;

  const iconKey = String(record?.iconKey || record?.key || "");

  return iconKey.startsWith("custom:") ? iconKey.slice("custom:".length) : "";
}

function isDefaultPinIconUrl(iconUrl) {
  const value = String(iconUrl || "");
  const marker = value.includes("/api/pin-icons/")
    ? "/api/pin-icons/"
    : "/pin-icons/";
  const markerIndex = value.indexOf(marker);

  if (markerIndex === -1) return false;

  const fileName = value
    .slice(markerIndex + marker.length)
    .split(/[?#]/)[0];

  return DEFAULT_PIN_ICON_FILE_SET.has(fileName);
}

function isLinkedCustomIcon(record, linkedIconUrls) {
  const customIconUrl = getCustomIconUrl(record);

  if (!customIconUrl) return true;
  if (isDefaultPinIconUrl(customIconUrl)) return true;

  return linkedIconUrls.has(customIconUrl);
}

function withPlaceholderIcon(record, fallbackIconKey) {
  return {
    ...record,
    iconType: "custom",
    icon: "",
    iconImageUrl: DEFAULT_PIN_ICON_URL,
    iconKey: fallbackIconKey || `custom:${DEFAULT_PIN_ICON_URL}`,
  };
}

export async function getLinkedCustomIconUrls(db, groupId) {
  if (!groupId) return new Set();
  const groupIdValues = getGroupIdValues(groupId);

  const assets = await db
    .collection("assets")
    .find(
      { linkedGroupIds: { $in: groupIdValues } },
      { projection: { imageUrl: 1 } }
    )
    .toArray();

  return new Set(assets.map((asset) => asset.imageUrl).filter(Boolean));
}

export function sanitizePinTypesForLinkedAssets(pinTypes, linkedIconUrls) {
  return pinTypes.map((pinType) => {
    if (isLinkedCustomIcon(pinType, linkedIconUrls)) return pinType;

    return withPlaceholderIcon(
      pinType,
      getFallbackIconKey(pinType._id?.toString?.() || pinType._id || pinType.typeName)
    );
  });
}

export function sanitizePinsForLinkedAssets(pins, linkedIconUrls) {
  return pins.map((pin) => {
    const nextPin = isLinkedCustomIcon(pin, linkedIconUrls)
      ? { ...pin }
      : withPlaceholderIcon(pin, "");

    if (Array.isArray(nextPin.chainRequirements)) {
      nextPin.chainRequirements = nextPin.chainRequirements.map((requirement) =>
        isLinkedCustomIcon(requirement, linkedIconUrls)
          ? requirement
          : withPlaceholderIcon(requirement, "")
      );
    }

    return nextPin;
  });
}

async function updateChainRequirements({
  db,
  groupId,
  category,
  typeName,
  field,
  value,
  fallbackIconKey,
  unsetIconKey = false,
}) {
  const query = {
    [`chainRequirements.${field}`]: value,
  };
  addGroupIdFilter(query, groupId);
  const arrayFilter = {
    [`requirement.${field}`]: value,
  };

  if (category) {
    query["chainRequirements.category"] = category;
    arrayFilter["requirement.category"] = category;
  }

  if (typeName) {
    query["chainRequirements.typeName"] = typeName;
    arrayFilter["requirement.typeName"] = typeName;
  }

  const update = {
    $set: {
      "chainRequirements.$[requirement].iconType": "custom",
      "chainRequirements.$[requirement].icon": "",
      "chainRequirements.$[requirement].iconImageUrl": DEFAULT_PIN_ICON_URL,
      updatedAt: new Date(),
    },
  };

  if (fallbackIconKey) {
    update.$set["chainRequirements.$[requirement].iconKey"] = fallbackIconKey;
  }

  if (unsetIconKey) {
    update.$unset = {
      "chainRequirements.$[requirement].iconKey": "",
    };
  }

  await db.collection("pins").updateMany(query, update, {
    arrayFilters: [arrayFilter],
  });
}

async function deletePinsAndChainReferences({ db, groupId, pinQuery }) {
  const pinsToDelete = await db
    .collection("pins")
    .find(pinQuery, { projection: { _id: 1 } })
    .toArray();
  const deletedPinIds = pinsToDelete.map((pin) => pin._id.toString());

  if (deletedPinIds.length > 0) {
    const chainQuery = {
      "chainRequirements.pinId": { $in: deletedPinIds },
    };
    addGroupIdFilter(chainQuery, groupId);

    await db.collection("pins").updateMany(chainQuery, {
      $pull: {
        chainRequirements: { pinId: { $in: deletedPinIds } },
      },
      $set: {
        updatedAt: new Date(),
      },
    });

    await db.collection("pins").deleteMany({
      _id: { $in: pinsToDelete.map((pin) => pin._id) },
    });
  }
}

async function deletePinTypeChains({ db, groupId, pinType }) {
  const query = {
    chainRequirements: {
      $elemMatch: {
        $or: [
          { iconKey: pinType.iconKey },
          {
            category: pinType.category || "geral",
            typeName: pinType.typeName,
          },
        ],
      },
    },
  };
  addGroupIdFilter(query, pinType.groupId || groupId);

  await db.collection("pins").updateMany(
    query,
    {
      $pull: {
        chainRequirements: {
          $or: [
            { iconKey: pinType.iconKey },
            {
              category: pinType.category || "geral",
              typeName: pinType.typeName,
            },
          ],
        },
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );
}

export async function replaceCustomAssetIconReferences({
  db,
  ownerEmail,
  imageUrl,
  groupId,
  deletePins = false,
}) {
  const customIconKey = `custom:${imageUrl}`;
  const imageUrlRegex = new RegExp(escapeRegExp(imageUrl));
  const pinTypeQuery = {
    $or: getIconReferenceConditions(imageUrl),
  };

  addGroupIdFilter(pinTypeQuery, groupId);

  const affectedPinTypes = await db.collection("pinTypes").find(pinTypeQuery).toArray();

  for (const pinType of affectedPinTypes) {
    const fallbackIconKey = getFallbackIconKey(pinType._id.toString());
    const pinTypeGroupId = pinType.groupId || groupId || "";
    const pinTypePinsQuery = {
      category: pinType.category || "geral",
      typeName: pinType.typeName,
    };
    addGroupIdFilter(pinTypePinsQuery, pinTypeGroupId);
    const pinQuery = {
      category: pinType.category || "geral",
      typeName: pinType.typeName,
      $or: getIconReferenceConditions(imageUrl),
    };
    addGroupIdFilter(pinQuery, pinTypeGroupId);

    const canDeletePinType = deletePins && !pinType.systemLocked && !pinType.systemType;

    if (canDeletePinType) {
      await deletePinTypeChains({
        db,
        groupId: pinTypeGroupId,
        pinType,
      });
      await deletePinsAndChainReferences({
        db,
        groupId: pinTypeGroupId,
        pinQuery: pinTypePinsQuery,
      });
      await db.collection("pinTypes").deleteOne({ _id: pinType._id });
      continue;
    }

    if (deletePins) {
      await deletePinsAndChainReferences({
        db,
        groupId: pinTypeGroupId,
        pinQuery: pinTypePinsQuery,
      });
    } else {
      await db.collection("pins").updateMany(pinQuery, {
        $set: {
          iconType: "custom",
          icon: "",
          iconImageUrl: DEFAULT_PIN_ICON_URL,
          iconKey: fallbackIconKey,
          updatedAt: new Date(),
        },
      });
    }

    await db.collection("pinTypes").updateOne(
      { _id: pinType._id },
      {
        $set: {
          iconType: "custom",
          icon: "",
          iconImageUrl: DEFAULT_PIN_ICON_URL,
          iconKey: fallbackIconKey,
          updatedAt: new Date(),
        },
      }
    );

    const chainBase = {
      db,
      groupId: pinType.groupId || "",
      category: pinType.category || "geral",
      typeName: pinType.typeName,
      fallbackIconKey,
    };

    await updateChainRequirements({
      ...chainBase,
      field: "iconImageUrl",
      value: imageUrl,
    });
    await updateChainRequirements({
      ...chainBase,
      field: "iconKey",
      value: customIconKey,
    });
    await updateChainRequirements({
      ...chainBase,
      field: "key",
      value: customIconKey,
    });

    await db.collection("pins").updateMany(
      addGroupIdFilter(
        {
          "chainRequirements.category": pinType.category || "geral",
          "chainRequirements.typeName": pinType.typeName,
          $or: getChainReferenceConditions(imageUrl),
        },
        pinType.groupId || groupId || ""
      ),
      {
        $set: {
          "chainRequirements.$[requirement].iconType": "custom",
          "chainRequirements.$[requirement].icon": "",
          "chainRequirements.$[requirement].iconImageUrl": DEFAULT_PIN_ICON_URL,
          "chainRequirements.$[requirement].iconKey": fallbackIconKey,
          updatedAt: new Date(),
        },
      },
      {
        arrayFilters: [
          {
            "requirement.category": pinType.category || "geral",
            "requirement.typeName": pinType.typeName,
          },
        ],
      }
    );
  }

  const remainingPinReferenceQuery = addGroupIdFilter({
      $or: getIconReferenceConditions(imageUrl),
    },
    groupId
  );

  if (deletePins) {
    await deletePinsAndChainReferences({
      db,
      groupId,
      pinQuery: remainingPinReferenceQuery,
    });
  } else {
    await db.collection("pins").updateMany(remainingPinReferenceQuery, {
      $set: {
        iconType: "custom",
        icon: "",
        iconImageUrl: DEFAULT_PIN_ICON_URL,
        updatedAt: new Date(),
      },
      $unset: {
        iconKey: "",
      },
    });
  }

  await updateChainRequirements({
    db,
    groupId,
    field: "iconImageUrl",
    value: imageUrl,
    unsetIconKey: true,
  });
  await updateChainRequirements({
    db,
    groupId,
    field: "iconKey",
    value: customIconKey,
    unsetIconKey: true,
  });
  await updateChainRequirements({
    db,
    groupId,
    field: "key",
    value: customIconKey,
    unsetIconKey: true,
  });
  await updateChainRequirements({
    db,
    groupId,
    field: "iconImageUrl",
    value: imageUrlRegex,
    unsetIconKey: true,
  });
  await updateChainRequirements({
    db,
    groupId,
    field: "iconKey",
    value: imageUrlRegex,
    unsetIconKey: true,
  });
  await updateChainRequirements({
    db,
    groupId,
    field: "key",
    value: imageUrlRegex,
    unsetIconKey: true,
  });
}
