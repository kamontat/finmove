import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { createTrip } from "../createTrip";
import { duplicateTrip } from "../duplicateTrip";
import { listTrips } from "../listTrips";
import { loadTrip } from "../loadTrip";
import { toDirName } from "../toDirName";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
	version: 1,
	name: "Test Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: { JPY: { exchangeRate: 0.23 } },
	categories: [
		"Flight",
		"Hotels",
		"Transportation",
		"Shopping",
		"Eating",
		"Activities",
	],
	tags: [{ value: "test", default: false }],
	exportPath: "./expenses.csv",
};

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("listTrips", () => {
	test("returns empty array when no trips exist", () => {
		const trips = listTrips(TEST_DIR);
		expect(trips).toEqual([]);
	});

	test("lists trip directories that contain settings.yaml", () => {
		const tripDir = join(TEST_DIR, "japan");
		mkdirSync(tripDir, { recursive: true });
		writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
		writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));

		const trips = listTrips(TEST_DIR);
		expect(trips).toHaveLength(1);
		expect(trips[0].settings.name).toBe("Test Trip");
	});
});

describe("loadTrip", () => {
	test("loads a trip from a directory", () => {
		const tripDir = join(TEST_DIR, "japan");
		mkdirSync(tripDir, { recursive: true });
		writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
		writeFileSync(
			join(tripDir, "owners.yaml"),
			stringify({ owners: [{ id: "alice", name: "Alice" }] }),
		);
		writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));

		const trip = loadTrip(tripDir);
		expect(trip.settings.name).toBe("Test Trip");
		expect(trip.owners).toHaveLength(1);
		expect(trip.owners[0].name).toBe("Alice");
		expect(trip.dirPath).toBe(tripDir);
	});
});

describe("toDirName", () => {
	test("creates slug from trip name and year", () => {
		expect(toDirName("Japan Trip", "2026-05-01")).toBe("japan-trip-2026");
	});

	test("strips non-alphanumeric characters", () => {
		expect(toDirName("Bob's Trip!!", "2026-01-01")).toBe("bob-s-trip-2026");
	});

	test("collapses multiple separators", () => {
		expect(toDirName("  Japan & Korea  ", "2026-03-15")).toBe(
			"japan-korea-2026",
		);
	});

	test("handles single word", () => {
		expect(toDirName("Korea", "2025-12-01")).toBe("korea-2025");
	});
});

describe("createTrip", () => {
	test("creates a trip directory with YAML files", () => {
		const trip = createTrip(TEST_DIR, "korea", sampleSettings);
		expect(trip.settings.name).toBe("Test Trip");
		expect(trip.owners).toEqual([]);
		expect(trip.accounts).toEqual([]);
		expect(trip.expenses).toEqual([]);

		// Verify it can be loaded back
		const loaded = loadTrip(join(TEST_DIR, "korea"));
		expect(loaded.settings.name).toBe("Test Trip");
	});
});

describe("duplicateTrip", () => {
	const FIXTURE_DIR = join(import.meta.dir, "__fixtures__duplicate");
	const sourceDirName = "source-trip-2026";
	const sourcePath = join(FIXTURE_DIR, sourceDirName);

	beforeEach(() => {
		mkdirSync(sourcePath, { recursive: true });
		const sourceSettings: Settings = {
			version: 1,
			name: "Source Trip",
			startDate: "2026-01-01",
			endDate: "2026-01-07",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: { JPY: { exchangeRate: 0.23 } },
			categories: ["Food", "Transport"],
			tags: [{ value: "business", default: false }],
			exportPath: "./out.csv",
		};
		writeFileSync(join(sourcePath, "settings.yaml"), stringify(sourceSettings));
		writeFileSync(join(sourcePath, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(
			join(sourcePath, "accounts.yaml"),
			stringify({ accounts: [] }),
		);
		writeFileSync(
			join(sourcePath, "expenses.yaml"),
			stringify({ expenses: [] }),
		);
	});

	afterEach(() => {
		rmSync(FIXTURE_DIR, { recursive: true, force: true });
	});

	test("applies all four overrides to settings.yaml", () => {
		const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-2026", {
			name: "Dup Trip",
			startDate: "2026-02-01",
			endDate: "2026-02-10",
			countries: ["Japan", "Korea"],
		});

		expect(trip.settings.name).toBe("Dup Trip");
		expect(trip.settings.startDate).toBe("2026-02-01");
		expect(trip.settings.endDate).toBe("2026-02-10");
		expect(trip.settings.countries).toEqual(["Japan", "Korea"]);
	});

	test("preserves baseCurrency, currencies, categories, tags, exportPath from source", () => {
		const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-preserve", {
			name: "Dup Preserve",
			startDate: "2026-03-01",
			endDate: "2026-03-05",
			countries: [],
		});

		expect(trip.settings.baseCurrency).toBe("THB");
		expect(trip.settings.currencies).toEqual({ JPY: { exchangeRate: 0.23 } });
		expect(trip.settings.categories).toEqual(["Food", "Transport"]);
		expect(trip.settings.tags).toEqual([{ value: "business", default: false }]);
		expect(trip.settings.exportPath).toBe("./out.csv");
	});

	test("copies non-settings files from source", () => {
		// Write a non-empty owners file in source to confirm dir copy
		writeFileSync(
			join(sourcePath, "owners.yaml"),
			stringify({ owners: [{ id: "o1", name: "Alice" }] }),
		);

		const trip = duplicateTrip(FIXTURE_DIR, sourcePath, "dup-trip-copy", {
			name: "Dup Copy",
			startDate: "2026-04-01",
			endDate: "2026-04-05",
			countries: [],
		});

		expect(trip.owners).toHaveLength(1);
		expect(trip.owners[0]?.name).toBe("Alice");
	});
});
