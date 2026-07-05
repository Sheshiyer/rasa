import {
  CandidateDishSchema,
  type CandidateDish,
  type Macros,
  type NutritionCacheEntry,
} from "@rasa/shared";
import type { LlmClient } from "../../llm/client";
import { canonicalizeDish } from "./canonicalize";
import { defaultPortionG } from "./portion-table";
import type { NutritionSource, Per100g } from "./nutrition-source";

/** The cache surface the agent needs — satisfied by both an in-memory map and nutritionCacheRepo. */
export interface NutritionCacheStore {
  get(canonicalDishId: string): Promise<NutritionCacheEntry | null>;
  upsert(entry: NutritionCacheEntry): Promise<void>;
}

export interface NutritionAgentDeps {
  llm: LlmClient;
  source: NutritionSource;
  cache: NutritionCacheStore;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function scalePer100(p: Per100g, grams: number): Macros {
  const f = grams / 100;
  return {
    cal: Math.round(p.cal * f),
    protein_g: round1(p.protein_g * f),
    carb_g: round1(p.carb_g * f),
    fat_g: round1(p.fat_g * f),
  };
}

function multiply(m: Macros, q: number): Macros {
  return {
    cal: Math.round(m.cal * q),
    protein_g: round1(m.protein_g * q),
    carb_g: round1(m.carb_g * q),
    fat_g: round1(m.fat_g * q),
  };
}

/**
 * Nutrition Agent. Enriches CandidateDishes with estimated calories + macros via the
 * hybrid pipeline: canonicalize (LLM) + parse quantity -> cache lookup -> grounded
 * INDB lookup (high confidence) -> LLM fallback (low). All numbers are estimates,
 * aggregated per day; no per-dish precision is claimed.
 */
export function createNutritionAgent(deps: NutritionAgentDeps) {
  async function enrichOne(dish: CandidateDish): Promise<CandidateDish> {
    const { quantity, canonical_dish_id, dish_type } = await canonicalizeDish(
      deps.llm,
      {
        name: dish.dish_name,
        description: dish.description,
      },
    );

    // Cache holds per-serving macros for a canonical dish; check before any lookup.
    let perServing: Macros;
    let confidence: NutritionCacheEntry["macro_confidence"];
    const cached = await deps.cache.get(canonical_dish_id);
    if (cached) {
      perServing = cached.macros;
      confidence = cached.macro_confidence;
    } else {
      const portion_g = defaultPortionG(dish_type);
      const per100 = await deps.source.lookupPer100g(canonical_dish_id);
      let source: NutritionCacheEntry["source"];
      if (per100) {
        perServing = scalePer100(per100, portion_g);
        confidence = "high";
        source = "indb";
      } else {
        perServing = await deps.llm.estimateMacros({
          name: dish.dish_name,
          description: dish.description,
          portion_g,
        });
        confidence = "low";
        source = "llm-fallback";
      }
      await deps.cache.upsert({
        canonical_dish_id,
        macros: perServing,
        macro_confidence: confidence,
        source,
        portion_g,
      });
    }

    return CandidateDishSchema.parse({
      ...dish,
      canonical_dish_id,
      macros: multiply(perServing, quantity),
      macro_confidence: confidence,
    });
  }

  return {
    /** Enrich a batch sequentially so a repeated dish within the batch also hits cache. */
    async enrich(dishes: CandidateDish[]): Promise<CandidateDish[]> {
      const out: CandidateDish[] = [];
      for (const d of dishes) out.push(await enrichOne(d));
      return out;
    },
    enrichOne,
  };
}
