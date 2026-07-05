import { describe, it, expect } from "vitest";
import type { PreferenceProfile } from "@rasa/shared";
import { createMockSwiggyMcp } from "../mcp/mock-swiggy-mcp";
import { createSwiggyTools } from "../mcp/swiggy-tools";
import { createSwiggyAdapter } from "../adapters/swiggy-adapter";
import { createDiscoveryAgent } from "./discovery";

function makeProfile(
  overrides: Partial<PreferenceProfile> = {},
): PreferenceProfile {
  return {
    user_id: "11111111-1111-1111-1111-111111111111",
    diet_type: "nonveg",
    cuisines_like: [],
    cuisines_avoid: [],
    allergens: [],
    dislikes: [],
    spice_level: "medium",
    meals_per_day: 2,
    slots: [
      { name: "lunch", window: "12:30-13:30" },
      { name: "dinner", window: "20:00-21:00" },
    ],
    delivery_address_id: "addr-koramangala",
    budget_monthly_inr: 9000,
    calorie_target: 2000,
    macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
    variety_tolerance: "medium",
    source_prefs: ["swiggy"],
    ...overrides,
  };
}

const agentOnMock = () =>
  createDiscoveryAgent({
    adapter: createSwiggyAdapter(
      createSwiggyTools({
        transport: createMockSwiggyMcp(),
        backoffMs: () => 0,
      }),
    ),
  });

describe("Discovery Agent", () => {
  it("returns deduped, deliverable candidates filtered by hard prefs + dislikes", async () => {
    const dishes = await agentOnMock().discoverSlot(
      makeProfile({ allergens: ["peanut"], dislikes: ["fish"] }),
      "lunch",
    );
    const ids = dishes.map((d) => d.dish_id);
    expect(ids).not.toContain("d-padthai"); // peanut (allergen — dropped by adapter)
    expect(ids).not.toContain("d-fish"); // fish (dislike — dropped by discovery)
    expect(ids).toContain("d-chicken");
    expect(dishes.every((d) => d.deliverable_to_address)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length); // deduped
  });

  it("respects a veg diet (hard filter via the adapter)", async () => {
    const dishes = await agentOnMock().discoverSlot(
      makeProfile({ diet_type: "veg" }),
      "lunch",
    );
    expect(dishes.length).toBeGreaterThan(0);
    expect(dishes.every((d) => d.is_veg)).toBe(true);
  });

  it("resolves the delivery address when the profile has none set", async () => {
    const dishes = await agentOnMock().discoverSlot(
      makeProfile({ delivery_address_id: undefined }),
      "lunch",
    );
    expect(dishes.length).toBeGreaterThan(0);
  });

  it("discovers every slot in the profile", async () => {
    const bySlot = await agentOnMock().discoverForProfile(makeProfile());
    expect(Object.keys(bySlot).sort()).toEqual(["dinner", "lunch"]);
    expect(bySlot.lunch!.length).toBeGreaterThan(0);
    expect(bySlot.dinner!.length).toBeGreaterThan(0);
  });
});
