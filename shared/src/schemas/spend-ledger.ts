import { z } from "zod";

/** One planned-vs-actual spend row per slot. Mirrors the `spend_ledger` table. */
export const SpendLedgerEntrySchema = z
  .object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid(),
    plan_id: z.string().uuid(),
    plan_entry_id: z.string().uuid().optional(),
    day: z.string().date(),
    slot: z.string().min(1),
    planned_inr: z.number().int().nonnegative(),
    actual_inr: z.number().int().nonnegative().optional(), // null until ordered
    coupon_code: z.string().optional(),
    coupon_discount_inr: z.number().int().nonnegative().default(0),
    created_at: z.string().datetime().optional(),
  })
  .strict();
export type SpendLedgerEntry = z.infer<typeof SpendLedgerEntrySchema>;
