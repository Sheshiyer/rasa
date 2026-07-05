/**
 * The guardrail gate's verdict, enforced between Planner/Executor and any order
 * action (allergen hard-block, spend cap, price-spike abort, human-in-the-loop).
 * Reserved here; the policy engine is built in M6.
 */
export type GuardrailDecision =
  { allow: true } | { allow: false; reason: string; code: GuardrailBlockCode };

export type GuardrailBlockCode =
  | "allergen"
  | "diet"
  | "not_deliverable"
  | "over_budget"
  | "price_spike"
  | "missing_confirm"
  | "invalid_price"
  | "unsafe_copy";
