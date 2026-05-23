import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { ConfigFileMissingError, ConfigParseError } from "../errors";
import { loadConfig } from "../kernel";
import { tripConfig } from "../trip";
import {
	readTripConfig,
	readTripConfigVersion,
	writeTripConfig,
} from "../trip/io";
import { tripV0ToV1 } from "../trip/migrations/v0_to_v1";
import { tripV1ToV2 } from "../trip/migrations/v1_to_v2";
import { tripV0Schema } from "../trip/schemas/v0";
import { tripV1Schema } from "../trip/schemas/v1";
import { tripV2Schema } from "../trip/schemas/v2";

const baseV0Settings = {
	name: "Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB" as const,
	currencies: {},
	categories: ["Food"],
	exportPath: "./expenses.csv",
};

describe("tripV0ToV1 migration", () => {
	test("stamps version: 1 and normalizes string tags", () => {
		const input = tripV0Schema.parse({
			settings: { ...baseV0Settings, tags: ["work", "fun"] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.version).toBe(1);
		expect(out.settings.tags).toEqual([
			{ value: "work", default: false },
			{ value: "fun", default: false },
		]);
		expect(() => tripV1Schema.parse(out)).not.toThrow();
	});

	test("passes through already-normalized Tag objects", () => {
		const input = tripV0Schema.parse({
			settings: {
				...baseV0Settings,
				tags: [{ value: "biz", default: true }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.tags).toEqual([{ value: "biz", default: true }]);
	});

	test("handles missing tags as empty array", () => {
		const input = tripV0Schema.parse({
			settings: { ...baseV0Settings },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.tags).toEqual([]);
		expect(out.settings.version).toBe(1);
	});
});

const baseV1Settings = {
	version: 1 as const,
	name: "Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB" as const,
	currencies: {},
	tags: [],
	exportPath: "./expenses.csv",
};

describe("tripV1ToV2 migration", () => {
	test("stamps version: 2 and normalizes string categories", () => {
		const input = tripV1Schema.parse({
			settings: { ...baseV1Settings, categories: ["Food", "Hotels"] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.version).toBe(2);
		expect(out.settings.categories).toEqual([
			{ value: "Food", excluded: false },
			{ value: "Hotels", excluded: false },
		]);
		expect(() => tripV2Schema.parse(out)).not.toThrow();
	});

	test("passes through already-normalized Category objects", () => {
		const input = tripV1Schema.parse({
			settings: {
				...baseV1Settings,
				categories: [{ value: "Food", excluded: true }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.categories).toEqual([
			{ value: "Food", excluded: true },
		]);
	});

	test("handles empty categories", () => {
		const input = tripV1Schema.parse({
			settings: { ...baseV1Settings, categories: [] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV1ToV2(input);

		expect(out.settings.categories).toEqual([]);
		expect(out.settings.version).toBe(2);
	});
});

const TEST_DIR = join(import.meta.dir, "__fixtures-io__");

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeTripFiles(dir: string, body: Record<string, unknown>): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "settings.yaml"), stringify(body.settings));
	writeFileSync(join(dir, "owners.yaml"), stringify({ owners: body.owners }));
	writeFileSync(
		join(dir, "accounts.yaml"),
		stringify({ accounts: body.accounts }),
	);
	writeFileSync(
		join(dir, "expenses.yaml"),
		stringify({ expenses: body.expenses }),
	);
}

describe("readTripConfig / writeTripConfig round-trip", () => {
	test("read then write produces equivalent file contents", () => {
		const dir = join(TEST_DIR, "round-trip");
		const body = {
			settings: { ...baseV0Settings, version: 1, tags: [] },
			owners: [{ id: "a", name: "A" }],
			accounts: [],
			expenses: [],
		};
		writeTripFiles(dir, body);

		const raw = readTripConfig(dir);

		expect(raw).toEqual(body);

		const dir2 = join(TEST_DIR, "round-trip-2");
		mkdirSync(dir2, { recursive: true });
		writeTripConfig(dir2, raw);

		const reread = readTripConfig(dir2);
		expect(reread).toEqual(body);
	});
});

describe("readTripConfigVersion", () => {
	test("returns version number from settings", () => {
		expect(
			readTripConfigVersion({
				settings: { version: 1 },
				owners: [],
				accounts: [],
				expenses: [],
			}),
		).toBe(1);
	});

	test("returns 0 when version is missing", () => {
		expect(
			readTripConfigVersion({
				settings: {},
				owners: [],
				accounts: [],
				expenses: [],
			}),
		).toBe(0);
	});

	test("returns 0 when settings is missing", () => {
		expect(
			readTripConfigVersion({ owners: [], accounts: [], expenses: [] }),
		).toBe(0);
	});
});

describe("readTripConfig — errors", () => {
	test("throws ConfigFileMissingError when settings.yaml is absent", () => {
		const dir = join(TEST_DIR, "missing-settings");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(dir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(dir, "expenses.yaml"), stringify({ expenses: [] }));

		expect(() => readTripConfig(dir)).toThrow(ConfigFileMissingError);
	});

	test("throws ConfigParseError when YAML is malformed", () => {
		const dir = join(TEST_DIR, "malformed");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "settings.yaml"), ": : invalid yaml [[[");
		writeFileSync(join(dir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(dir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(dir, "expenses.yaml"), stringify({ expenses: [] }));

		expect(() => readTripConfig(dir)).toThrow(ConfigParseError);
	});
});

describe("loadConfig with tripConfig — end-to-end", () => {
	test("loads a v2 trip without migration", () => {
		const dir = join(TEST_DIR, "v2-trip");
		writeTripFiles(dir, {
			settings: {
				...baseV0Settings,
				version: 2,
				categories: [{ value: "Food", excluded: false }],
				tags: [{ value: "biz", default: false }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const result = loadConfig(tripConfig, dir);

		expect(result.migrated).toBe(false);
		expect(result.data.settings.version).toBe(2);
		expect(result.data.settings.tags).toEqual([
			{ value: "biz", default: false },
		]);
	});

	test("migrates a v0 trip with string tags to v2 and rewrites settings.yaml", () => {
		const dir = join(TEST_DIR, "v0-trip");
		writeTripFiles(dir, {
			settings: { ...baseV0Settings, tags: ["work", "fun"] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const result = loadConfig(tripConfig, dir);

		expect(result.migrated).toBe(true);
		expect(result.fromVersion).toBe(0);
		expect(result.toVersion).toBe(2);
		expect(result.data.settings.version).toBe(2);

		const reparsed = parse(readFileSync(join(dir, "settings.yaml"), "utf-8"));
		expect(reparsed.version).toBe(2);
		expect(reparsed.tags).toEqual([
			{ value: "work", default: false },
			{ value: "fun", default: false },
		]);
		expect(reparsed.categories).toEqual([
			{ value: "Food", excluded: false },
		]);
	});

	test("leaves a v2 settings.yaml byte-identical on load", () => {
		const dir = join(TEST_DIR, "v2-untouched");
		writeTripFiles(dir, {
			settings: {
				...baseV0Settings,
				version: 2,
				categories: [{ value: "Food", excluded: false }],
				tags: [],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const before = readFileSync(join(dir, "settings.yaml"), "utf-8");
		loadConfig(tripConfig, dir);
		const after = readFileSync(join(dir, "settings.yaml"), "utf-8");

		expect(after).toBe(before);
	});
});
