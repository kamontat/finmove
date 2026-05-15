import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { ConfigFileMissingError, ConfigParseError } from "../errors";
import {
	readTripConfig,
	readTripConfigVersion,
	writeTripConfig,
} from "../trip/io";
import { tripV0ToV1 } from "../trip/migrations/v0_to_v1";
import { tripV0Schema } from "../trip/schemas/v0";
import { tripV1Schema } from "../trip/schemas/v1";

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
