import type { PlanEntry, PreferenceProfile } from "@rasa/shared";
import type { SlotOutcome } from "./executor";

export interface DueEntry {
  profile: PreferenceProfile;
  planId: string;
  entry: PlanEntry;
}

/**
 * Source of slots that are due to be ordered. The production impl is store-backed and
 * runs with the service role: `select ... from plan_entries where scheduled_wake_at <= now
 * and slot_state = 'pending'`, joined to each owner's profile. (That query is wired at
 * deployment; the Scheduler here depends only on this interface, so it stays testable.)
 * The Swiggy MCP has no native scheduling, so this app-side loop owns the calendar.
 */
export interface DueEntrySource {
  due(nowIso: string): Promise<DueEntry[]>;
}

export interface SchedulerExecutor {
  executeSlot(
    profile: PreferenceProfile,
    planId: string,
    entry: PlanEntry,
  ): Promise<SlotOutcome>;
}

export interface SchedulerDeps {
  source: DueEntrySource;
  executor: SchedulerExecutor;
}

export function createScheduler(deps: SchedulerDeps) {
  return {
    /** One tick: hand every slot due at `nowIso` to the Executor. A timer/cron calls this. */
    async tick(
      nowIso: string,
    ): Promise<Array<DueEntry & { outcome: SlotOutcome }>> {
      const due = await deps.source.due(nowIso);
      const results: Array<DueEntry & { outcome: SlotOutcome }> = [];
      for (const d of due) {
        const outcome = await deps.executor.executeSlot(
          d.profile,
          d.planId,
          d.entry,
        );
        results.push({ ...d, outcome });
      }
      return results;
    },
  };
}
