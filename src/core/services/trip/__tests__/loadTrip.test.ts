import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { loadTrip } from "../loadTrip";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

function writeTrip(tripDir: string, settings: unknown): void {
	mkdirSync(tripDir, { recursive: true });
	writeFileSync(join(tripDir, "settings.yaml"), stringify(settings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
}

const baseSettings = {
	name: "Test Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: {},
	categories: ["Food"],
	exportPath: "./expenses.csv",
};

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loadTrip — tag normalization", () => {
	test("converts legacy string tags to Tag objects in memory", () => {
		const tripDir = join(TEST_DIR, "legacy");
		writeTrip(tripDir, { ...baseSettings, tags: ["business", "personal"] });

		const trip = loadTrip(tripDir);

		expect(trip.settings.tags).toEqual([
			{ value: "business", default: false },
			{ value: "personal", default: false },
		]);
	});

	test("rewrites settings.yaml when legacy tags are normalized", () => {
		const tripDir = join(TEST_DIR, "legacy-rewrite");
		writeTrip(tripDir, { ...baseSettings, tags: ["biz"] });

		loadTrip(tripDir);

		const reparsed = parse(readFileSync(join(tripDir, "settings.yaml"), "utf-8"));
		expect(reparsed.tags).toEqual([{ value: "biz", default: false }]);
	});

	test("leaves settings.yaml untouched when tags are already in the new shape", () => {
		const tripDir = join(TEST_DIR, "modern");
		const modernTags = [{ value: "biz", default: true }];
		writeTrip(tripDir, { ...baseSettings, tags: modernTags });

		const before = readFileSync(join(tripDir, "settings.yaml"), "utf-8");
		const trip = loadTrip(tripDir);
		const after = readFileSync(join(tripDir, "settings.yaml"), "utf-8");

		expect(trip.settings.tags).toEqual(modernTags);
		expect(after).toBe(before);
	});

	test("handles empty tag arrays without rewriting", () => {
		const tripDir = join(TEST_DIR, "empty");
		writeTrip(tripDir, { ...baseSettings, tags: [] });

		const before = readFileSync(join(tripDir, "settings.yaml"), "utf-8");
		const trip = loadTrip(tripDir);
		const after = readFileSync(join(tripDir, "settings.yaml"), "utf-8");

		expect(trip.settings.tags).toEqual([]);
		expect(after).toBe(before);
	});
});
