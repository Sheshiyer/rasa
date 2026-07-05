import type {
  CandidateDish,
  GuardrailDecision,
  Macros,
  Plan,
  PlanEntry,
  PreferenceProfile,
} from "@rasa/shared";
import type { OrderAction } from "../guardrail/policy";
import type { BudgetEnvelope } from "./budget";

export interface PlanRequest {
  profile: PreferenceProfile;
  /** Macro-tagged candidates per slot (from Discovery → Nutrition). */
  candidatesBySlot: Record<string, CandidateDish[]>;
  envelope: BudgetEnvelope;
  startDate: string; // YYYY-MM-DD
  days?: number; // default 30
}

export type PlanResult =
  | { feasible: true; plan: Plan; entries: PlanEntry[]; relaxations: string[] }
  | { feasible: false; tradeoff: string };

export interface PlannerDeps {
  checkGuardrail: (
    profile: PreferenceProfile,
    action: OrderAction,
  ) => GuardrailDecision;
}

const ZERO_MACROS: Macros = { cal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

function addDays(iso: string, d: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

/**
 * Planner / Orchestrator. Composes a 30-day plan by assigning ranked candidates per
 * (day, slot). HARD constraints are never violated — allergen-unsafe dishes are removed
 * up front via the guardrail, and total spend is kept under the monthly budget by a
 * cheapest-completion lookahead. SOFT objectives (macro fit, variety) are optimized and
 * relaxed as needed. Genuine infeasibility surfaces a tradeoff instead of a broken plan.
 */
export function createPlanner(deps: PlannerDeps) {
  function safeCandidates(
    profile: PreferenceProfile,
    candidates: CandidateDish[],
  ): CandidateDish[] {
    // Only the allergen hard-block applies here (cap huge, no confirm needed) — budget
    // is handled below as a monthly total, not a per-candidate filter.
    return candidates.filter(
      (d) =>
        deps.checkGuardrail(profile, {
          dish: d,
          effective_price_inr: d.price_inr,
          slot_cap_inr: Number.MAX_SAFE_INTEGER,
          requireConfirm: false,
        }).allow,
    );
  }

  function deviation(dish: CandidateDish, target: Macros): number {
    const m = dish.macros ?? ZERO_MACROS;
    // Protein weighted higher — the health emphasis of the product.
    return (
      Math.abs(m.cal - target.cal) +
      Math.abs(m.protein_g - target.protein_g) * 4 +
      Math.abs(m.carb_g - target.carb_g) +
      Math.abs(m.fat_g - target.fat_g)
    );
  }

  function rank(
    candidates: CandidateDish[],
    target: Macros,
    slotCap: number,
  ): CandidateDish[] {
    const overCapPenalty = (d: CandidateDish) =>
      d.price_inr <= slotCap ? 0 : d.price_inr - slotCap;
    return [...candidates].sort(
      (a, b) =>
        deviation(a, target) +
        overCapPenalty(a) -
        (deviation(b, target) + overCapPenalty(b)),
    );
  }

  function plan(req: PlanRequest): PlanResult {
    const days = req.days ?? 30;
    const slots = Object.keys(req.candidatesBySlot);
    const meals = Math.max(1, slots.length);
    const slotCap = req.envelope.per_slot_cap_inr;
    const monthlyBudget = req.profile.budget_monthly_inr;

    const perSlotTarget: Macros = {
      cal: req.profile.calorie_target / meals,
      protein_g: req.profile.macro_target.protein_g / meals,
      carb_g: req.profile.macro_target.carb_g / meals,
      fat_g: req.profile.macro_target.fat_g / meals,
    };

    // Allergen-safe, ranked candidates per slot. A slot with none is a hard infeasibility.
    const ranked: Record<string, CandidateDish[]> = {};
    for (const s of slots) {
      const safe = safeCandidates(req.profile, req.candidatesBySlot[s] ?? []);
      if (safe.length === 0) {
        return {
          feasible: false,
          tradeoff: `No allergen-safe options for ${s}. Relax a dislike, remove an allergen you can tolerate, or add a delivery address with more restaurants.`,
        };
      }
      ranked[s] = rank(safe, perSlotTarget, slotCap);
    }

    // Budget hard cap: even the cheapest complete plan must fit.
    const cheapestPerSlot: Record<string, number> = {};
    for (const s of slots)
      cheapestPerSlot[s] = Math.min(...ranked[s]!.map((d) => d.price_inr));
    const cheapestDay = slots.reduce((sum, s) => sum + cheapestPerSlot[s]!, 0);
    if (cheapestDay * days > monthlyBudget) {
      return {
        feasible: false,
        tradeoff: `Budget ₹${monthlyBudget} can't cover ${meals} meals/day for ${days} days (cheapest ≈ ₹${cheapestDay}/day = ₹${cheapestDay * days}). Raise the budget, cut meals per day, or shorten the window.`,
      };
    }

    const relaxations = new Set<string>();
    const entries: PlanEntry[] = [];
    const prevChosen: Record<string, string> = {};
    let runningSpend = 0;

    for (let dIdx = 0; dIdx < days; dIdx++) {
      const day = addDays(req.startDate, dIdx);
      const daysAfter = days - dIdx - 1;
      for (let sIdx = 0; sIdx < slots.length; sIdx++) {
        const s = slots[sIdx]!;
        const pool = ranked[s]!;

        // Variety: prefer a dish different from yesterday's when an alternative exists.
        let choice = pool.find((d) => d.dish_id !== prevChosen[s]) ?? pool[0]!;
        if (pool.length === 1) relaxations.add(`variety:${s}`);

        // Budget lookahead: choosing `choice` must leave enough to complete the month at
        // cheapest. If not, downgrade this slot to its cheapest safe option.
        const laterTodayMin = slots
          .slice(sIdx + 1)
          .reduce((sum, ss) => sum + cheapestPerSlot[ss]!, 0);
        const projected =
          runningSpend +
          choice.price_inr +
          laterTodayMin +
          daysAfter * cheapestDay;
        if (projected > monthlyBudget) {
          choice = pool.reduce((a, b) => (b.price_inr < a.price_inr ? b : a));
          relaxations.add("price-envelope");
        }

        runningSpend += choice.price_inr;
        prevChosen[s] = choice.dish_id;
        entries.push({
          day,
          slot: s,
          chosen: choice,
          fallbacks: pool
            .filter((d) => d.dish_id !== choice.dish_id)
            .slice(0, 2),
          slot_budget_inr: slotCap,
          projected_macros: choice.macros ?? ZERO_MACROS,
          slot_state: "pending",
        });
      }
    }

    const planHeader: Plan = {
      user_id: req.profile.user_id,
      status: "draft",
      start_date: req.startDate,
      end_date: addDays(req.startDate, days - 1),
    };
    return {
      feasible: true,
      plan: planHeader,
      entries,
      relaxations: [...relaxations],
    };
  }

  return { plan };
}
