import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { loadTrip } from "../loadTrip";
import { updateSettings } from "../updateSettings";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
	name: "Test Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: { JPY: { exchangeRate: 0.23 } },
	categories: ["Flight", "Hotels"],
	tags: ["test"],
	exportPath: "./expenses.csv",
};

function createFixture(): string {
	const tripDir = join(TEST_DIR, "test-trip");
	mkdirSync(tripDir, { recursive: true });
	writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
	return tripDir;
}

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("updateSettings", () => {
	test("updates simple fields", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { name: "Updated Trip" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.name).toBe("Updated Trip");
		expect(trip.settings.startDate).toBe("2026-05-01"); // unchanged
	});

	test("updates array fields", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { countries: ["Japan", "Korea"] });

		const trip = loadTrip(tripDir);
		expect(trip.settings.countries).toEqual(["Japan", "Korea"]);
	});

	test("updates currencies map", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, {
			currencies: {
				JPY: { exchangeRate: 0.25 },
				USD: { exchangeRate: 35.0 },
			},
		});

		const trip = loadTrip(tripDir);
		expect(trip.settings.currencies).toEqual({
			JPY: { exchangeRate: 0.25 },
			USD: { exchangeRate: 35.0 },
		});
	});

	test("does not modify baseCurrency", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { baseCurrency: "THB" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.baseCurrency).toBe("THB");
	});

	test("preserves fields not included in updates", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { name: "New Name" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.tags).toEqual(["test"]);
		expect(trip.settings.categories).toEqual(["Flight", "Hotels"]);
		expect(trip.settings.currencies).toEqual({
			JPY: { exchangeRate: 0.23 },
		});
	});

	test("round-trips currency config without exchangeRate", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, {
			currencies: {
				JPY: { exchangeRate: 0.23 },
				USD: {},
			},
		});

		const trip = loadTrip(tripDir);
		expect(trip.settings.currencies).toEqual({
			JPY: { exchangeRate: 0.23 },
			USD: {},
		});
		expect(trip.settings.currencies.USD?.exchangeRate).toBeUndefined();
	});
});
