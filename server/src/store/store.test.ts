import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PreferenceProfile, CandidateDish, PlanEntry } from "@rasa/shared";
import { createPgliteDb, type RasaDb } from "./db";
import { profilesRepo } from "./profiles";
import { plansRepo } from "./plans";
import { ledgerRepo } from "./ledger";
import { ordersRepo } from "./orders";
import { nutritionCacheRepo } from "./nutrition-cache";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

const profile = (userId: string): PreferenceProfile => ({
  user_id: userId,
  diet_type: "nonveg",
  cuisines_like: ["North Indian"],
  cuisines_avoid: [],
  allergens: ["peanut"],
  dislikes: ["mushroom"],
  spice_level: "medium",
  meals_per_day: 2,
  slots: [{ name: "lunch", window: "12:30-13:30" }],
  budget_monthly_inr: 9000,
  calorie_target: 2000,
  macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
  variety_tolerance: "medium",
  source_prefs: ["swiggy"],
});

const dish: CandidateDish = {
  source: "swiggy",
  restaurant_id: "r-grill",
  restaurant_name: "Grill House",
  dish_id: "d-chicken",
  dish_name: "Grilled Chicken Bowl",
  price_inr: 280,
  is_veg: false,
  deliverable_to_address: true,
};

const entry: PlanEntry = {
  day: "2026-07-06",
  slot: "lunch",
  chosen: dish,
  fallbacks: [],
  slot_budget_inr: 300,
  projected_macros: { cal: 520, protein_g: 42, carb_g: 40, fat_g: 18 },
  slot_state: "pending",
};

let db: RasaDb;
beforeAll(async () => {
  db = await createPgliteDb();
});
afterAll(async () => {
  await db.close();
});

describe("preference profiles", () => {
  it("round-trips a profile and enforces RLS", async () => {
    await db.withUser(A, (tx) => profilesRepo(tx).upsert(profile(A)));
    const got = await db.withUser(A, (tx) => profilesRepo(tx).get(A));
    expect(got?.allergens).toEqual(["peanut"]);
    expect(got?.macro_target.protein_g).toBe(120);
    // RLS: B cannot read A's profile.
    const asB = await db.withUser(B, (tx) => profilesRepo(tx).get(A));
    expect(asB).toBeNull();
  });
});

describe("plans + plan_entries", () => {
  it("creates a plan with an entry and enforces RLS through the parent", async () => {
    const plan = await db.withUser(A, (tx) =>
      plansRepo(tx).create({
        user_id: A,
        status: "draft",
        start_date: "2026-07-06",
        end_date: "2026-08-04",
      }),
    );
    await db.withUser(A, (tx) => plansRepo(tx).addEntry(plan.id!, entry));

    const entries = await db.withUser(A, (tx) =>
      plansRepo(tx).listEntries(plan.id!),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.chosen.dish_id).toBe("d-chicken");
    expect(entries[0]!.slot_state).toBe("pending");

    // RLS: B sees neither the plan nor its entries.
    expect(
      await db.withUser(B, (tx) => plansRepo(tx).get(plan.id!)),
    ).toBeNull();
    expect(
      await db.withUser(B, (tx) => plansRepo(tx).listEntries(plan.id!)),
    ).toHaveLength(0);
  });
});

describe("spend ledger", () => {
  it("records spend and enforces RLS", async () => {
    const plan = await db.withUser(A, (tx) =>
      plansRepo(tx).create({
        user_id: A,
        status: "active",
        start_date: "2026-07-06",
        end_date: "2026-08-04",
      }),
    );
    await db.withUser(A, (tx) =>
      ledgerRepo(tx).insert({
        user_id: A,
        plan_id: plan.id!,
        day: "2026-07-06",
        slot: "lunch",
        planned_inr: 300,
        actual_inr: 240,
        coupon_code: "SAVE40",
        coupon_discount_inr: 40,
      }),
    );
    const mine = await db.withUser(A, (tx) => ledgerRepo(tx).listForUser());
    expect(mine.some((r) => r.actual_inr === 240)).toBe(true);
    expect(
      await db.withUser(B, (tx) => ledgerRepo(tx).listForUser()),
    ).toHaveLength(0);
  });
});

describe("order history", () => {
  it("records an order + rating and enforces RLS", async () => {
    const created = await db.withUser(A, (tx) =>
      ordersRepo(tx).insert({
        user_id: A,
        swiggy_order_id: "ord-1",
        restaurant_id: "r-grill",
        dish_id: "d-chicken",
        dish_name: "Grilled Chicken Bowl",
        amount_inr: 240,
        status: "placed",
      }),
    );
    await db.withUser(A, (tx) => ordersRepo(tx).setRating(created.id!, 5));
    const got = await db.withUser(A, (tx) => ordersRepo(tx).get(created.id!));
    expect(got?.rating).toBe(5);
    expect(
      await db.withUser(B, (tx) => ordersRepo(tx).get(created.id!)),
    ).toBeNull();
  });
});

describe("nutrition cache (global, no RLS)", () => {
  it("is shared across users", async () => {
    await db.withUser(A, (tx) =>
      nutritionCacheRepo(tx).upsert({
        canonical_dish_id: "grilled-chicken-bowl",
        macros: { cal: 520, protein_g: 42, carb_g: 40, fat_g: 18 },
        macro_confidence: "high",
        source: "indb",
        portion_g: 300,
      }),
    );
    const asB = await db.withUser(B, (tx) =>
      nutritionCacheRepo(tx).get("grilled-chicken-bowl"),
    );
    expect(asB?.macros.protein_g).toBe(42);
    expect(asB?.macro_confidence).toBe("high");
  });
});
