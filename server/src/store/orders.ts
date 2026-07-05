import type { OrderHistoryEntry } from "@rasa/shared";
import { type Executor, toNum } from "./db";

function mapOrder(r: Record<string, unknown>): OrderHistoryEntry {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    plan_entry_id: (r.plan_entry_id as string | null) ?? undefined,
    swiggy_order_id: (r.swiggy_order_id as string | null) ?? undefined,
    restaurant_id: r.restaurant_id as string,
    dish_id: r.dish_id as string,
    dish_name: r.dish_name as string,
    amount_inr: Number(r.amount_inr),
    status: r.status as OrderHistoryEntry["status"],
    rating: toNum(r.rating),
  };
}

export function ordersRepo(exec: Executor) {
  return {
    async insert(order: OrderHistoryEntry): Promise<{ id: string }> {
      const { rows } = await exec.query<{ id: string }>(
        `insert into order_history
           (user_id, plan_entry_id, swiggy_order_id, restaurant_id, dish_id, dish_name, amount_inr, status, rating)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [
          order.user_id,
          order.plan_entry_id ?? null,
          order.swiggy_order_id ?? null,
          order.restaurant_id,
          order.dish_id,
          order.dish_name,
          order.amount_inr,
          order.status,
          order.rating ?? null,
        ],
      );
      return { id: rows[0]!.id };
    },

    async setStatus(
      id: string,
      status: OrderHistoryEntry["status"],
    ): Promise<void> {
      await exec.query(
        `update order_history set status = $2, updated_at = now() where id = $1`,
        [id, status],
      );
    },

    async setRating(id: string, rating: number): Promise<void> {
      await exec.query(
        `update order_history set rating = $2, updated_at = now() where id = $1`,
        [id, rating],
      );
    },

    async get(id: string): Promise<OrderHistoryEntry | null> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from order_history where id = $1`,
        [id],
      );
      const r = rows[0];
      return r ? mapOrder(r) : null;
    },

    /** RLS-scoped: only the current user's orders. */
    async listForUser(): Promise<OrderHistoryEntry[]> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from order_history order by placed_at desc`,
      );
      return rows.map(mapOrder);
    },
  };
}
