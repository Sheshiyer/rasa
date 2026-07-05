import { describe, it, expect } from "vitest";
import { defaultPortionG } from "./portion-table";

describe("portion-heuristic table", () => {
  it("returns per-type default grams", () => {
    expect(defaultPortionG("curry")).toBe(200);
    expect(defaultPortionG("paratha")).toBe(100);
    expect(defaultPortionG("biryani")).toBe(330);
    expect(defaultPortionG("dal")).toBe(180);
    expect(defaultPortionG("bowl")).toBe(350);
  });

  it("falls back to a sane default for 'other'", () => {
    expect(defaultPortionG("other")).toBe(250);
  });
});
