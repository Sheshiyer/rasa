import { describe, it, expect } from "vitest";
import { CandidateDishSchema, type PreferenceProfile } from "@rasa/shared";
import { createMockSwiggyMcp } from "../mcp/mock-swiggy-mcp";
import { createSwiggyTools } from "../mcp/swiggy-tools";
import type { McpTransport } from "../mcp/transport";
import { createSwiggyAdapter } from "./swiggy-adapter";

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
    slots: [{ name: "lunch", window: "12:30-13:30" }],
    budget_monthly_inr: 9000,
    calorie_target: 2000,
    macro_target: { protein_g: 120, carb_g: 200, fat_g: 60 },
    variety_tolerance: "medium",
    source_prefs: ["swiggy"],
    ...overrides,
  };
}

const adapterOnMock = (transport: McpTransport = createMockSwiggyMcp()) =>
  createSwiggyAdapter(createSwiggyTools({ transport, backoffMs: () => 0 }));

const input = (profile: PreferenceProfile) => ({
  profile,
  addressId: "addr-koramangala",
  slot: "lunch",
});

describe("SwiggyAdapter", () => {
  it("has source 'swiggy'", () => {
    expect(adapterOnMock().source).toBe("swiggy");
  });

  it("lists delivery addresses", async () => {
    const addrs = await adapterOnMock().listDeliveryAddresses();
    expect(addrs.map((a) => a.id)).toContain("addr-koramangala");
  });

  it("discover() returns valid CandidateDish[] with source swiggy and no macros yet", async () => {
    const dishes = await adapterOnMock().discover(input(makeProfile()));
    expect(dishes.length).toBeGreaterThan(0);
    for (const d of dishes) {
      expect(() => CandidateDishSchema.parse(d)).not.toThrow();
      expect(d.source).toBe("swiggy");
      expect(d.macros).toBeUndefined();
      expect(d.deliverable_to_address).toBe(true);
    }
  });

  it("hard-blocks allergen-named dishes (peanut)", async () => {
    const dishes = await adapterOnMock().discover(
      input(makeProfile({ allergens: ["peanut"] })),
    );
    expect(dishes.some((d) => d.dish_id === "d-padthai")).toBe(false); // "crushed peanuts"
    expect(dishes.some((d) => d.dish_id === "d-chicken")).toBe(true);
  });

  it("returns only vegetarian dishes for a veg profile", async () => {
    const dishes = await adapterOnMock().discover(
      input(makeProfile({ diet_type: "veg" })),
    );
    expect(dishes.length).toBeGreaterThan(0);
    expect(dishes.every((d) => d.is_veg)).toBe(true);
  });

  it("dedupes by (restaurant_id, dish_id)", async () => {
    // A transport that returns the same restaurant twice from search.
    const inner = createMockSwiggyMcp();
    const dupSearch: McpTransport = {
      async callTool(name, args) {
        if (name === "search_restaurants") {
          const r = (await inner.callTool(name, args)) as {
            restaurants: unknown[];
          };
          return { restaurants: [r.restaurants[0], r.restaurants[0]] }; // duplicate
        }
        return inner.callTool(name, args);
      },
    };
    const dishes = await adapterOnMock(dupSearch).discover(
      input(makeProfile()),
    );
    const keys = dishes.map((d) => `${d.restaurant_id}:${d.dish_id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rejects discovery against an unknown delivery address", async () => {
    await expect(
      adapterOnMock().discover({
        profile: makeProfile(),
        addressId: "addr-unknown",
        slot: "lunch",
      }),
    ).rejects.toThrow();
  });
});
