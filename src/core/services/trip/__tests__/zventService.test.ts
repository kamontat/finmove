import { describe, expect, test } from "bun:test";
import { buildZventTag } from "../buildZventTag";
import { parseZventId } from "../parseZventId";

describe("parseZventId", () => {
	test("returns id for well-formed Zvent tag", () => {
		expect(parseZventId("Zvent: 042 Foo (Jan 2026)")).toBe("042");
	});

	test("returns null for 1-digit id", () => {
		expect(parseZventId("Zvent: 5 Foo")).toBeNull();
	});

	test("returns null for 4-digit id", () => {
		expect(parseZventId("Zvent: 0001 Foo")).toBeNull();
	});

	test("returns null for non-Zvent tag", () => {
		expect(parseZventId("food")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(parseZventId("")).toBeNull();
	});
});

describe("buildZventTag", () => {
	test("formats id, name, month, year", () => {
		expect(buildZventTag("003", "Japan", "2026-05-12")).toBe(
			"Zvent: 003 Japan (May 2026)",
		);
	});

	test("uses Jan for January", () => {
		expect(buildZventTag("001", "Foo", "2026-01-01")).toBe(
			"Zvent: 001 Foo (Jan 2026)",
		);
	});

	test("uses Dec for December", () => {
		expect(buildZventTag("999", "Bar", "2025-12-31")).toBe(
			"Zvent: 999 Bar (Dec 2025)",
		);
	});

	test("preserves spaces and unicode in trip name", () => {
		expect(buildZventTag("050", "ทริปญี่ปุ่น", "2026-06-15")).toBe(
			"Zvent: 050 ทริปญี่ปุ่น (Jun 2026)",
		);
	});
});
