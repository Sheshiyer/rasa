import { describe, it, expect } from "vitest";
import { parseQuantity } from "./canonicalize";

describe("parseQuantity", () => {
  it("pulls a leading count off a dish name", () => {
    expect(parseQuantity("2 Aloo Paratha")).toEqual({
      quantity: 2,
      name: "Aloo Paratha",
    });
  });

  it("handles an 'Nx' count", () => {
    expect(parseQuantity("2x Roti")).toEqual({ quantity: 2, name: "Roti" });
  });

  it("defaults to quantity 1 when there is no count", () => {
    expect(parseQuantity("Paneer Butter Masala")).toEqual({
      quantity: 1,
      name: "Paneer Butter Masala",
    });
  });

  it("trims extra whitespace", () => {
    expect(parseQuantity("3   Idli")).toEqual({ quantity: 3, name: "Idli" });
  });

  it("does not treat a number inside the name as a count", () => {
    expect(parseQuantity("7Up Drink")).toEqual({
      quantity: 1,
      name: "7Up Drink",
    });
  });
});
