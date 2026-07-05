import type {
  PreferenceProfile,
  SourceAdapter,
  SpendLedgerEntry,
} from "@rasa/shared";

export interface BudgetEnvelope {
  monthly_budget_inr: number;
  window_days: number;
  per_day_cap_inr: number;
  per_slot_cap_inr: number;
  /** per_slot_cap × meals × days — guaranteed ≤ monthly_budget_inr. */
  total_planned_cap_inr: number;
}

export interface CouponPlan {
  code: string;
  discount_inr: number;
  effective_inr: number;
}

export interface BudgetAgentDeps {
  adapter: SourceAdapter;
}

/**
 * Budget / Price Agent. Splits the monthly cap into a per-slot envelope, and picks the
 * best applicable coupon to lower a slot's effective price. Cross-source arbitrage is a
 * v2 concern (activates once more than one adapter exists).
 */
export function createBudgetAgent(deps: BudgetAgentDeps) {
  /** Even split of the monthly cap across (days × meals) slots. Total is ≤ the budget. */
  function envelope(
    profile: PreferenceProfile,
    windowDays = 30,
  ): BudgetEnvelope {
    const meals = profile.meals_per_day;
    const totalSlots = windowDays * meals;
    const per_slot_cap_inr = Math.floor(
      profile.budget_monthly_inr / totalSlots,
    );
    return {
      monthly_budget_inr: profile.budget_monthly_inr,
      window_days: windowDays,
      per_day_cap_inr: per_slot_cap_inr * meals,
      per_slot_cap_inr,
      total_planned_cap_inr: per_slot_cap_inr * totalSlots,
    };
  }

  /** Best applicable coupon for a subtotal at a restaurant, or null if none qualifies. */
  async function planCoupon(
    restaurantId: string,
    subtotalInr: number,
  ): Promise<CouponPlan | null> {
    const coupons = await deps.adapter.fetchCoupons(restaurantId);
    const applicable = coupons.filter((c) => subtotalInr >= c.min_order_inr);
    if (applicable.length === 0) return null;
    const best = applicable.reduce((a, b) =>
      b.discount_inr > a.discount_inr ? b : a,
    );
    return {
      code: best.code,
      discount_inr: best.discount_inr,
      effective_inr: Math.max(0, subtotalInr - best.discount_inr),
    };
  }

  function ledgerEntry(input: {
    userId: string;
    planId: string;
    planEntryId?: string;
    day: string;
    slot: string;
    plannedInr: number;
    coupon?: CouponPlan | null;
  }): SpendLedgerEntry {
    return {
      user_id: input.userId,
      plan_id: input.planId,
      plan_entry_id: input.planEntryId,
      day: input.day,
      slot: input.slot,
      planned_inr: input.plannedInr,
      coupon_code: input.coupon?.code,
      coupon_discount_inr: input.coupon?.discount_inr ?? 0,
    };
  }

  return { envelope, planCoupon, ledgerEntry };
}
