export function getOwnerConditions(session) {
  const conditions = [];

  if (session?.user?.userId) {
    conditions.push({ ownerUserId: session.user.userId });
    return conditions;
  }

  if (session?.user?.email) {
    conditions.push({ ownerEmail: session.user.email });
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
    return document.ownerUserId === session.user.userId;
  }

  if (session.user.userId) {
    return false;
  }

  return Boolean(document.ownerEmail && document.ownerEmail === session.user.email);
}
