import { describe, expect, test } from "bun:test";
import { convertToTHB } from "../convert-to-thb";

describe("convertToTHB", () => {
  test("returns amount unchanged when currency is THB", () => {
    expect(convertToTHB(100, "THB")).toBe(100);
  });

  test("converts using expense-level exchange rate", () => {
    expect(convertToTHB(2400, "JPY", 0.23)).toBe(552);
  });

  test("falls back to trip-level exchange rate", () => {
    expect(convertToTHB(1000, "KRW", undefined, 0.027)).toBe(27);
  });

  test("prefers expense rate over trip rate", () => {
    expect(convertToTHB(100, "JPY", 0.25, 0.23)).toBe(25);
  });

  test("throws when no exchange rate available for foreign currency", () => {
    expect(() => convertToTHB(100, "JPY")).toThrow(
      "No exchange rate available for JPY"
    );
  });

  test("rounds to 2 decimal places", () => {
    expect(convertToTHB(333, "KRW", 0.027)).toBe(8.99);
  });
});
