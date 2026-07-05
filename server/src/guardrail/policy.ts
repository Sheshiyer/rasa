import type {
  CandidateDish,
  GuardrailDecision,
  PreferenceProfile,
} from "@rasa/shared";

/** A proposed cart/order action the guardrail vets before it reaches the user or Swiggy. */
export interface OrderAction {
  dish: CandidateDish;
  /** Price after any coupon — what the user would actually pay for this slot. */
  effective_price_inr: number;
  /** The slot's budget cap (from the Budget envelope). */
  slot_cap_inr: number;
  /** The price quoted at plan time; a large upward move aborts (price spike). */
  quoted_price_inr?: number;
  /** Human-in-the-loop token. When requireConfirm is set, its absence blocks. */
  confirm_token?: string;
  requireConfirm?: boolean;
  /** Fractional price-spike tolerance vs quoted_price_inr. Default 0.15 (15%). */
  priceSpikeThresholdPct?: number;
}

const ALLOW: GuardrailDecision = { allow: true };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word allergen match with optional plural, e.g. "peanut" matches "peanut" and
 * "peanuts" but NOT "coconut"/"eggplant". Allergen tokens are trimmed first so stray
 * whitespace ("  peanut ") can't bypass the check. This is the highest-priority,
 * safety-critical guardrail.
 */
function containsAllergen(dish: CandidateDish, allergens: string[]): boolean {
  const hay =
    `${dish.dish_name} ${dish.description ?? ""} ${dish.canonical_dish_id ?? ""}`.toLowerCase();
  return allergens.some((a) => {
    const token = a.trim().toLowerCase();
    if (!token) return false;
    return new RegExp(`\\b${escapeRegex(token)}(?:es|s)?\\b`).test(hay);
  });
}

/** veg / jain / egg profiles require a vegetarian dish; nonveg allows anything. */
function violatesDiet(
  dietType: PreferenceProfile["diet_type"],
  dish: CandidateDish,
): boolean {
  return dietType !== "nonveg" && !dish.is_veg;
}

/**
 * The order guardrail. Hard, ordered checks — the first violation wins:
 * allergen (safety) → diet → deliverability → human-in-the-loop → invalid price →
 * price-spike → spend-cap. Enforced between Planner/Executor and any order action, so
 * nothing that trips a hard constraint ever reaches the user or Swiggy.
 */
export function checkGuardrail(
  profile: PreferenceProfile,
  action: OrderAction,
): GuardrailDecision {
  const { dish } = action;

  if (containsAllergen(dish, profile.allergens)) {
    return {
      allow: false,
      code: "allergen",
      reason: `contains an allergen (${profile.allergens.join(", ")})`,
    };
  }
  if (violatesDiet(profile.diet_type, dish)) {
    return {
      allow: false,
      code: "diet",
      reason: `not compatible with a ${profile.diet_type} diet`,
    };
  }
  if (!dish.deliverable_to_address) {
    return {
      allow: false,
      code: "not_deliverable",
      reason: "not deliverable to the selected address",
    };
  }
  if (action.requireConfirm && !action.confirm_token) {
    return {
      allow: false,
      code: "missing_confirm",
      reason: "no confirm token — an order needs an explicit one-tap confirm",
    };
  }
  if (action.effective_price_inr < 0) {
    return {
      allow: false,
      code: "invalid_price",
      reason: `invalid negative price (₹${action.effective_price_inr})`,
    };
  }
  if (action.quoted_price_inr !== undefined && action.quoted_price_inr > 0) {
    const threshold = action.priceSpikeThresholdPct ?? 0.15;
    if (
      action.effective_price_inr >
      action.quoted_price_inr * (1 + threshold)
    ) {
      return {
        allow: false,
        code: "price_spike",
        reason: `price rose to ₹${action.effective_price_inr} from a quoted ₹${action.quoted_price_inr}`,
      };
    }
  }
  if (action.effective_price_inr > action.slot_cap_inr) {
    return {
      allow: false,
      code: "over_budget",
      reason: `₹${action.effective_price_inr} exceeds the ₹${action.slot_cap_inr} slot cap`,
    };
  }
  return ALLOW;
}

// Disease / medical / treatment claims FSSAI (Advertising & Claims Regs 2022) prohibits.
// Word-bounded so benign copy ("a healthy, balanced meal", "a tasty treat") passes.
const UNSAFE_COPY =
  /\b(?:cures?|cured|heals?|healed|healing|detox\w*|reverses?|reversing|clinically\s+proven|doctor[-\s]?approved|medically|diagnos\w*|therapeutic|(?:boosts?|strengthens?)\s+immun\w*|immun\w*\s+boost\w*|(?:prevents?|treats?)\s+(?:\w+\s+){0,2}(?:disease|diabetes|cancer|illness|condition))\b/i;

/** Vet any user-facing nutrition text: block disease/medical claims; allow honest estimates. */
export function checkNutritionCopy(text: string): GuardrailDecision {
  if (UNSAFE_COPY.test(text)) {
    return {
      allow: false,
      code: "unsafe_copy",
      reason: "nutrition copy makes a medical/disease claim (FSSAI)",
    };
  }
  return ALLOW;
}
