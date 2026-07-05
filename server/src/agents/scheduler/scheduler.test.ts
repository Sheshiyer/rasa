import { describe, it, expect } from "vitest";
import type { Macros, PlanEntry, PreferenceProfile } from "@rasa/shared";
import {
  createScheduler,
  type DueEntry,
  type DueEntrySource,
  type SchedulerExecutor,
} from "./scheduler";

const MACROS: Macros = { cal: 500, protein_g: 30, carb_g: 40, fat_g: 15 };

function profile(): PreferenceProfile {
  return {
    user_id: "11111111-1111-1111-1111-111111111111",
    diet_type: "nonveg",
    cuisines_like: [],
    cuisines_avoid: [],
    allergens: [],
    dislikes: [],
    spice_level: "medium",
    meals_per_day: 2,
    slots: [{ name: "lunch", window: "12:30-13:30" }],
    budget_monthly_inr: 9000,
    calorie_target: 2000,
    macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
    variety_tolerance: "medium",
    source_prefs: ["swiggy"],
  };
}

function entry(slot: string): PlanEntry {
  return {
    day: "2026-07-06",
    slot,
    chosen: {
      source: "swiggy",
      restaurant_id: "r",
      restaurant_name: "R",
      dish_id: `d-${slot}`,
      dish_name: slot,
      price_inr: 140,
      is_veg: false,
      deliverable_to_address: true,
      macros: MACROS,
      macro_confidence: "high",
    },
    fallbacks: [],
    slot_budget_inr: 150,
    projected_macros: MACROS,
    slot_state: "pending",
  };
}

describe("Scheduler", () => {
  it("processes each due slot exactly once and returns its outcome", async () => {
    const calls: Array<{ planId: string; slot: string }> = [];
    const executor: SchedulerExecutor = {
      async executeSlot(_p, planId, e) {
        calls.push({ planId, slot: e.slot });
        return { outcome: "ordered", orderId: "x", dishId: e.chosen.dish_id };
      },
    };
    const due: DueEntry[] = [
      { profile: profile(), planId: "plan-1", entry: entry("lunch") },
      { profile: profile(), planId: "plan-1", entry: entry("dinner") },
    ];
    const source: DueEntrySource = {
      async due() {
        return due;
      },
    };
    const outcomes = await createScheduler({ source, executor }).tick(
      "2026-07-06T12:00:00Z",
    );
    expect(calls).toHaveLength(2);
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((o) => o.outcome.outcome === "ordered")).toBe(true);
  });

  it("does nothing when no slots are due", async () => {
    const executor: SchedulerExecutor = {
      async executeSlot() {
        throw new Error("executor should not run when nothing is due");
      },
    };
    const source: DueEntrySource = {
      async due() {
        return [];
      },
    };
    const outcomes = await createScheduler({ source, executor }).tick(
      "2026-07-06T12:00:00Z",
    );
    expect(outcomes).toHaveLength(0);
  });
});
