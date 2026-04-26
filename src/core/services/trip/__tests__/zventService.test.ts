import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { buildZventTag } from "../buildZventTag";
import { nextZventId } from "../nextZventId";
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

const TEST_DIR = join(import.meta.dir, "__fixtures__");

function makeTrip(dirName: string, tags: string[]) {
	const tripDir = join(TEST_DIR, dirName);
	mkdirSync(tripDir, { recursive: true });
	const settings: Settings = {
		name: dirName,
		startDate: "2026-01-01",
		endDate: "2026-01-07",
		countries: [],
		baseCurrency: "THB",
		currencies: {},
		categories: [],
		tags,
		exportPath: "./expenses.csv",
	};
	writeFileSync(join(tripDir, "settings.yaml"), stringify(settings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
}

describe("nextZventId", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	test("returns 001 for empty data dir", () => {
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("returns 001 when no trip has a Zvent tag", () => {
		makeTrip("trip-a", ["food", "hotel"]);
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("returns max + 1 across multiple trips", () => {
		makeTrip("trip-a", ["Zvent: 005 A (Jan 2026)"]);
		makeTrip("trip-b", ["Zvent: 012 B (Feb 2026)"]);
		makeTrip("trip-c", ["Zvent: 003 C (Mar 2026)"]);
		expect(nextZventId(TEST_DIR)).toBe("013");
	});

	test("ignores malformed Zvent-like tags", () => {
		makeTrip("trip-a", ["Zvent: 5 A", "Zvent: 0001 A"]);
		expect(nextZventId(TEST_DIR)).toBe("001");
	});

	test("clamps at 999", () => {
		makeTrip("trip-a", ["Zvent: 999 A (Jan 2026)"]);
		expect(nextZventId(TEST_DIR)).toBe("999");
	});

	test("returns 001 when data dir does not exist", () => {
		expect(nextZventId(join(TEST_DIR, "missing"))).toBe("001");
	});
});
