import { describe, it, expect } from "vitest";
import type { CandidateDish, Macros } from "@rasa/shared";
import type { LlmClient } from "../../llm/client";
import type { NutritionSource } from "./nutrition-source";
import { createIndbSource } from "./indb-source";
import {
  createNutritionAgent,
  type NutritionCacheStore,
} from "./nutrition-agent";

const CANON: Record<
  string,
  { canonical_dish_id: string; dish_type: import("./portion-table").DishType }
> = {
  "Grilled Chicken Bowl": {
    canonical_dish_id: "grilled-chicken-bowl",
    dish_type: "bowl",
  },
  "Paneer Butter Masala": {
    canonical_dish_id: "paneer-butter-masala",
    dish_type: "curry",
  },
  "Dal Tadka": { canonical_dish_id: "dal-tadka", dish_type: "dal" },
  "Aloo Paratha": { canonical_dish_id: "aloo-paratha", dish_type: "paratha" },
  "Mystery Special": {
    canonical_dish_id: "mystery-special",
    dish_type: "other",
  },
};

const stubLlm: LlmClient = {
  async canonicalizeDish({ name }) {
    return (
      CANON[name] ?? {
        canonical_dish_id: name.toLowerCase().replace(/\s+/g, "-"),
        dish_type: "other",
      }
    );
  },
  async estimateMacros({ portion_g }) {
    const f = portion_g / 100;
    return {
      cal: Math.round(220 * f),
      protein_g: 8 * f,
      carb_g: 20 * f,
      fat_g: 7 * f,
    };
  },
  async repairProfile() {
    return {};
  },
};

function dish(name: string): CandidateDish {
  return {
    source: "swiggy",
    restaurant_id: "r",
    restaurant_name: "R",
    dish_id: name.toLowerCase().replace(/\s+/g, "-"),
    dish_name: name,
    price_inr: 200,
    is_veg: false,
    deliverable_to_address: true,
  };
}

function memCache(): NutritionCacheStore {
  const m = new Map<string, Parameters<NutritionCacheStore["upsert"]>[0]>();
  return {
    async get(id) {
      return m.get(id) ?? null;
    },
    async upsert(e) {
      m.set(e.canonical_dish_id, e);
    },
  };
}

const agentOn = (source: NutritionSource, cache = memCache()) =>
  createNutritionAgent({ llm: stubLlm, source, cache });

describe("nutrition agent", () => {
  it("enriches dishes; grounded hit is 'high', unknown falls back to 'low'", async () => {
    const out = await agentOn(createIndbSource()).enrich([
      dish("Grilled Chicken Bowl"),
      dish("Mystery Special"),
    ]);

    const chicken = out.find(
      (d) => d.canonical_dish_id === "grilled-chicken-bowl",
    )!;
    expect(chicken.macro_confidence).toBe("high");
    expect(chicken.macros!.cal).toBe(525); // 350g * per-100g {150,12,11.5,5.1}
    expect(chicken.macros!.protein_g).toBeCloseTo(42, 1);

    const mystery = out.find((d) => d.canonical_dish_id === "mystery-special")!;
    expect(mystery.macro_confidence).toBe("low");
    expect(mystery.macros).toBeDefined();
  });

  it("serves a repeat dish from cache (grounded source hit once)", async () => {
    const indb = createIndbSource();
    let lookups = 0;
    const counting: NutritionSource = {
      name: "indb",
      async lookupPer100g(id) {
        lookups++;
        return indb.lookupPer100g(id);
      },
    };
    const agent = agentOn(counting);
    await agent.enrich([dish("Grilled Chicken Bowl")]);
    await agent.enrich([dish("Grilled Chicken Bowl")]);
    expect(lookups).toBe(1);
  });

  it("multiplies the serving by a parsed quantity", async () => {
    const agent = agentOn(createIndbSource());
    const [single] = await agent.enrich([dish("Aloo Paratha")]);
    const [double] = await agent.enrich([dish("2 Aloo Paratha")]);
    expect(double!.macros!.cal).toBe(single!.macros!.cal * 2);
  });

  it("keeps daily-aggregate macros within ±15% of the dry-run fixture", async () => {
    const day = await agentOn(createIndbSource()).enrich([
      dish("Grilled Chicken Bowl"),
      dish("Paneer Butter Masala"),
    ]);
    const sum = day.reduce<Macros>(
      (a, d) => ({
        cal: a.cal + d.macros!.cal,
        protein_g: a.protein_g + d.macros!.protein_g,
        carb_g: a.carb_g + d.macros!.carb_g,
        fat_g: a.fat_g + d.macros!.fat_g,
      }),
      { cal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
    );
    const ref: Macros = { cal: 1040, protein_g: 60, carb_g: 62, fat_g: 55 };
    for (const k of ["cal", "protein_g", "carb_g", "fat_g"] as const) {
      expect(Math.abs(sum[k] - ref[k]) / ref[k]).toBeLessThanOrEqual(0.15);
    }
  });
});
