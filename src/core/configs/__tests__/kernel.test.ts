import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineConfig, loadConfig } from "../kernel";
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
