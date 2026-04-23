import { describe, expect, test } from "bun:test";
import { daysBetween } from "../daysBetween";

describe("daysBetween", () => {
	test("returns 0 for the same date", () => {
		expect(daysBetween("2026-04-20", "2026-04-20")).toBe(0);
	});

	test("returns positive difference for end after start", () => {
		expect(daysBetween("2026-04-20", "2026-04-25")).toBe(5);
	});

	test("returns negative difference when end is before start", () => {
		expect(daysBetween("2026-04-25", "2026-04-20")).toBe(-5);
	});

	test("handles month boundary", () => {
		expect(daysBetween("2026-04-29", "2026-05-02")).toBe(3);
	});

	test("handles year boundary", () => {
		expect(daysBetween("2025-12-30", "2026-01-02")).toBe(3);
	});
});
