export const FREE_ACCOUNT_LIMITS = {
  maps: 3,
  customIcons: 10,
};

export const SUPPORTER_ACCOUNT_LIMITS = {
  maps: 10,
  customIcons: 50,
};

function readSlotBonus(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function isSupporterAccount(account) {
  return (
    account?.supporter === true ||
    account?.isSupporter === true ||
    account?.supporterStatus === "active"
  );
}

export function getAccountLimits(account) {
  const baseLimits = isSupporterAccount(account)
    ? SUPPORTER_ACCOUNT_LIMITS
    : FREE_ACCOUNT_LIMITS;

  return {
    maps: baseLimits.maps + readSlotBonus(account?.mapSlotBonus),
    customIcons:
      baseLimits.customIcons + readSlotBonus(account?.customIconSlotBonus),
  };
}
