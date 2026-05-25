export function stripPrivateAccountFields(record) {
  if (!record) return record;

  const {
    email,
    ownerEmail,
    ownerUserId,
    userEmail,
    userId,
    provider_user_id,
    providerUserId,
    ...publicRecord
  } = record;

  return publicRecord;
}
