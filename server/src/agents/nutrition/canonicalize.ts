import type { LlmClient } from "../../llm/client";
import type { DishType } from "./portion-table";

/**
 * Pull a leading count off a dish name ("2 Aloo Paratha" -> qty 2). Countable items
 * are far easier to estimate than volume-based ones, so we resolve quantity up front,
 * deterministically, rather than trusting the LLM with it.
 */
export function parseQuantity(dishName: string): {
  quantity: number;
  name: string;
} {
  const m = dishName.trim().match(/^(\d+)\s*x?\s+(.+)$/i);
  if (m) return { quantity: parseInt(m[1]!, 10), name: m[2]!.trim() };
  return { quantity: 1, name: dishName.trim() };
}

export interface Canonicalized {
  quantity: number;
  canonical_dish_id: string;
  dish_type: DishType;
}

/** Parse the count deterministically, then LLM-normalize the name + classify the type. */
export async function canonicalizeDish(
  llm: LlmClient,
  input: { name: string; description?: string },
): Promise<Canonicalized> {
  const { quantity, name } = parseQuantity(input.name);
  const { canonical_dish_id, dish_type } = await llm.canonicalizeDish({
    name,
    description: input.description,
  });
  return { quantity, canonical_dish_id, dish_type };
}
