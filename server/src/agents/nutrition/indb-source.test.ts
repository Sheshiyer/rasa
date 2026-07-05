import { describe, it, expect } from "vitest";
import { createIndbSource } from "./indb-source";

describe("IndbSource", () => {
  const src = createIndbSource();

  it("looks up per-100g macros for a seeded dish", async () => {
    const m = await src.lookupPer100g("grilled-chicken-bowl");
    expect(m).not.toBeNull();
    expect(m!.protein_g).toBeGreaterThan(0);
    expect(m!.cal).toBeGreaterThan(0);
  });

  it("normalizes ids (case + separators) before matching", async () => {
    const m = await src.lookupPer100g("Paneer_Butter_Masala");
    expect(m).not.toBeNull();
  });

  it("returns null for an unknown dish", async () => {
    expect(await src.lookupPer100g("dragon-fire-mystery")).toBeNull();
  });

  it("reports its source name", () => {
    expect(src.name).toBe("indb");
  });
});
