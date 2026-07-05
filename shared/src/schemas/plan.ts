import { z } from "zod";
import { MacrosSchema } from "./nutrition";
import { CandidateDishSchema } from "./candidate-dish";

/** Lifecycle of a single meal slot inside a plan. Mirrors `plan_entries.slot_state`. */
export const SlotStateSchema = z.enum([
  "pending",
  "nudged",
  "confirmed",
  "ordered",
  "declined",
  "skipped",
  "failed",
]);
export type SlotState = z.infer<typeof SlotStateSchema>;

/** One day×slot of the plan: the chosen dish, ranked fallbacks, budget + projected macros. */
export const PlanEntrySchema = z
  .object({
    day: z.string().date(),
    slot: z.string().min(1),
    chosen: CandidateDishSchema,
    fallbacks: z.array(CandidateDishSchema).default([]),
    slot_budget_inr: z.number().int().nonnegative(),
    projected_macros: MacrosSchema,
    slot_state: SlotStateSchema.default("pending"),
    scheduled_wake_at: z.string().datetime().optional(),
  })
  .strict();
export type PlanEntry = z.infer<typeof PlanEntrySchema>;

/** Status of a 30-day plan. Mirrors `plans.status`. */
export const PlanStatusSchema = z.enum([
  "draft",
  "approved",
  "active",
  "completed",
  "cancelled",
]);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

/** The 30-day plan header. Entries live in `plan_entries` (PlanEntrySchema). */
export const PlanSchema = z
  .object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid(),
    status: PlanStatusSchema,
    start_date: z.string().date(),
    end_date: z.string().date(),
    approved_at: z.string().datetime().optional(),
    created_at: z.string().datetime().optional(),
  })
  .strict();
export type Plan = z.infer<typeof PlanSchema>;
