import type {
  CandidateDish,
  GuardrailBlockCode,
  GuardrailDecision,
  OrderHistoryEntry,
  PlanEntry,
  PreferenceProfile,
  SourceAdapter,
  SpendLedgerEntry,
} from "@rasa/shared";
import { OrderStatusSchema, type OrderStatus } from "@rasa/shared";
import type { OrderAction } from "../../guardrail/policy";
import type { CouponPlan } from "../budget";

/** Normalize a source's order status to our OrderStatus enum (default "placed"). */
function toOrderStatus(status: string): OrderStatus {
  return OrderStatusSchema.safeParse(status).success
    ? (status as OrderStatus)
    : "placed";
}

export type ConfirmDecision = "confirm" | "decline" | "timeout";

export interface Nudge {
  planId: string;
  day: string;
  slot: string;
  dish: CandidateDish;
  effective_price_inr: number;
  confirm_token: string;
}

export interface Notifier {
  /** Send the one-tap nudge and await the user's decision. */
  sendNudge(nudge: Nudge): Promise<ConfirmDecision>;
}

export interface ExecutionStore {
  /**
   * Atomically claim a due slot: transition pending → nudged, returning true only if
   * THIS caller won the transition. Prevents concurrent ticks from double-ordering, and
   * means a slot leaves 'pending' before any order is placed (so a mid-flight crash can't
   * cause a re-order). Production impl: `update plan_entries set slot_state='nudged'
   * where ... and slot_state='pending'` (rowcount > 0).
   */
  claimSlot(input: {
    planId: string;
    day: string;
    slot: string;
  }): Promise<boolean>;
  recordOrder(order: OrderHistoryEntry): Promise<{ id: string }>;
  recordLedgerActual(entry: SpendLedgerEntry): Promise<void>;
  setSlotState(input: {
    planId: string;
    day: string;
    slot: string;
    state: PlanEntry["slot_state"];
  }): Promise<void>;
}

export interface ExecutorDeps {
  adapter: SourceAdapter;
  checkGuardrail: (
    profile: PreferenceProfile,
    action: OrderAction,
  ) => GuardrailDecision;
  planCoupon: (
    restaurantId: string,
    subtotalInr: number,
  ) => Promise<CouponPlan | null>;
  notifier: Notifier;
  store: ExecutionStore;
  addressId: string;
  makeConfirmToken: () => string;
  priceSpikeThresholdPct?: number;
}

export type SlotOutcome =
  | { outcome: "ordered"; orderId: string; dishId: string }
  | { outcome: "declined" }
  | { outcome: "skipped"; reason: string }
  | { outcome: "aborted"; reason: string; code: GuardrailBlockCode };

type Attempt =
  | { kind: "ordered"; orderId: string }
  | { kind: "declined" }
  | { kind: "timeout" }
  | { kind: "unavailable" }
  | { kind: "aborted"; reason: string; code: GuardrailBlockCode };

/**
 * Scheduler / Executor. For a due slot it re-validates the dish live, plans a coupon,
 * runs the guardrail, sends the one-tap nudge, and ONLY on an explicit confirm places
 * the order (re-checking the guardrail with the confirm token first). It never orders
 * silently: a decline tries the next fallback, a timeout skips the slot, and a guardrail
 * abort (e.g. a price spike) falls back or fails.
 */
