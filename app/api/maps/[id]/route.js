import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/auth";
import { normalizeUsername } from "@/lib/accounts";
import { getOwnerQuery, isOwnerDocument } from "@/lib/ownership";
import { getMapAccess } from "@/lib/mapPermissions";
import { stripPrivateAccountFields } from "@/lib/publicData";
import { deleteMapStorage } from "@/lib/r2Storage";

const EDITOR_PERMISSIONS = ["", "fullAccess", "pinEditor", "routeEditor"];
const MAP_VISIBILITIES = ["public", "notListed", "private"];

function normalizeMapVisibility(value, fallback = "public") {
  return MAP_VISIBILITIES.includes(value) ? value : fallback;
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invÃ¡lido." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({
      _id: new ObjectId(id),
    });

    if (!map) {
      return Response.json(
        { error: "Mapa nÃ£o encontrado." },
        { status: 404 }
      );
    }

    const isOwner = isOwnerDocument(map, session);
    const access = getMapAccess(map, session);
    const visibility = normalizeMapVisibility(map.visibility, "public");

    if (visibility === "private" && !access.canViewEditor) {
      return Response.json(
        { error: "Este mapa esta privado." },
        { status: 403 }
      );
    }

    const mapPublicData = stripPrivateAccountFields(map);

    if (isOwner && session?.user?.username) {
      mapPublicData.ownerUsername = session.user.username;
      mapPublicData.ownerName = session.user.username;
    }

    return Response.json({
      map: {
        ...mapPublicData,
        _id: map._id.toString(),
        visibility,
      },
      currentUser: session?.user
        ? {
            username: session.user.username || "USER",
            userId: session.user.userId,
            supporter: session.user.supporter === true,
          }
        : null,
      isOwner,
      access,
    });
  } catch (error) {
    console.error("ERRO GET /api/maps/[id]:", error);

    return Response.json(
      { error: error.message || "Erro ao buscar mapa." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "VocÃª precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "ID invÃ¡lido." }, { status: 400 });
    }

    const body = await request.json();
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    if (body.addEditor !== undefined) {
      const username = normalizeUsername(body.addEditor?.username || "");

      if (!username) {
        return Response.json(
          { error: "Username invalido." },
          { status: 400 }
        );
      }

      const map = await db.collection("maps").findOne({
        _id: new ObjectId(id),
        ...getOwnerQuery(session),
      });

      if (!map) {
        return Response.json(
          { error: "Mapa nao encontrado ou permissao negada." },
          { status: 404 }
        );
      }

      if (username === map.ownerUsername) {
        return Response.json(
          { error: "Owner ja esta na lista." },
          { status: 400 }
        );
      }

      const account = await db.collection("accounts").findOne(
        { username, usernameConfirmed: true },
        { projection: { _id: 0, user_id: 1, username: 1 } }
      );

      if (!account) {
        return Response.json(
          { error: "Usuario nao encontrado." },
          { status: 404 }
        );
      }

      const editors = Array.isArray(map.editors) ? map.editors : [];
      const alreadyEditor = editors.some(
        (editor) =>
          editor.username === account.username ||
          editor.userId === account.user_id ||
          editor.user_id === account.user_id
      );

      if (alreadyEditor) {
        return Response.json(
          { error: "Usuario ja e editor deste mapa." },
          { status: 400 }
        );
      }

      if (editors.length >= 1 && session.user.supporter !== true) {
        return Response.json(
          {
            error:
              "Contas gratuitas podem adicionar apenas um editor. Recurso disponivel para Supporters.",
            supporterOnly: true,
          },
          { status: 403 }
        );
      }

      const editor = {
        username: account.username,
        userId: account.user_id,
        permission: "",
        addedAt: new Date(),
      };

      await db.collection("maps").updateOne(
        { _id: new ObjectId(id), ...getOwnerQuery(session) },
        {
          $push: { editors: editor },
          $set: { updatedAt: new Date() },
        }
      );

      return Response.json({ success: true, editor });
    }

    if (body.updateEditorPermission !== undefined) {
      const username = normalizeUsername(
        body.updateEditorPermission?.username || ""
      );
      const permission = String(
        body.updateEditorPermission?.permission || ""
      );

      if (!username || !EDITOR_PERMISSIONS.includes(permission)) {
        return Response.json(
          { error: "Permissao invalida." },
          { status: 400 }
        );
      }

      const map = await db.collection("maps").findOne({
        _id: new ObjectId(id),
        ...getOwnerQuery(session),
      });

      if (!map) {
        return Response.json(
          { error: "Mapa nao encontrado ou permissao negada." },
          { status: 404 }
        );
      }

      if (username === map.ownerUsername) {
        return Response.json(
          { error: "Owner nao pode ser alterado." },
          { status: 400 }
        );
      }

      const editors = Array.isArray(map.editors) ? map.editors : [];
      const nextEditors = editors.map((editor) =>
        editor.username === username || editor.name === username
          ? {
              ...editor,
              username,
              permission,
              updatedAt: new Date(),
            }
          : editor
      );

      await db.collection("maps").updateOne(
        { _id: new ObjectId(id), ...getOwnerQuery(session) },
        {
          $set: {
            editors: nextEditors,
            updatedAt: new Date(),
          },
        }
      );

      return Response.json({ success: true });
    }

    if (body.removeEditor !== undefined) {
      const editorUserId =
        typeof body.removeEditor?.userId === "string"
          ? body.removeEditor.userId.trim()
          : "";
      const editorUsername =
        typeof body.removeEditor?.username === "string"
          ? body.removeEditor.username.trim().toLowerCase()
          : "";

      if (!editorUserId && !editorUsername) {
        return Response.json(
          { error: "Editor invalido." },
          { status: 400 }
        );
      }

      const pullConditions = [];

      if (editorUserId) {
        pullConditions.push({ userId: editorUserId }, { user_id: editorUserId });
      }

      if (editorUsername) {
        pullConditions.push(
          { username: editorUsername },
          { name: editorUsername }
        );
      }

      const removeResult = await db.collection("maps").updateOne(
        {
          _id: new ObjectId(id),
          ...getOwnerQuery(session),
        },
        {
          $pull: {
            editors:
              pullConditions.length === 1
                ? pullConditions[0]
                : { $or: pullConditions },
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      );

      if (removeResult.matchedCount === 0) {
        return Response.json(
          { error: "Mapa nao encontrado ou permissao negada." },
          { status: 404 }
        );
      }

      return Response.json({ success: true });
    }

    if (!body.title?.trim()) {
      return Response.json(
        { error: "Nome do mapa obrigatÃ³rio." },
        { status: 400 }
      );
    }

    const updateFields = {
      title: body.title.trim(),
      updatedAt: new Date(),
    };

    if (typeof body.description === "string") {
      updateFields.description = body.description.trim();
    }

    if (typeof body.tags === "string" || Array.isArray(body.tags)) {
      const rawTags = Array.isArray(body.tags)
        ? body.tags
        : body.tags.split(",");

      updateFields.tags = rawTags
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
        .slice(0, 30);
    }

    if (body.visibility !== undefined) {
      if (!MAP_VISIBILITIES.includes(body.visibility)) {
        return Response.json(
          { error: "Visibilidade do mapa invalida." },
          { status: 400 }
        );
      }

      updateFields.visibility = body.visibility;
    }

    if (body.pinSize !== undefined) {
      const pinSize = Number(body.pinSize);

      if (!Number.isFinite(pinSize) || pinSize < 5 || pinSize > 100) {
        return Response.json(
          { error: "Tamanho dos pins invalido." },
          { status: 400 }
        );
      }

      updateFields.pinSize = pinSize;
    }

    if (body.routeSize !== undefined) {
      const routeSize = Number(body.routeSize);

      if (!Number.isFinite(routeSize) || routeSize < 5 || routeSize > 100) {
        return Response.json(
          { error: "Tamanho das rotas invalido." },
          { status: 400 }
        );
      }

      updateFields.routeSize = routeSize;
    }

    if (body.noteSize !== undefined) {
      const noteSize = Number(body.noteSize);

      if (!Number.isFinite(noteSize) || noteSize < 5 || noteSize > 100) {
        return Response.json(
          { error: "Tamanho das notas invalido." },
          { status: 400 }
        );
      }

      updateFields.noteSize = noteSize;
    }

    if (typeof body.routeEffectsEnabled === "boolean") {
      updateFields.routeEffectsEnabled = body.routeEffectsEnabled;
    }

    if (body.editorPermissions && typeof body.editorPermissions === "object") {
      const map = await db.collection("maps").findOne({
        _id: new ObjectId(id),
        ...getOwnerQuery(session),
      });

      if (!map) {
        return Response.json(
          { error: "Mapa nao encontrado ou permissao negada." },
          { status: 404 }
        );
      }

      const permissions = body.editorPermissions;
      updateFields.editors = (Array.isArray(map.editors) ? map.editors : []).map(
        (editor) => {
          const username = normalizeUsername(editor.username || editor.name || "");
          const permission = String(permissions[username] ?? editor.permission ?? "");

          return {
            ...editor,
            username,
            permission: EDITOR_PERMISSIONS.includes(permission)
              ? permission
              : "",
            updatedAt: new Date(),
          };
        }
      );
    }

    await db.collection("maps").updateOne(
      {
        _id: new ObjectId(id),
        ...getOwnerQuery(session),
      },
      {
        $set: updateFields,
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO PATCH MAP:", error);

    return Response.json(
      { error: "Erro ao editar mapa." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json(
        { error: "VocÃª precisa estar logado." },
        { status: 401 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return Response.json(
        { error: "ID invÃ¡lido." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const map = await db.collection("maps").findOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    if (!map) {
      return Response.json(
        { error: "Mapa nÃƒÂ£o encontrado." },
        { status: 404 }
      );
    }

    await deleteMapStorage(map);

    const deleteResult = await db.collection("maps").deleteOne({
      _id: new ObjectId(id),
      ...getOwnerQuery(session),
    });

    await db.collection("pins").deleteMany({
      mapId: id,
    });
	
	await db.collection("routes").deleteMany({
	  mapId: id,
	});

    return Response.json({ success: true });
  } catch (error) {
    console.error("ERRO DELETE /api/maps/[id]:", error);

    return Response.json(
      { error: error.message || "Erro ao deletar mapa." },
      { status: 500 }
    );
  }
}
