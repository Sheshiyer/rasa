import type { NutritionCacheEntry, Macros } from "@rasa/shared";
import { type Executor, toNum } from "./db";

function mapCache(r: Record<string, unknown>): NutritionCacheEntry {
  const entry: NutritionCacheEntry = {
    canonical_dish_id: r.canonical_dish_id as string,
    macros: r.macros as Macros,
    macro_confidence:
      r.macro_confidence as NutritionCacheEntry["macro_confidence"],
    source: r.source as NutritionCacheEntry["source"],
  };
  const portion = toNum(r.portion_g);
  if (portion !== undefined) entry.portion_g = portion;
  return entry;
}

/**
 * Global, un-scoped cache (dish nutrition is the same for every user — the whole point
 * of caching by canonical_dish_id). No RLS; shared across users.
 */
export function nutritionCacheRepo(exec: Executor) {
  return {
    async upsert(entry: NutritionCacheEntry): Promise<void> {
      await exec.query(
        `insert into nutrition_cache (canonical_dish_id, macros, macro_confidence, source, portion_g)
         values ($1,$2::jsonb,$3,$4,$5)
         on conflict (canonical_dish_id) do update set
           macros = excluded.macros, macro_confidence = excluded.macro_confidence,
           source = excluded.source, portion_g = excluded.portion_g`,
        [
          entry.canonical_dish_id,
          JSON.stringify(entry.macros),
          entry.macro_confidence,
          entry.source,
          entry.portion_g ?? null,
        ],
      );
    },

    async get(canonicalDishId: string): Promise<NutritionCacheEntry | null> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from nutrition_cache where canonical_dish_id = $1`,
        [canonicalDishId],
      );
      const r = rows[0];
      return r ? mapCache(r) : null;
    },
  };
}
