export const PAYMENT_PLANS = {
  supporter_lifetime: {
    id: "supporter_lifetime",
    label: "Supporter",
    description: "Lifetime Supporter status",
    amount: "19.99",
    currency: "BRL",
    type: "supporter",
  },
  map_slots_5: {
    id: "map_slots_5",
    label: "Map slots",
    description: "+5 permanent map slots",
    amount: "4.99",
    currency: "BRL",
    type: "mapSlots",
    quantity: 5,
  },
  custom_icon_slots_10: {
    id: "custom_icon_slots_10",
    label: "Custom icon slots",
    description: "+10 permanent custom icon slots",
    amount: "2.99",
    currency: "BRL",
    type: "customIconSlots",
    quantity: 10,
  },
};

export function getPaymentPlan(planId) {
  return PAYMENT_PLANS[String(planId || "")] || null;
}

export async function ensurePaymentIndexes(payments) {
  await Promise.all([
    payments.createIndex({ paypalOrderId: 1 }, { unique: true }),
    payments.createIndex({ userId: 1, createdAt: -1 }),
    payments.createIndex({ status: 1, createdAt: -1 }),
  ]);
}

export async function applyPurchasedPlan({ accounts, userId, plan, paidAt }) {
  const updates = { updatedAt: paidAt };

  if (plan.type === "supporter") {
    updates.supporter = true;
    updates.supporterStatus = "active";
    updates.supporterUpdatedAt = paidAt;
    updates.supporterPurchasedAt = paidAt;

    await accounts.updateOne({ user_id: userId }, { $set: updates });
    return;
  }

  if (plan.type === "mapSlots") {
    await accounts.updateOne(
      { user_id: userId },
      {
        $inc: { mapSlotBonus: plan.quantity },
        $set: updates,
      }
    );
    return;
  }

  if (plan.type === "customIconSlots") {
    await accounts.updateOne(
      { user_id: userId },
      {
        $inc: { customIconSlotBonus: plan.quantity },
        $set: updates,
      }
    );
  }
}
