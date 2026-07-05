import type { Plan, PlanEntry, CandidateDish, Macros } from "@rasa/shared";
import { type Executor, toDateStr } from "./db";

function mapPlan(r: Record<string, unknown>): Plan {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    status: r.status as Plan["status"],
    start_date: toDateStr(r.start_date),
    end_date: toDateStr(r.end_date),
  };
}

function mapEntry(r: Record<string, unknown>): PlanEntry {
  return {
    day: toDateStr(r.day),
    slot: r.slot as string,
    chosen: r.chosen as CandidateDish,
    fallbacks: (r.fallbacks as CandidateDish[] | null) ?? [],
    slot_budget_inr: Number(r.slot_budget_inr),
    projected_macros: r.projected_macros as Macros,
    slot_state: r.slot_state as PlanEntry["slot_state"],
  };
}

export function plansRepo(exec: Executor) {
  return {
    async create(input: {
      user_id: string;
      status: Plan["status"];
      start_date: string;
      end_date: string;
    }): Promise<Plan> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `insert into plans (user_id, status, start_date, end_date)
         values ($1,$2,$3,$4) returning *`,
        [input.user_id, input.status, input.start_date, input.end_date],
      );
      return mapPlan(rows[0]!);
    },

    async get(id: string): Promise<Plan | null> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from plans where id = $1`,
        [id],
      );
      const r = rows[0];
      return r ? mapPlan(r) : null;
    },

    async addEntry(planId: string, entry: PlanEntry): Promise<void> {
      await exec.query(
        `insert into plan_entries
           (plan_id, day, slot, chosen, fallbacks, slot_budget_inr, projected_macros, slot_state, scheduled_wake_at)
         values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8,$9)`,
        [
          planId,
          entry.day,
          entry.slot,
          JSON.stringify(entry.chosen),
          JSON.stringify(entry.fallbacks),
          entry.slot_budget_inr,
          JSON.stringify(entry.projected_macros),
          entry.slot_state,
          entry.scheduled_wake_at ?? null,
        ],
      );
    },

    async listEntries(planId: string): Promise<PlanEntry[]> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from plan_entries where plan_id = $1 order by day, slot`,
        [planId],
      );
      return rows.map(mapEntry);
    },

    async updateEntryState(
      planId: string,
      day: string,
      slot: string,
      state: PlanEntry["slot_state"],
    ): Promise<void> {
      await exec.query(
        `update plan_entries set slot_state = $4 where plan_id = $1 and day = $2 and slot = $3`,
        [planId, day, slot, state],
      );
    },
  };
}
