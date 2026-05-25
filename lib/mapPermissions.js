import { ObjectId } from "mongodb";
import { isOwnerDocument } from "@/lib/ownership";

export const MAP_PERMISSIONS = {
  none: {
    canViewEditor: true,
    canEditPins: false,
    canEditRoutes: false,
    canManagePinGroups: false,
    canManageRoutes: false,
    canManageSettings: false,
    canManageEditors: false,
  },
  pinEditor: {
    canViewEditor: true,
    canEditPins: true,
    canEditRoutes: false,
    canManagePinGroups: false,
    canManageRoutes: false,
    canManageSettings: false,
    canManageEditors: false,
  },
  routeEditor: {
    canViewEditor: true,
    canEditPins: false,
    canEditRoutes: true,
    canManagePinGroups: false,
    canManageRoutes: true,
    canManageSettings: false,
    canManageEditors: false,
  },
  fullAccess: {
    canViewEditor: true,
    canEditPins: true,
    canEditRoutes: true,
    canManagePinGroups: true,
    canManageRoutes: true,
    canManageSettings: false,
    canManageEditors: false,
  },
  owner: {
    canViewEditor: true,
    canEditPins: true,
    canEditRoutes: true,
    canManagePinGroups: true,
    canManageRoutes: true,
    canManageSettings: true,
    canManageEditors: true,
  },
  public: {
    canViewEditor: false,
    canEditPins: false,
    canEditRoutes: false,
    canManagePinGroups: false,
    canManageRoutes: false,
    canManageSettings: false,
    canManageEditors: false,
  },
};

export function normalizeEditorPermission(value) {
  const permission = String(value || "").toLowerCase();

  if (["fullaccess", "full_access", "full", "editor"].includes(permission)) {
    return "fullAccess";
  }

  if (["pineditor", "pin_editor", "pin"].includes(permission)) {
    return "pinEditor";
  }

  if (["routeeditor", "route_editor", "route"].includes(permission)) {
    return "routeEditor";
  }

  return "none";
}

export function getEditorEntry(map, session) {
  const editors = Array.isArray(map?.editors) ? map.editors : [];
  const userId = session?.user?.userId;
  const username = session?.user?.username;

  return editors.find((editor) => {
    const editorUserId = editor.userId || editor.user_id;
    const editorUsername = editor.username || editor.name;

    return (
      (userId && editorUserId === userId) ||
      (username && editorUsername === username)
    );
  });
}

export function getMapAccess(map, session) {
  if (!session?.user || !map) {
    return MAP_PERMISSIONS.public;
  }

  if (isOwnerDocument(map, session)) {
    return MAP_PERMISSIONS.owner;
  }

  if (map.visibility === "private") {
    return MAP_PERMISSIONS.public;
  }

  const editor = getEditorEntry(map, session);

  if (!editor) {
    return MAP_PERMISSIONS.public;
  }

  return MAP_PERMISSIONS[normalizeEditorPermission(editor.permission)] ||
    MAP_PERMISSIONS.none;
}

export function canAccessEditor(map, session) {
  return getMapAccess(map, session).canViewEditor;
}

export async function getMapAccessById(db, mapId, session) {
  if (!ObjectId.isValid(mapId)) {
    return { map: null, access: MAP_PERMISSIONS.public };
  }

  const map = await db.collection("maps").findOne({
    _id: new ObjectId(mapId),
  });

  return {
    map,
    access: getMapAccess(map, session),
  };
}

export async function getMapAccessForGroup(db, groupId, session) {
  const maps = await db
    .collection("maps")
    .find({ groupId })
    .project({ editors: 1, ownerUserId: 1, ownerEmail: 1, ownerUsername: 1 })
    .toArray();

  const accessList = maps.map((map) => getMapAccess(map, session));

  return {
    canManagePinGroups: accessList.some((access) => access.canManagePinGroups),
    canReadGroupData: accessList.some(
      (access) => access.canViewEditor || access.canManagePinGroups
    ),
  };
}
