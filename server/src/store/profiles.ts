import type { PreferenceProfile } from "@rasa/shared";
import type { Executor } from "./db";

function mapProfile(r: Record<string, unknown>): PreferenceProfile {
  return {
    user_id: r.user_id as string,
    diet_type: r.diet_type as PreferenceProfile["diet_type"],
    cuisines_like: (r.cuisines_like as string[] | null) ?? [],
    cuisines_avoid: (r.cuisines_avoid as string[] | null) ?? [],
    allergens: (r.allergens as string[] | null) ?? [],
    dislikes: (r.dislikes as string[] | null) ?? [],
    spice_level: r.spice_level as PreferenceProfile["spice_level"],
    meals_per_day: Number(r.meals_per_day),
    slots: r.slots as PreferenceProfile["slots"],
    delivery_address_id: (r.delivery_address_id as string | null) ?? undefined,
    budget_monthly_inr: Number(r.budget_monthly_inr),
    calorie_target: Number(r.calorie_target),
    macro_target: r.macro_target as PreferenceProfile["macro_target"],
    variety_tolerance:
      r.variety_tolerance as PreferenceProfile["variety_tolerance"],
    source_prefs: (r.source_prefs as string[] | null) ?? [],
    cheat_rules:
      (r.cheat_rules as PreferenceProfile["cheat_rules"]) ?? undefined,
  };
}

export function profilesRepo(exec: Executor) {
  return {
    async upsert(p: PreferenceProfile): Promise<void> {
      await exec.query(
        `insert into preference_profiles
           (user_id, diet_type, cuisines_like, cuisines_avoid, allergens, dislikes, spice_level,
            meals_per_day, slots, delivery_address_id, budget_monthly_inr, calorie_target,
            macro_target, variety_tolerance, source_prefs, cheat_rules, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16::jsonb, now())
         on conflict (user_id) do update set
           diet_type=excluded.diet_type, cuisines_like=excluded.cuisines_like,
           cuisines_avoid=excluded.cuisines_avoid, allergens=excluded.allergens,
           dislikes=excluded.dislikes, spice_level=excluded.spice_level,
           meals_per_day=excluded.meals_per_day, slots=excluded.slots,
           delivery_address_id=excluded.delivery_address_id, budget_monthly_inr=excluded.budget_monthly_inr,
           calorie_target=excluded.calorie_target, macro_target=excluded.macro_target,
           variety_tolerance=excluded.variety_tolerance, source_prefs=excluded.source_prefs,
           cheat_rules=excluded.cheat_rules, updated_at=now()`,
        [
          p.user_id,
          p.diet_type,
          p.cuisines_like,
          p.cuisines_avoid,
          p.allergens,
          p.dislikes,
          p.spice_level,
          p.meals_per_day,
          JSON.stringify(p.slots),
          p.delivery_address_id ?? null,
          p.budget_monthly_inr,
          p.calorie_target,
          JSON.stringify(p.macro_target),
          p.variety_tolerance,
          p.source_prefs,
          p.cheat_rules ? JSON.stringify(p.cheat_rules) : null,
        ],
      );
    },

    async get(userId: string): Promise<PreferenceProfile | null> {
      const { rows } = await exec.query<Record<string, unknown>>(
        `select * from preference_profiles where user_id = $1`,
        [userId],
      );
      const r = rows[0];
      return r ? mapProfile(r) : null;
    },
  };
}
