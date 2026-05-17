import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { backupTrip } from "../backupTrip";
import { loadTrip } from "../loadTrip";

const TEST_DIR = join(import.meta.dir, "__fixtures__backup");

function writeTrip(dataDir: string, dirName: string, settings: Settings): void {
	const dir = join(dataDir, dirName);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "settings.yaml"), stringify(settings));
	writeFileSync(join(dir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(dir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(dir, "expenses.yaml"), stringify({ expenses: [] }));
}

function makeSettings(name: string): Settings {
	return {
		version: 1,
		name,
		startDate: "2026-05-01",
		endDate: "2026-05-07",
		countries: ["Japan"],
		baseCurrency: "THB",
		currencies: { JPY: { exchangeRate: 0.23 } },
		categories: ["Food"],
		tags: [],
		exportPath: "./out.csv",
	};
}

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("backupTrip", () => {
	test("creates (Backup v1) when no backups exist", () => {
		writeTrip(TEST_DIR, "source-2026", makeSettings("Source"));

		const trip = backupTrip(TEST_DIR, join(TEST_DIR, "source-2026"));

		expect(trip.settings.name).toBe("Source (Backup v1)");
		expect(trip.dirPath).toBe(join(TEST_DIR, "source-backup-v1-2026"));
		expect(existsSync(join(TEST_DIR, "source-backup-v1-2026"))).toBe(true);
	});

	test("increments to v2 when v1 already exists", () => {
		writeTrip(TEST_DIR, "source-2026", makeSettings("Source"));
		writeTrip(
			TEST_DIR,
			"source-backup-v1-2026",
			makeSettings("Source (Backup v1)"),
		);

		const trip = backupTrip(TEST_DIR, join(TEST_DIR, "source-2026"));

		expect(trip.settings.name).toBe("Source (Backup v2)");
	});

	test("strips existing (Backup vN) suffix and increments from v1", () => {
		writeTrip(TEST_DIR, "source-2026", makeSettings("Source"));
		writeTrip(
			TEST_DIR,
			"source-backup-v1-2026",
			makeSettings("Source (Backup v1)"),
		);

		const trip = backupTrip(TEST_DIR, join(TEST_DIR, "source-backup-v1-2026"));

		expect(trip.settings.name).toBe("Source (Backup v2)");
	});

	test("uses lowest unused N (fills gaps)", () => {
		writeTrip(TEST_DIR, "source-2026", makeSettings("Source"));
		writeTrip(
			TEST_DIR,
			"source-backup-v3-2026",
			makeSettings("Source (Backup v3)"),
		);

		const trip = backupTrip(TEST_DIR, join(TEST_DIR, "source-2026"));

		expect(trip.settings.name).toBe("Source (Backup v1)");
	});

	test("preserves source dates and countries", () => {
		writeTrip(TEST_DIR, "source-2026", {
			...makeSettings("Source"),
			countries: ["Japan", "Korea"],
		});

		const trip = backupTrip(TEST_DIR, join(TEST_DIR, "source-2026"));

		expect(trip.settings.startDate).toBe("2026-05-01");
		expect(trip.settings.endDate).toBe("2026-05-07");
		expect(trip.settings.countries).toEqual(["Japan", "Korea"]);
	});

	test("copies non-settings files from source", () => {
		writeTrip(TEST_DIR, "source-2026", makeSettings("Source"));
		writeFileSync(
			join(TEST_DIR, "source-2026", "owners.yaml"),
			stringify({ owners: [{ id: "o1", name: "Alice" }] }),
		);

		backupTrip(TEST_DIR, join(TEST_DIR, "source-2026"));

		const loaded = loadTrip(join(TEST_DIR, "source-backup-v1-2026"));
		expect(loaded.owners).toHaveLength(1);
		expect(loaded.owners[0]?.name).toBe("Alice");
	});
});
