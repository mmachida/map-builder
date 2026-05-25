export function getOwnerConditions(session) {
  const conditions = [];

  if (session?.user?.userId) {
    conditions.push({ ownerUserId: session.user.userId });
  }

  if (session?.user?.username) {
    conditions.push({ ownerUsername: session.user.username });
    conditions.push({ ownerName: session.user.username });
  }

  return conditions;
}

export function getOwnerQuery(session) {
  const conditions = getOwnerConditions(session);

  if (conditions.length === 0) {
    return { _id: null };
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { $or: conditions };
}

export function isOwnerDocument(document, session) {
  if (!document || !session?.user) {
    return false;
  }

  if (document.ownerUserId && session.user.userId) {
    if (document.ownerUserId === session.user.userId) {
      return true;
    }
  }

  if (session.user.username) {
    if (document.ownerUsername === session.user.username) {
      return true;
    }

    if (document.ownerName === session.user.username) {
      return true;
    }
  }

  return false;
}
