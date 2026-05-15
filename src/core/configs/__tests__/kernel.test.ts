import { describe, expect, test } from "bun:test";
import { ZodError, z } from "zod";
import {
	ConfigMigrateError,
	ConfigNoMigrationPathError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "../errors";
import { defineConfig, loadConfig, saveConfig } from "../kernel";
import type { ConfigRaw } from "../types";

function makeStaticDef<L extends number>(opts: {
	latestVersion: L;
	schemas: Record<number, z.ZodTypeAny>;
	migrations?: Record<number, Record<number, (x: unknown) => unknown>>;
	raw: ConfigRaw;
	version: number;
	writes?: ConfigRaw[];
}) {
	const schemaEntries: Record<
		number,
		{
			schema: z.ZodTypeAny;
			migrations?: Record<number, (x: unknown) => unknown>;
		}
	> = {};
	for (const [v, schema] of Object.entries(opts.schemas)) {
		schemaEntries[Number(v)] = {
			schema,
			migrations: opts.migrations?.[Number(v)],
		};
	}
	return defineConfig({
		name: "test",
		latestVersion: opts.latestVersion,
		schemas: schemaEntries as never,
		readConfig: () => opts.raw,
		writeConfig: (_loc, data) => {
			opts.writes?.push(data);
		},
		parseVersion: () => opts.version,
	});
}

describe("loadConfig — happy path with no migration", () => {
	test("returns data parsed by the latest schema", () => {
		const writes: ConfigRaw[] = [];
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 1: z.object({ value: z.string() }) },
			raw: { value: "hello" },
			version: 1,
			writes,
		});

		const result = loadConfig(def, "/fake");

		expect(result.data).toEqual({ value: "hello" });
		expect(result.migrated).toBe(false);
		expect(result.fromVersion).toBe(1);
		expect(result.toVersion).toBe(1);
		expect(writes).toEqual([]);
	});
});

describe("loadConfig — stepwise migration", () => {
	test("walks v0 -> v1 -> v2 when only stepwise migrations exist", () => {
		const writes: ConfigRaw[] = [];
		const v0 = z.object({ name: z.string() });
		const v1 = z.object({ name: z.string(), tag: z.string() });
		const v2 = z.object({
			name: z.string(),
			tag: z.string(),
			version: z.literal(2),
		});

		const def = makeStaticDef({
			latestVersion: 2,
			schemas: { 0: v0, 1: v1, 2: v2 },
			migrations: {
				0: { 1: (x) => ({ ...(x as object), tag: "" }) },
				1: { 2: (x) => ({ ...(x as object), version: 2 }) },
			},
			raw: { name: "trip" },
			version: 0,
			writes,
		});

		const result = loadConfig(def, "/fake");

		expect(result.data).toEqual({ name: "trip", tag: "", version: 2 });
		expect(result.migrated).toBe(true);
		expect(result.fromVersion).toBe(0);
		expect(result.toVersion).toBe(2);
		expect(writes).toEqual([{ name: "trip", tag: "", version: 2 }]);
	});
});

describe("loadConfig — greedy migration selection", () => {
	test("picks the highest available target <= latest", () => {
		const writes: ConfigRaw[] = [];
		const v0 = z.object({ name: z.string() });
		const v1 = z.object({ name: z.string(), via: z.literal("v1") });
		const v3 = z.object({ name: z.string(), via: z.literal("v3") });

		const def = makeStaticDef({
			latestVersion: 3,
			schemas: { 0: v0, 1: v1, 3: v3 },
			migrations: {
				0: {
					1: (x) => ({ ...(x as object), via: "v1" }),
					3: (x) => ({ ...(x as object), via: "v3" }),
				},
			},
			raw: { name: "trip" },
			version: 0,
			writes,
		});

		const result = loadConfig(def, "/fake");

		expect(result.data).toEqual({ name: "trip", via: "v3" });
		expect(result.toVersion).toBe(3);
		expect(writes).toEqual([{ name: "trip", via: "v3" }]);
	});

	test("falls back to a smaller jump when the bigger target exceeds latest", () => {
		const writes: ConfigRaw[] = [];
		const v0 = z.object({ name: z.string() });
		const v1 = z.object({ name: z.string(), via: z.literal("v1") });
		const v3 = z.object({ name: z.string(), via: z.literal("v3") });

		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 0: v0, 1: v1, 3: v3 },
			migrations: {
				0: {
					1: (x) => ({ ...(x as object), via: "v1" }),
					3: (x) => ({ ...(x as object), via: "v3" }),
				},
			},
			raw: { name: "trip" },
			version: 0,
			writes,
		});

		const result = loadConfig(def, "/fake");

		expect(result.data).toEqual({ name: "trip", via: "v1" });
		expect(result.toVersion).toBe(1);
	});
});

describe("loadConfig — error paths", () => {
	test("throws ConfigUnknownVersionError when on-disk version exceeds latest", () => {
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 0: z.object({}), 1: z.object({}) },
			raw: {},
			version: 5,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigUnknownVersionError);
	});

	test("throws ConfigUnknownVersionError when version is missing from schemas", () => {
		const def = makeStaticDef({
			latestVersion: 2,
			schemas: { 0: z.object({}), 2: z.object({}) },
			raw: {},
			version: 1,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigUnknownVersionError);
	});

	test("throws ConfigValidateError when data fails the current version's schema", () => {
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 1: z.object({ name: z.string() }) },
			raw: { name: 42 },
			version: 1,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigValidateError);
	});

	test("throws ConfigValidateError on the post-migration iteration when a migration produces an invalid shape", () => {
		const v0 = z.object({ x: z.number() });
		const v1 = z.object({ x: z.string() });
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 0: v0, 1: v1 },
			migrations: { 0: { 1: (x) => x } },
			raw: { x: 1 },
			version: 0,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigValidateError);
	});

	test("throws ConfigMigrateError when a migration function throws", () => {
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 0: z.object({}), 1: z.object({}) },
			migrations: {
				0: {
					1: () => {
						throw new Error("boom");
					},
				},
			},
			raw: {},
			version: 0,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigMigrateError);
	});

	test("throws ConfigNoMigrationPathError when an intermediate version has no path forward", () => {
		const def = makeStaticDef({
			latestVersion: 2,
			schemas: { 0: z.object({}), 1: z.object({}), 2: z.object({}) },
			migrations: {
				0: { 1: (x) => x },
			},
			raw: {},
			version: 0,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigNoMigrationPathError);
	});
});

describe("saveConfig", () => {
	test("writes valid data via writeConfig", () => {
		const writes: ConfigRaw[] = [];
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 1: z.object({ name: z.string() }) },
			raw: {},
			version: 1,
			writes,
		});

		saveConfig(def, "/fake", { name: "ok" });

		expect(writes).toEqual([{ name: "ok" }]);
	});

	test("throws ZodError when data does not match the latest schema", () => {
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 1: z.object({ name: z.string() }) },
			raw: {},
			version: 1,
		});

		// biome-ignore lint/suspicious/noExplicitAny: testing rejection
		expect(() => saveConfig(def, "/fake", { name: 42 as any })).toThrow(
			ZodError,
		);
	});
});
