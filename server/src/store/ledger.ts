import type { SpendLedgerEntry } from "@rasa/shared";
import { type Executor, toDateStr, toNum } from "./db";

function mapLedger(r: Record<string, unknown>): SpendLedgerEntry {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    plan_id: r.plan_id as string,
    plan_entry_id: (r.plan_entry_id as string | null) ?? undefined,
    day: toDateStr(r.day),
    slot: r.slot as string,
    planned_inr: Number(r.planned_inr),
    actual_inr: toNum(r.actual_inr),
    coupon_code: (r.coupon_code as string | null) ?? undefined,
    coupon_discount_inr: Number(r.coupon_discount_inr),
  };
}

export function ledgerRepo(exec: Executor) {
  return {
    async insert(entry: SpendLedgerEntry): Promise<{ id: string }> {
      const { rows } = await exec.query<{ id: string }>(
        `insert into spend_ledger
           (user_id, plan_id, plan_entry_id, day, slot, planned_inr, actual_inr, coupon_code, coupon_discount_inr)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [
          entry.user_id,
          entry.plan_id,
          entry.plan_entry_id ?? null,
          entry.day,
          entry.slot,
          entry.planned_inr,
          entry.actual_inr ?? null,
          entry.coupon_code ?? null,
          entry.coupon_discount_inr ?? 0,
        ],
      );
      return { id: rows[0]!.id };
    },

    /** RLS-scoped: only the current user's rows. */
    async listForUser(): Promise<SpendLedgerEntry[]> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from spend_ledger order by day, slot`,
      );
      return rows.map(mapLedger);
    },

    /** Total actual spend for the current user in a month (YYYY-MM). */
    async monthTotalInr(monthPrefix: string): Promise<number> {
      const { rows } = await exec.query<{ total: string | null }>(
        `select coalesce(sum(coalesce(actual_inr, planned_inr)), 0) as total
         from spend_ledger where to_char(day, 'YYYY-MM') = $1`,
        [monthPrefix],
      );
      return Number(rows[0]?.total ?? 0);
    },
  };
}
