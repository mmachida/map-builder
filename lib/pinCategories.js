import { PORTAL_PIN_ICON_URL } from "@/lib/constants/icons";

export const SYSTEM_PIN_CATEGORY = {
  value: "system",
  label: "System",
  sortOrder: -100,
};

export const PORTAL_PIN_TYPE = {
  typeName: "Portal",
  category: SYSTEM_PIN_CATEGORY.value,
  icon: "",
  iconType: "custom",
  iconImageUrl: PORTAL_PIN_ICON_URL,
  iconKey: `custom:${PORTAL_PIN_ICON_URL}`,
  backgroundColor: "#0f1014",
  systemType: "portal",
};

export async function ensureDefaultPinCategory(db, groupId, session) {
  if (!groupId) return null;

  const existing = await db.collection("pinCategories").findOne({
    groupId,
    value: "geral",
  });

  const now = new Date();
  const ownerFields = {
    ownerEmail: session?.user?.email || null,
    ownerUserId: session?.user?.userId || null,
    ownerUsername: session?.user?.username || "USER",
    ownerName: session?.user?.username || "USER",
  };

  await db.collection("pinCategories").updateOne(
    {
      groupId,
      value: SYSTEM_PIN_CATEGORY.value,
    },
    {
      $setOnInsert: {
        groupId,
        ...ownerFields,
        value: SYSTEM_PIN_CATEGORY.value,
        sortOrder: SYSTEM_PIN_CATEGORY.sortOrder,
        createdAt: now,
      },
      $set: {
        label: SYSTEM_PIN_CATEGORY.label,
        systemLocked: true,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  const existingPortal = await db.collection("pinTypes").findOne({
    groupId,
    $or: [
      { systemType: PORTAL_PIN_TYPE.systemType },
      {
        category: PORTAL_PIN_TYPE.category,
        typeName: PORTAL_PIN_TYPE.typeName,
      },
      { iconKey: PORTAL_PIN_TYPE.iconKey },
    ],
  });

  if (existingPortal) {
    await db.collection("pinTypes").updateOne(
      { _id: existingPortal._id },
      {
        $set: {
          typeName: PORTAL_PIN_TYPE.typeName,
          category: PORTAL_PIN_TYPE.category,
          icon: PORTAL_PIN_TYPE.icon,
          iconType: PORTAL_PIN_TYPE.iconType,
          iconImageUrl: PORTAL_PIN_TYPE.iconImageUrl,
          iconKey: PORTAL_PIN_TYPE.iconKey,
          systemType: PORTAL_PIN_TYPE.systemType,
          systemLocked: true,
          updatedAt: now,
        },
      }
    );
  } else {
    await db.collection("pinTypes").insertOne({
      groupId,
      ...ownerFields,
      ...PORTAL_PIN_TYPE,
      systemLocked: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (existing) return existing;

  const defaultCategory = {
    groupId,
    ...ownerFields,
    value: "geral",
    label: "Geral",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("pinCategories").insertOne(defaultCategory);

  return {
    ...defaultCategory,
    _id: result.insertedId,
  };
}
