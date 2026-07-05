import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NutritionSource, Per100g } from "./nutrition-source";

const SEED_PATH = fileURLToPath(
  new URL("../../../../data/indb/indb-seed.json", import.meta.url),
);

function normalizeId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

/**
 * INDB-backed grounded source. Loads the curated seed into an in-memory index keyed
 * by normalized canonical id. The full 1,014-recipe dataset drops in via the same
 * loader with no interface change.
 */
export function createIndbSource(): NutritionSource {
  const raw = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Record<
    string,
    unknown
  >;
  const index = new Map<string, Per100g>();
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue; // skip _meta
    const v = value as Per100g;
    index.set(normalizeId(key), v);
  }
  return {
    name: "indb",
    async lookupPer100g(canonicalDishId) {
      return index.get(normalizeId(canonicalDishId)) ?? null;
    },
  };
}