export function createExecutor(deps: ExecutorDeps) {
  async function tryDish(
    profile: PreferenceProfile,
    planId: string,
    slotEntry: PlanEntry,
    dish: CandidateDish,
  ): Promise<Attempt> {
    const current = await deps.adapter.revalidate(
      dish.restaurant_id,
      dish.dish_id,
    );
    if (!current || !current.available) return { kind: "unavailable" };

    // Build the guardrail action from LIVE fields (name/description/is_veg/deliverable),
    // NOT stale plan-time metadata — a menu that added an allergen or flipped diet must
    // be caught here, at order time.
    const liveDish: CandidateDish = {
      ...dish,
      price_inr: current.price_inr,
      dish_name: current.dish_name ?? dish.dish_name,
      description: current.description ?? dish.description,
      is_veg: current.is_veg ?? dish.is_veg,
      deliverable_to_address:
        current.deliverable_to_address ?? dish.deliverable_to_address,
    };
    const couponPlan = await deps.planCoupon(
      dish.restaurant_id,
      current.price_inr,
    );
    const effective = couponPlan?.effective_inr ?? current.price_inr;
    const action: OrderAction = {
      dish: liveDish,
      effective_price_inr: effective,
      slot_cap_inr: slotEntry.slot_budget_inr,
      quoted_price_inr: dish.price_inr,
      priceSpikeThresholdPct: deps.priceSpikeThresholdPct,
    };

    // Pre-nudge guardrail: don't even ask the user about a dish we couldn't order.
    const pre = deps.checkGuardrail(profile, action);
    if (!pre.allow)
      return { kind: "aborted", reason: pre.reason, code: pre.code };

    const token = deps.makeConfirmToken();
    const decision = await deps.notifier.sendNudge({
      planId,
      day: slotEntry.day,
      slot: slotEntry.slot,
      dish: action.dish,
      effective_price_inr: effective,
      confirm_token: token,
    });
    if (decision === "decline") return { kind: "declined" };
    // Only a literal "confirm" places an order — a timeout OR any unexpected value skips.
    if (decision !== "confirm") return { kind: "timeout" };

    // Confirmed — re-check WITH the token so an order can never be placed without one.
    const confirmed = deps.checkGuardrail(profile, {
      ...action,
      confirm_token: token,
      requireConfirm: true,
    });
    if (!confirmed.allow)
      return {
        kind: "aborted",
        reason: confirmed.reason,
        code: confirmed.code,
      };

    const order = await deps.adapter.order({
      restaurantId: dish.restaurant_id,
      dishId: dish.dish_id,
      quantity: 1,
      addressId: deps.addressId,
      couponCode: couponPlan?.code,
      confirmToken: token,
    });
    await deps.store.recordOrder({
      user_id: profile.user_id,
      restaurant_id: dish.restaurant_id,
      dish_id: dish.dish_id,
      dish_name: liveDish.dish_name,
      amount_inr: order.amount_inr,
      status: toOrderStatus(order.status),
      swiggy_order_id: order.order_id,
    });
    await deps.store.recordLedgerActual({
      user_id: profile.user_id,
      plan_id: planId,
      day: slotEntry.day,
      slot: slotEntry.slot,
      planned_inr: dish.price_inr,
      actual_inr: order.amount_inr,
      coupon_code: couponPlan?.code,
      coupon_discount_inr: couponPlan?.discount_inr ?? 0,
    });
    return { kind: "ordered", orderId: order.order_id };
  }

  async function executeSlot(
    profile: PreferenceProfile,
    planId: string,
    slotEntry: PlanEntry,
  ): Promise<SlotOutcome> {
    // Atomically claim the slot: concurrent ticks can't double-order, and the slot leaves
    // 'pending' before any order so a mid-flight crash can never cause a re-order.
    if (
      !(await deps.store.claimSlot({
        planId,
        day: slotEntry.day,
        slot: slotEntry.slot,
      }))
    ) {
      return {
        outcome: "skipped",
        reason: "slot already claimed / in progress",
      };
    }
    const candidates = [slotEntry.chosen, ...slotEntry.fallbacks];
    const setState = (state: PlanEntry["slot_state"]) =>
      deps.store.setSlotState({
        planId,
        day: slotEntry.day,
        slot: slotEntry.slot,
        state,
      });

    let lastReason = "no candidates";
    for (let i = 0; i < candidates.length; i++) {
      const dish = candidates[i]!;
      const isLast = i === candidates.length - 1;
      const attempt = await tryDish(profile, planId, slotEntry, dish);

      if (attempt.kind === "ordered") {
        await setState("ordered");
        return {
          outcome: "ordered",
          orderId: attempt.orderId,
          dishId: dish.dish_id,
        };
      }
      if (attempt.kind === "timeout") {
        await setState("skipped");
        return { outcome: "skipped", reason: "nudge timed out" };
      }
      if (attempt.kind === "declined") {
        if (isLast) {
          await setState("declined");
          return { outcome: "declined" };
        }
        continue; // offer the next fallback
      }
      // unavailable or aborted → try the next candidate silently
      if (attempt.kind === "aborted") {
        if (isLast) {
          await setState("failed");
          return {
            outcome: "aborted",
            reason: attempt.reason,
            code: attempt.code,
          };
        }
        lastReason = attempt.reason;
      } else {
        lastReason = "no longer available";
        if (isLast) {
          await setState("skipped");
          return { outcome: "skipped", reason: lastReason };
        }
      }
    }

    await setState("skipped");
    return { outcome: "skipped", reason: lastReason };
  }

  return { executeSlot };
}
