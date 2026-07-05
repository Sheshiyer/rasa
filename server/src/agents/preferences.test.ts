import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { LlmClient } from "../llm/client";
import type { PreferenceProfile } from "@rasa/shared";
import { createPgliteDb, type RasaDb } from "../store/db";
import { profilesRepo } from "../store/profiles";
import { createPreferencesAgent, extractJson } from "./preferences";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";
const D = "44444444-4444-4444-4444-444444444444";

const validObj = {
  diet_type: "nonveg",
  cuisines_like: ["North Indian"],
  cuisines_avoid: [],
  allergens: ["peanut", "shellfish"],
  dislikes: ["mushroom"],
  spice_level: "medium",
  meals_per_day: 2,
  slots: [
    { name: "lunch", window: "12:30-13:30" },
    { name: "dinner", window: "20:00-21:00" },
  ],
  budget_monthly_inr: 9000,
  calorie_target: 2000,
  macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
  variety_tolerance: "medium",
  cheat_rules: { days: ["Sat"], relax_macros: true },
};

const paste = (obj: unknown): string =>
  "Great — here's your profile!\n\n```json\n" +
  JSON.stringify(obj, null, 2) +
  "\n```\n\nAnything to change?";

function makeLlm(repair: LlmClient["repairProfile"]): LlmClient {
  return {
    async canonicalizeDish() {
      return { canonical_dish_id: "", dish_type: "other" };
    },
    async estimateMacros() {
      return { cal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
    },
    repairProfile: repair,
  };
}

let db: RasaDb;
const persist = (p: PreferenceProfile) =>
  db.withUser(p.user_id, (tx) => profilesRepo(tx).upsert(p));
const read = (uid: string) =>
  db.withUser(uid, (tx) => profilesRepo(tx).get(uid));

beforeAll(async () => {
  db = await createPgliteDb();
});
afterAll(async () => {
  await db.close();
});

describe("extractJson", () => {
  it("pulls JSON out of a fenced block amid prose", () => {
    expect(extractJson('hi\n```json\n{"a":1}\n```\nbye')).toEqual({ a: 1 });
  });
  it("parses bare JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null when there is no JSON", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("Preferences Agent", () => {
  it("stores a valid profile; allergens survive the round-trip", async () => {
    const agent = createPreferencesAgent({
      llm: makeLlm(async () => {
        throw new Error("repair should not be called for a valid paste");
      }),
      persist,
    });
    const res = await agent.processOnboarding(A, paste(validObj));
    expect(res.status).toBe("stored");

    const back = await read(A);
    expect(back?.allergens).toEqual(["peanut", "shellfish"]);
    expect(back?.diet_type).toBe("nonveg");
    expect(back?.source_prefs).toEqual(["swiggy"]);
    expect(back?.macro_target.protein_g).toBe(120);
  });

  it("repairs a malformed paste, then stores it", async () => {
    const bad = { ...validObj, budget_monthly_inr: "9000" }; // string, not int
    const agent = createPreferencesAgent({
      llm: makeLlm(async () => validObj), // repair returns the corrected object
      persist,
    });
    const res = await agent.processOnboarding(B, paste(bad));
    expect(res.status).toBe("stored");
    if (res.status === "stored") expect(res.repaired).toBe(true);
    expect((await read(B))?.budget_monthly_inr).toBe(9000);
  });

  it("asks for diet_type when absent — repair may not fabricate it", async () => {
    const { diet_type, ...noDiet } = validObj;
    void diet_type;
    const agent = createPreferencesAgent({
      llm: makeLlm(async () => ({ ...noDiet, diet_type: "veg" })), // fabricated
      persist,
    });
    const res = await agent.processOnboarding(C, paste(noDiet));
    expect(res.status).toBe("needs_input");
    if (res.status === "needs_input") {
      expect(res.questions.map((q) => q.field)).toContain("diet_type");
    }
    expect(await read(C)).toBeNull(); // not stored
  });

  it("asks for allergens when absent — never silently defaults to none", async () => {
    const { allergens, ...noAllergens } = validObj;
    void allergens;
    const agent = createPreferencesAgent({
      llm: makeLlm(async () => ({ ...noAllergens, allergens: [] })), // fabricated empty
      persist,
    });
    const res = await agent.processOnboarding(D, paste(noAllergens));
    expect(res.status).toBe("needs_input");
    if (res.status === "needs_input") {
      expect(res.questions.map((q) => q.field)).toContain("allergens");
    }
    expect(await read(D)).toBeNull();
  });
});
