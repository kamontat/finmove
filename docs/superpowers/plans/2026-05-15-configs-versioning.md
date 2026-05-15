# Versioned Configs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `src/core/configs/` as a generic, versioned, zod-validated config kernel. First consumer is the trip namespace, which gains a v0→v1 migration that stamps `version: 1` into `settings.yaml` and folds in the existing tag normalization. Broken trips surface in the trip list with a diagnostic screen.

**Architecture:** A small kernel (`loadConfig` / `saveConfig` / `defineConfig`) drives a pipeline of read → version detect → per-version validate → migrate (greedy: largest target ≤ latest) → write. Each namespace declares its own schemas, migrations, and read/write functions. Failures throw typed `ConfigError` subclasses that the TUI catches per-trip to render a "broken" row + diagnostic screen.

**Tech Stack:** TypeScript, Bun (runtime + test runner), zod (new dep) for schemas, React+Ink for the TUI, YAML for storage.

**Spec:** `docs/superpowers/specs/2026-05-15-configs-versioning-design.md`

---

## File Structure

**New files:**
- `src/core/configs/index.ts` — public barrel
- `src/core/configs/kernel.ts` — `loadConfig`, `saveConfig`, `defineConfig`, `chooseNextVersion`
- `src/core/configs/types.ts` — `ConfigDefinition`, `ConfigSchemas`, `ConfigResult`, `ConfigRaw`
- `src/core/configs/errors.ts` — `ConfigError` + subclasses
- `src/core/configs/trip/index.ts` — trip namespace public exports
- `src/core/configs/trip/definition.ts` — `tripConfig = defineConfig({...})`
- `src/core/configs/trip/io.ts` — `readTripConfig`, `readTripConfigVersion`, `writeTripConfig`
- `src/core/configs/trip/schemas/v0.ts` — loose pre-version schema
- `src/core/configs/trip/schemas/v1.ts` — current shape + `version: 1`
- `src/core/configs/trip/migrations/v0_to_v1.ts` — stamp version, normalize tags
- `src/core/configs/__tests__/kernel.test.ts` — generic-kernel behavior
- `src/core/configs/__tests__/trip.test.ts` — trip-namespace round-trip + migration
- `src/core/configs/__tests__/typeCheck.test.ts` — TripV1 ↔ models assignability
- `src/tui/screens/TripBroken.tsx` — diagnostic screen

**Modified files:**
- `package.json` — add `zod` dependency
- `src/core/models/settings.ts` — add `version: 1`
- `src/core/services/trip/loadTrip.ts` — delegate to `loadConfig`
- `src/core/services/trip/createTrip.ts` — delegate to `saveConfig`, stamp `version: 1`
- `src/core/services/trip/listTrips.ts` — return `TripEntry[]` discriminated union
- `src/core/services/trip/index.ts` — re-export `TripEntry`
- `src/tui/screens/TripForm.tsx:151` — stamp `version: 1` when constructing `Settings`
- `src/tui/screens/TripList.tsx` — render broken rows and disable normal actions on them
- `src/tui/router.ts` — register `/trips/broken`
- `src/tui/models/index.ts` — add `/trips/broken` to `RouteParams`

**Test fixtures updated (Settings construction sites):**
- `src/core/validators/__tests__/validators.test.ts:8`
- `src/core/services/expense/__tests__/expenseService.test.ts:14`
- `src/core/services/expense/__tests__/nextExpenseId.test.ts`
- `src/core/services/owner/__tests__/ownerService.test.ts:15`
- `src/core/services/account/__tests__/accountService.test.ts:16`
- `src/core/services/trip/__tests__/updateSettings.test.ts:11`
- `src/core/services/trip/__tests__/sortTrips.test.ts:6`
- `src/core/services/trip/__tests__/tripService.test.ts:14,122`
- `src/core/services/trip/__tests__/loadTrip.test.ts:17`
- `src/core/services/trip/__tests__/getTripStatus.test.ts`
- `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
- `src/core/services/export/__tests__/exportCsv.test.ts`

---

## Task 1: Add zod dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add zod to dependencies**

Run: `bun add zod`
Expected: `zod` appears under `dependencies` in `package.json`, and `bun.lock` updates.

- [ ] **Step 2: Verify zod resolves**

Run: `bun -e "import { z } from 'zod'; console.log(z.string().parse('ok'))"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add zod dependency"
```

---

## Task 2: Add configs/errors.ts

**Files:**
- Create: `src/core/configs/errors.ts`

- [ ] **Step 1: Create the error hierarchy**

Create `src/core/configs/errors.ts`:

```ts
import type { ZodIssue } from "zod";

export class ConfigError extends Error {
	constructor(
		public readonly namespace: string,
		public readonly location: string,
		message: string,
	) {
		super(`[${namespace} @ ${location}] ${message}`);
		this.name = "ConfigError";
	}
}

export class ConfigFileMissingError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly file: string,
	) {
		super(ns, loc, `Required file not found: ${file}`);
		this.name = "ConfigFileMissingError";
	}
}

export class ConfigParseError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly file: string,
		public readonly cause: unknown,
	) {
		const reason = (cause as Error)?.message ?? String(cause);
		super(ns, loc, `Failed to parse ${file}: ${reason}`);
		this.name = "ConfigParseError";
	}
}

export class ConfigValidateError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly version: number,
		public readonly issues: ZodIssue[],
	) {
		const count = issues.length;
		super(
			ns,
			loc,
			`Schema validation failed at v${version} (${count} issue${count === 1 ? "" : "s"})`,
		);
		this.name = "ConfigValidateError";
	}
}

export class ConfigMigrateError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly from: number,
		public readonly to: number,
		public readonly cause: unknown,
	) {
		const reason = (cause as Error)?.message ?? String(cause);
		super(ns, loc, `Migration v${from}→v${to} failed: ${reason}`);
		this.name = "ConfigMigrateError";
	}
}

export class ConfigUnknownVersionError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly version: number,
		public readonly latest: number,
	) {
		super(
			ns,
			loc,
			`Unknown version v${version} (latest supported: v${latest})`,
		);
		this.name = "ConfigUnknownVersionError";
	}
}

export class ConfigNoMigrationPathError extends ConfigError {
	constructor(
		ns: string,
		loc: string,
		public readonly from: number,
		public readonly latest: number,
	) {
		super(ns, loc, `No migration path from v${from} to v${latest}`);
		this.name = "ConfigNoMigrationPathError";
	}
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/errors.ts
git commit -m "feat(core): add ConfigError hierarchy for configs module"
```

---

## Task 3: Add configs/types.ts

**Files:**
- Create: `src/core/configs/types.ts`

- [ ] **Step 1: Create the type definitions**

Create `src/core/configs/types.ts`:

```ts
import type { z } from "zod";

export type ConfigRaw = Record<string, unknown>;

export type ConfigSchemas<S extends Record<number, z.ZodTypeAny>> = {
	[V in keyof S]: {
		schema: S[V];
		migrations?: {
			[Target in Exclude<keyof S, V>]?: (
				current: z.infer<S[V]>,
			) => z.infer<S[Target]>;
		};
	};
};

export type ConfigDefinition<
	Name extends string,
	Schemas extends Record<number, z.ZodTypeAny>,
	LVersion extends keyof Schemas & number,
> = {
	name: Name;
	latestVersion: LVersion;
	schemas: ConfigSchemas<Schemas>;
	readConfig: (location: string) => ConfigRaw;
	writeConfig: (location: string, data: ConfigRaw) => void;
	parseVersion: (raw: ConfigRaw) => number;
};

export type ConfigResult<
	Schemas extends Record<number, z.ZodTypeAny>,
	L extends keyof Schemas,
> = {
	data: z.infer<Schemas[L]>;
	migrated: boolean;
	fromVersion: number;
	toVersion: L;
};
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/types.ts
git commit -m "feat(core): add ConfigDefinition / ConfigSchemas types"
```

---

## Task 4: Kernel — failing test for happy path (no migration needed)

**Files:**
- Create: `src/core/configs/__tests__/kernel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/configs/__tests__/kernel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: FAIL with module-not-found for `../kernel` (kernel.ts doesn't exist yet).

- [ ] **Step 3: Commit the failing test**

```bash
git add src/core/configs/__tests__/kernel.test.ts
git commit -m "test(configs): kernel happy path"
```

---

## Task 5: Kernel — implement minimum to pass happy-path test

**Files:**
- Create: `src/core/configs/kernel.ts`

- [ ] **Step 1: Write the kernel**

Create `src/core/configs/kernel.ts`:

```ts
import type { z } from "zod";
import {
	ConfigMigrateError,
	ConfigNoMigrationPathError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "./errors";
import type { ConfigDefinition, ConfigResult } from "./types";

export function defineConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>): ConfigDefinition<N, S, L> {
	return def;
}

function chooseNextVersion(
	migrations: Record<number, unknown> | undefined,
	from: number,
	latest: number,
): number | null {
	if (!migrations) return null;
	const candidates = Object.keys(migrations)
		.map(Number)
		.filter((t) => t > from && t <= latest);
	if (candidates.length === 0) return null;
	return Math.max(...candidates);
}

export function loadConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>, location: string): ConfigResult<S, L> {
	const raw = def.readConfig(location);
	const initialV = def.parseVersion(raw);
	let v = initialV;

	if (v > def.latestVersion || !(v in def.schemas)) {
		throw new ConfigUnknownVersionError(
			def.name,
			location,
			v,
			def.latestVersion,
		);
	}

	let current: unknown = raw;
	// biome-ignore lint/correctness/noConstantCondition: loop exits via break/throw
	while (true) {
		const entry = def.schemas[v];
		const parsed = entry.schema.safeParse(current);
		if (!parsed.success) {
			throw new ConfigValidateError(
				def.name,
				location,
				v,
				parsed.error.issues,
			);
		}
		current = parsed.data;

		if (v === def.latestVersion) break;

		const next = chooseNextVersion(
			entry.migrations as Record<number, unknown> | undefined,
			v,
			def.latestVersion,
		);
		if (next === null) {
			throw new ConfigNoMigrationPathError(
				def.name,
				location,
				v,
				def.latestVersion,
			);
		}

		const migrateFn = (
			entry.migrations as Record<number, (x: unknown) => unknown>
		)[next];
		try {
			current = migrateFn(current);
		} catch (cause) {
			throw new ConfigMigrateError(def.name, location, v, next, cause);
		}
		v = next;
	}

	const migrated = initialV < def.latestVersion;
	if (migrated) {
		saveConfig(def, location, current as z.infer<S[L]>);
	}

	return {
		data: current as z.infer<S[L]>,
		migrated,
		fromVersion: initialV,
		toVersion: def.latestVersion as L,
	};
}

export function saveConfig<
	N extends string,
	S extends Record<number, z.ZodTypeAny>,
	L extends keyof S & number,
>(
	def: ConfigDefinition<N, S, L>,
	location: string,
	data: z.infer<S[L]>,
): void {
	const valid = def.schemas[def.latestVersion].schema.parse(data) as Record<
		string,
		unknown
	>;
	def.writeConfig(location, valid);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: PASS (1 test, 1 pass).

- [ ] **Step 3: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/configs/kernel.ts
git commit -m "feat(core): implement configs kernel loadConfig/saveConfig"
```

---

## Task 6: Kernel — stepwise migration test

**Files:**
- Modify: `src/core/configs/__tests__/kernel.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `src/core/configs/__tests__/kernel.test.ts` (before the final `});` that closes the `describe`, or in a new `describe` block):

```ts
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: PASS (2 tests, 2 pass). The kernel already supports this — the test confirms it.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/__tests__/kernel.test.ts
git commit -m "test(configs): stepwise migration through three versions"
```

---

## Task 7: Kernel — greedy jump test

**Files:**
- Modify: `src/core/configs/__tests__/kernel.test.ts`

- [ ] **Step 1: Add the test**

Append a new `describe` block:

```ts
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

		// latest=1: a v0->v3 migration exists but is out of range.
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: PASS (4 tests, 4 pass).

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/__tests__/kernel.test.ts
git commit -m "test(configs): greedy migration target selection"
```

---

## Task 8: Kernel — error path tests

**Files:**
- Modify: `src/core/configs/__tests__/kernel.test.ts`

- [ ] **Step 1: Add the tests**

Append a new `describe` block:

```ts
import {
	ConfigMigrateError,
	ConfigNoMigrationPathError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "../errors";

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
			version: 1, // not in the schema map
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
			migrations: { 0: { 1: (x) => x } }, // bug: doesn't convert x to string
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
				// no migration from v1 to v2
			},
			raw: {},
			version: 0,
		});
		expect(() => loadConfig(def, "/fake")).toThrow(ConfigNoMigrationPathError);
	});
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: PASS (all tests).

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/__tests__/kernel.test.ts
git commit -m "test(configs): kernel error paths"
```

---

## Task 9: Kernel — saveConfig validation test

**Files:**
- Modify: `src/core/configs/__tests__/kernel.test.ts`

- [ ] **Step 1: Add the tests**

At the top of the file, also import `saveConfig` and `ZodError`:

```ts
import { ZodError, z } from "zod";
import { defineConfig, loadConfig, saveConfig } from "../kernel";
```

Append:

```ts
describe("saveConfig", () => {
	test("writes valid data via writeConfig", () => {
		const writes: ConfigRaw[] = [];
		const def = makeStaticDef({
			latestVersion: 1,
			schemas: { 1: z.object({ name: z.string() }) },
			raw: {}, // unused here
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/kernel.test.ts`
Expected: PASS (all tests).

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/__tests__/kernel.test.ts
git commit -m "test(configs): saveConfig validates before write"
```

---

## Task 10: Add configs/index.ts barrel (kernel + errors)

**Files:**
- Create: `src/core/configs/index.ts`

- [ ] **Step 1: Create the public barrel (kernel + errors only for now)**

Create `src/core/configs/index.ts`:

```ts
export { defineConfig, loadConfig, saveConfig } from "./kernel";
export type {
	ConfigDefinition,
	ConfigRaw,
	ConfigResult,
	ConfigSchemas,
} from "./types";
export {
	ConfigError,
	ConfigFileMissingError,
	ConfigMigrateError,
	ConfigNoMigrationPathError,
	ConfigParseError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "./errors";
```

The `tripConfig` / `tripV1Schema` / `TripV1` re-exports get added in Task 16 when the trip namespace is wired up.

- [ ] **Step 2: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/index.ts
git commit -m "feat(core): expose configs public surface"
```

---

## Task 11: Add `version: 1` to Settings model and update fixtures

**Files:**
- Modify: `src/core/models/settings.ts`
- Modify: `src/tui/screens/TripForm.tsx` (line ~151, where `settings: Settings = {...}` is built)
- Modify: every fixture file listed under "Test fixtures updated" in File Structure above

This is one task because the TypeScript change ripples to all `Settings`-shaped fixtures and `TripForm` simultaneously. The typecheck run is the "failing test".

- [ ] **Step 1: Update the Settings interface**

Edit `src/core/models/settings.ts`:

```ts
import type { Tag } from "./tag";

export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	version: 1;
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: string[];
	tags: Tag[];
	exportPath: string;
}
```

- [ ] **Step 2: Run typecheck to see the failures**

Run: `bun run check:type`
Expected: FAIL with errors at every `Settings`-typed literal that lacks `version: 1`. Note each file path the compiler reports — these are the targets for the next step.

- [ ] **Step 3: Update TripForm to stamp `version: 1`**

In `src/tui/screens/TripForm.tsx` around line 151, the code constructs `const settings: Settings = { name, startDate, ... }`. Add `version: 1` as the first property:

```ts
const settings: Settings = {
	version: 1,
	name,
	startDate,
	// ...everything that was there before
};
```

- [ ] **Step 4: Update each test fixture**

For each `const sampleSettings: Settings = {` (or similarly named) listed in File Structure above, add `version: 1,` as the first property. The fixture files are:

1. `src/core/validators/__tests__/validators.test.ts`
2. `src/core/services/expense/__tests__/expenseService.test.ts`
3. `src/core/services/expense/__tests__/nextExpenseId.test.ts`
4. `src/core/services/owner/__tests__/ownerService.test.ts`
5. `src/core/services/account/__tests__/accountService.test.ts`
6. `src/core/services/trip/__tests__/updateSettings.test.ts`
7. `src/core/services/trip/__tests__/sortTrips.test.ts`
8. `src/core/services/trip/__tests__/tripService.test.ts` (two `Settings` literals: sampleSettings ~line 14, sourceSettings ~line 122)
9. `src/core/services/trip/__tests__/loadTrip.test.ts` — `baseSettings` literal at line ~17; note it's a plain object literal but used to build `Settings` shapes. Add `version: 1,` here too.
10. `src/core/services/trip/__tests__/getTripStatus.test.ts`
11. `src/core/services/currency/__tests__/findCurrencyReferences.test.ts`
12. `src/core/services/export/__tests__/exportCsv.test.ts`

If `bun run check:type` reports additional `Settings` literals not in this list, add `version: 1` to those too. The check is authoritative.

- [ ] **Step 5: Verify typecheck and tests pass**

Run: `bun run check:type`
Expected: PASS (no errors).

Run: `bun test`
Expected: All existing tests pass. (The kernel tests pass; trip-namespace tests don't exist yet.)

- [ ] **Step 6: Commit**

```bash
git add src/core/models/settings.ts src/tui/screens/TripForm.tsx src/core/validators/__tests__/validators.test.ts src/core/services/expense/__tests__/expenseService.test.ts src/core/services/expense/__tests__/nextExpenseId.test.ts src/core/services/owner/__tests__/ownerService.test.ts src/core/services/account/__tests__/accountService.test.ts src/core/services/trip/__tests__/updateSettings.test.ts src/core/services/trip/__tests__/sortTrips.test.ts src/core/services/trip/__tests__/tripService.test.ts src/core/services/trip/__tests__/loadTrip.test.ts src/core/services/trip/__tests__/getTripStatus.test.ts src/core/services/currency/__tests__/findCurrencyReferences.test.ts src/core/services/export/__tests__/exportCsv.test.ts
git commit -m "feat(core): add version field to Settings"
```

---

## Task 12: Add trip v1 zod schema

**Files:**
- Create: `src/core/configs/trip/schemas/v1.ts`

- [ ] **Step 1: Write the schema**

Create `src/core/configs/trip/schemas/v1.ts`:

```ts
import { z } from "zod";

const tagSchema = z.object({
	value: z.string(),
	default: z.boolean(),
});

const currencyConfigSchema = z.object({
	exchangeRate: z.number().optional(),
});

const settingsSchemaV1 = z.object({
	version: z.literal(1),
	name: z.string().min(1),
	startDate: z.string(),
	endDate: z.string(),
	countries: z.array(z.string()),
	baseCurrency: z.literal("THB"),
	currencies: z.record(z.string(), currencyConfigSchema),
	categories: z.array(z.string()),
	tags: z.array(tagSchema),
	exportPath: z.string(),
});

const ownerSchema = z.object({
	id: z.string(),
	name: z.string(),
});

const accountSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(["Credit", "Debit"]),
	owners: z.array(z.string()),
});

const expenseOwnerSplitSchema = z.object({
	id: z.string(),
	split: z.union([z.string(), z.number()]).optional(),
});

const expenseSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	date: z.string(),
	payee: z.string(),
	category: z.string(),
	amount: z.number(),
	currency: z.string(),
	exchangeRate: z.number().optional(),
	owners: z
		.union([z.array(z.string()), z.array(expenseOwnerSplitSchema)])
		.optional(),
	description: z.string(),
	tags: z.array(z.string()),
});

export const tripV1Schema = z.object({
	settings: settingsSchemaV1,
	owners: z.array(ownerSchema),
	accounts: z.array(accountSchema),
	expenses: z.array(expenseSchema),
});

export type TripV1 = z.infer<typeof tripV1Schema>;
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/trip/schemas/v1.ts
git commit -m "feat(configs): trip v1 zod schema"
```

---

## Task 13: Add trip v0 zod schema

**Files:**
- Create: `src/core/configs/trip/schemas/v0.ts`

- [ ] **Step 1: Write the loose pre-version schema**

Create `src/core/configs/trip/schemas/v0.ts`:

```ts
import { z } from "zod";

const tagOrStringSchema = z.union([
	z.string(),
	z.object({ value: z.string(), default: z.boolean() }),
]);

const settingsSchemaV0 = z
	.object({
		name: z.string(),
		startDate: z.string(),
		endDate: z.string(),
		countries: z.array(z.string()),
		baseCurrency: z.literal("THB"),
		currencies: z.record(
			z.string(),
			z.object({ exchangeRate: z.number().optional() }),
		),
		categories: z.array(z.string()),
		tags: z.array(tagOrStringSchema).optional(),
		exportPath: z.string(),
	})
	.passthrough();

export const tripV0Schema = z.object({
	settings: settingsSchemaV0,
	owners: z.array(z.unknown()),
	accounts: z.array(z.unknown()),
	expenses: z.array(z.unknown()),
});

export type TripV0 = z.infer<typeof tripV0Schema>;
```

The owners/accounts/expenses arrays pass through as `unknown` because their shape didn't change between v0 and v1 — the kernel re-validates them against `tripV1Schema` after the migration runs, which is where any malformed entry is caught.

- [ ] **Step 2: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/trip/schemas/v0.ts
git commit -m "feat(configs): trip v0 zod schema"
```

---

## Task 14: v0→v1 migration with test

**Files:**
- Create: `src/core/configs/trip/migrations/v0_to_v1.ts`
- Create: `src/core/configs/__tests__/trip.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/configs/__tests__/trip.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
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
		// Result must satisfy the v1 schema:
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: FAIL with module-not-found for the migration file.

- [ ] **Step 3: Write the migration**

Create `src/core/configs/trip/migrations/v0_to_v1.ts`:

```ts
import type { TripV0 } from "../schemas/v0";
import type { TripV1 } from "../schemas/v1";

export function tripV0ToV1(input: TripV0): TripV1 {
	return {
		settings: {
			...input.settings,
			version: 1 as const,
			tags: (input.settings.tags ?? []).map((t) =>
				typeof t === "string" ? { value: t, default: false } : t,
			),
		},
		owners: input.owners as TripV1["owners"],
		accounts: input.accounts as TripV1["accounts"],
		expenses: input.expenses as TripV1["expenses"],
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: PASS (3 tests, 3 pass).

- [ ] **Step 5: Commit**

```bash
git add src/core/configs/__tests__/trip.test.ts src/core/configs/trip/migrations/v0_to_v1.ts
git commit -m "feat(configs): trip v0->v1 migration"
```

---

## Task 15: Trip I/O — read, version-parse, write

**Files:**
- Create: `src/core/configs/trip/io.ts`
- Modify: `src/core/configs/__tests__/trip.test.ts`

- [ ] **Step 1: Add failing I/O round-trip tests**

Append to `src/core/configs/__tests__/trip.test.ts`:

```ts
import { afterEach, beforeEach } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import {
	ConfigFileMissingError,
	ConfigParseError,
} from "../errors";
import {
	readTripConfig,
	readTripConfigVersion,
	writeTripConfig,
} from "../trip/io";

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

		// Modify the dir, then write back to a fresh dir
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
			readTripConfigVersion({ settings: { version: 1 }, owners: [], accounts: [], expenses: [] }),
		).toBe(1);
	});

	test("returns 0 when version is missing", () => {
		expect(
			readTripConfigVersion({ settings: {}, owners: [], accounts: [], expenses: [] }),
		).toBe(0);
	});

	test("returns 0 when settings is missing", () => {
		expect(readTripConfigVersion({ owners: [], accounts: [], expenses: [] })).toBe(0);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: FAIL with module-not-found for `../trip/io`.

- [ ] **Step 3: Implement the I/O module**

Create `src/core/configs/trip/io.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { ConfigFileMissingError, ConfigParseError } from "../errors";
import type { ConfigRaw } from "../types";

const FILES = {
	settings: "settings.yaml",
	owners: "owners.yaml",
	accounts: "accounts.yaml",
	expenses: "expenses.yaml",
} as const;

export function readTripConfig(location: string): ConfigRaw {
	const out: ConfigRaw = {};
	for (const [key, filename] of Object.entries(FILES)) {
		const path = join(location, filename);
		if (!existsSync(path)) {
			throw new ConfigFileMissingError("trip", location, filename);
		}
		let raw: unknown;
		try {
			raw = parse(readFileSync(path, "utf-8"));
		} catch (cause) {
			throw new ConfigParseError("trip", location, filename, cause);
		}
		if (key === "settings") {
			out[key] = raw ?? {};
		} else {
			const obj = raw as Record<string, unknown> | null;
			out[key] = obj?.[key] ?? [];
		}
	}
	return out;
}

export function readTripConfigVersion(raw: ConfigRaw): number {
	const settings = raw.settings as { version?: number } | undefined;
	return typeof settings?.version === "number" ? settings.version : 0;
}

export function writeTripConfig(location: string, data: ConfigRaw): void {
	writeFileSync(join(location, FILES.settings), stringify(data.settings));
	writeFileSync(
		join(location, FILES.owners),
		stringify({ owners: data.owners }),
	);
	writeFileSync(
		join(location, FILES.accounts),
		stringify({ accounts: data.accounts }),
	);
	writeFileSync(
		join(location, FILES.expenses),
		stringify({ expenses: data.expenses }),
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/configs/trip/io.ts src/core/configs/__tests__/trip.test.ts
git commit -m "feat(configs): trip io read/write/version helpers"
```

---

## Task 16: Trip namespace definition + barrel exports

**Files:**
- Create: `src/core/configs/trip/definition.ts`
- Create: `src/core/configs/trip/index.ts`
- Modify: `src/core/configs/index.ts`
- Modify: `src/core/configs/__tests__/trip.test.ts`

- [ ] **Step 1: Add failing end-to-end load test**

Append to `src/core/configs/__tests__/trip.test.ts`:

```ts
import { loadConfig } from "../kernel";
import { tripConfig } from "../trip";

describe("loadConfig with tripConfig — end-to-end", () => {
	test("loads a v1 trip without migration", () => {
		const dir = join(TEST_DIR, "v1-trip");
		writeTripFiles(dir, {
			settings: {
				...baseV0Settings,
				version: 1,
				tags: [{ value: "biz", default: false }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const result = loadConfig(tripConfig, dir);

		expect(result.migrated).toBe(false);
		expect(result.data.settings.version).toBe(1);
		expect(result.data.settings.tags).toEqual([
			{ value: "biz", default: false },
		]);
	});

	test("migrates a v0 trip with string tags to v1 and rewrites settings.yaml", () => {
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
		expect(result.toVersion).toBe(1);
		expect(result.data.settings.version).toBe(1);

		const reparsed = parse(readFileSync(join(dir, "settings.yaml"), "utf-8"));
		expect(reparsed.version).toBe(1);
		expect(reparsed.tags).toEqual([
			{ value: "work", default: false },
			{ value: "fun", default: false },
		]);
	});

	test("leaves a v1 settings.yaml byte-identical on load", () => {
		const dir = join(TEST_DIR, "v1-untouched");
		writeTripFiles(dir, {
			settings: { ...baseV0Settings, version: 1, tags: [] },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/configs/__tests__/trip.test.ts`
Expected: FAIL with module-not-found for `../trip`.

- [ ] **Step 3: Create the namespace definition**

Create `src/core/configs/trip/definition.ts`:

```ts
import { defineConfig } from "../kernel";
import {
	readTripConfig,
	readTripConfigVersion,
	writeTripConfig,
} from "./io";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { tripV0Schema } from "./schemas/v0";
import { tripV1Schema } from "./schemas/v1";

export const tripConfig = defineConfig({
	name: "trip",
	latestVersion: 1,
	schemas: {
		0: { schema: tripV0Schema, migrations: { 1: tripV0ToV1 } },
		1: { schema: tripV1Schema },
	},
	readConfig: readTripConfig,
	writeConfig: writeTripConfig,
	parseVersion: readTripConfigVersion,
});
```

Create `src/core/configs/trip/index.ts`:

```ts
export { tripConfig } from "./definition";
export { tripV1Schema } from "./schemas/v1";
export type { TripV1 } from "./schemas/v1";
```

- [ ] **Step 4: Extend `configs/index.ts` with the trip re-exports**

Edit `src/core/configs/index.ts` — append at the bottom:

```ts
export { tripConfig, tripV1Schema } from "./trip";
export type { TripV1 } from "./trip";
```

- [ ] **Step 5: Run tests**

Run: `bun test src/core/configs/__tests__/`
Expected: PASS (all tests in kernel.test.ts and trip.test.ts).

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/configs/trip/definition.ts src/core/configs/trip/index.ts src/core/configs/index.ts src/core/configs/__tests__/trip.test.ts
git commit -m "feat(configs): trip namespace definition + end-to-end tests"
```

---

## Task 17: Type-level sanity check — TripV1 ↔ Settings/Owner/Account/Expense

**Files:**
- Create: `src/core/configs/__tests__/typeCheck.test.ts`

- [ ] **Step 1: Write the assignability test**

Create `src/core/configs/__tests__/typeCheck.test.ts`:

```ts
import { describe, test } from "bun:test";
import type { Account, Expense, Owner, Settings } from "../../models";
import type { TripV1 } from "../trip";

describe("TripV1 inferred types align with hand-written models", () => {
	test("compile-time only: assignability holds in both directions", () => {
		// These declarations exist solely so the TypeScript compiler exercises
		// structural assignability. If `Settings`, `Owner`, `Account`, or
		// `Expense` ever drifts from the schema, `bun run check:type` will fail.
		const _settings: Settings = {} as TripV1["settings"];
		const _owner: Owner = {} as TripV1["owners"][number];
		const _account: Account = {} as TripV1["accounts"][number];
		const _expense: Expense = {} as TripV1["expenses"][number];

		// And the reverse direction:
		const _settingsBack: TripV1["settings"] = {} as Settings;
		const _ownerBack: TripV1["owners"][number] = {} as Owner;
		const _accountBack: TripV1["accounts"][number] = {} as Account;
		const _expenseBack: TripV1["expenses"][number] = {} as Expense;

		void _settings;
		void _owner;
		void _account;
		void _expense;
		void _settingsBack;
		void _ownerBack;
		void _accountBack;
		void _expenseBack;
	});
});
```

- [ ] **Step 2: Verify typecheck and test pass**

Run: `bun run check:type`
Expected: PASS. If it fails, an assignability gap exists between the schema and the hand-written models — fix the schema (preferred) or the model.

Run: `bun test src/core/configs/__tests__/typeCheck.test.ts`
Expected: PASS (1 trivial runtime test).

- [ ] **Step 3: Commit**

```bash
git add src/core/configs/__tests__/typeCheck.test.ts
git commit -m "test(configs): TripV1 schema ↔ models assignability"
```

---

## Task 18: Refactor loadTrip to use loadConfig

**Files:**
- Modify: `src/core/services/trip/loadTrip.ts`

- [ ] **Step 1: Run existing loadTrip tests to baseline them**

Run: `bun test src/core/services/trip/__tests__/loadTrip.test.ts`
Expected: PASS (the tag-normalization tests should still pass on the *current* loadTrip implementation).

- [ ] **Step 2: Replace loadTrip body**

Replace the entire contents of `src/core/services/trip/loadTrip.ts` with:

```ts
import { loadConfig } from "../../configs";
import { tripConfig } from "../../configs/trip";
import type { Trip } from "../../models";

export function loadTrip(tripPath: string): Trip {
	const { data } = loadConfig(tripConfig, tripPath);
	return { dirPath: tripPath, ...data };
}
```

The legacy `normalizeTags` helper and the in-place `settings.yaml` rewrite are deleted — the same behavior is now provided by the v0→v1 migration plus the kernel's silent-rewrite step.

- [ ] **Step 3: Run loadTrip tests to verify same behavior**

Run: `bun test src/core/services/trip/__tests__/loadTrip.test.ts`
Expected: PASS — same assertions still hold (legacy string tags get normalized; modern shape is untouched).

Run: `bun test`
Expected: PASS (no other test regresses).

- [ ] **Step 4: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/trip/loadTrip.ts
git commit -m "refactor(core): route loadTrip through configs kernel"
```

---

## Task 19: Refactor createTrip to use saveConfig

**Files:**
- Modify: `src/core/services/trip/createTrip.ts`

- [ ] **Step 1: Add a failing test asserting the file shape**

Look at the existing test at `src/core/services/trip/__tests__/tripService.test.ts`. The `createTrip` block (around line 101) tests that the trip directory contains the four YAML files. Add an assertion that `settings.yaml` contains `version: 1`. Add to the existing `test("creates a trip directory with the four YAML files", ...)` or just after the `createTrip(...)` call inside that test:

```ts
import { parse } from "yaml";
import { readFileSync } from "node:fs";

// ...inside the test:
const settingsOnDisk = parse(
	readFileSync(join(TEST_DIR, "korea", "settings.yaml"), "utf-8"),
);
expect(settingsOnDisk.version).toBe(1);
```

(The `parse` and `readFileSync` imports may already exist at the top — re-use if so.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/tripService.test.ts`
Expected: FAIL — the current `createTrip` uses `stringify(settings)` which won't include the `version: 1` field unless settings already has it. Even after Task 11 added `version: 1` to the `Settings` interface (which would make it work), routing through `saveConfig` adds validation. Either way, run this test to baseline.

If the test passes (because Task 11 made callers stamp `version: 1`), still proceed — Task 19 is about routing through `saveConfig` for validation, not about the version field.

- [ ] **Step 3: Make `writeTripConfig` create the directory if missing**

`saveConfig` calls `writeTripConfig`, which uses `writeFileSync`. The current `writeTripConfig` assumes the directory exists; for `createTrip` it won't. Edit `src/core/configs/trip/io.ts`:

Add `mkdirSync` to the `node:fs` import at the top:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
```

Add a `mkdirSync` call as the first line of `writeTripConfig`:

```ts
export function writeTripConfig(location: string, data: ConfigRaw): void {
	mkdirSync(location, { recursive: true });
	writeFileSync(join(location, FILES.settings), stringify(data.settings));
	writeFileSync(
		join(location, FILES.owners),
		stringify({ owners: data.owners }),
	);
	writeFileSync(
		join(location, FILES.accounts),
		stringify({ accounts: data.accounts }),
	);
	writeFileSync(
		join(location, FILES.expenses),
		stringify({ expenses: data.expenses }),
	);
}
```

- [ ] **Step 4: Replace createTrip body**

Replace the entire contents of `src/core/services/trip/createTrip.ts` with:

```ts
import { join } from "node:path";
import { saveConfig } from "../../configs";
import { tripConfig } from "../../configs/trip";
import type { Settings, Trip } from "../../models";

export function createTrip(
	dataDir: string,
	dirName: string,
	settings: Settings,
): Trip {
	const tripPath = join(dataDir, dirName);
	const data = { settings, owners: [], accounts: [], expenses: [] };
	saveConfig(tripConfig, tripPath, data);
	return { dirPath: tripPath, ...data };
}
```

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 6: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/trip/createTrip.ts src/core/configs/trip/io.ts src/core/services/trip/__tests__/tripService.test.ts
git commit -m "refactor(core): route createTrip through configs kernel"
```

---

## Task 20: listTrips returns TripEntry discriminated union

**Files:**
- Modify: `src/core/services/trip/listTrips.ts`
- Modify: `src/core/services/trip/index.ts`
- Modify: `src/core/services/trip/__tests__/tripService.test.ts` or add new file

- [ ] **Step 1: Write a failing test for broken-trip detection**

Edit `src/core/services/trip/__tests__/tripService.test.ts`. Add a new `describe` block at the bottom of the file:

```ts
import {
	ConfigParseError,
	ConfigValidateError,
} from "../../../configs";
import type { TripEntry } from "../listTrips";

describe("listTrips — broken trips", () => {
	test("returns kind:'broken' entry when settings.yaml is malformed", () => {
		const dir = join(TEST_DIR, "broken-yaml");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "settings.yaml"), ": : invalid yaml [[[");
		writeFileSync(join(dir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(dir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(dir, "expenses.yaml"), stringify({ expenses: [] }));

		const entries = listTrips(TEST_DIR);
		const broken = entries.find(
			(e): e is Extract<TripEntry, { kind: "broken" }> =>
				e.kind === "broken" && e.dirName === "broken-yaml",
		);
		expect(broken).toBeDefined();
		expect(broken?.error).toBeInstanceOf(ConfigParseError);
	});

	test("returns kind:'broken' entry when settings fail schema validation", () => {
		const dir = join(TEST_DIR, "invalid-shape");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "settings.yaml"),
			stringify({ version: 1, name: "", baseCurrency: "USD" }), // version 1 but missing required fields & wrong currency
		);
		writeFileSync(join(dir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(dir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(dir, "expenses.yaml"), stringify({ expenses: [] }));

		const entries = listTrips(TEST_DIR);
		const broken = entries.find(
			(e): e is Extract<TripEntry, { kind: "broken" }> =>
				e.kind === "broken" && e.dirName === "invalid-shape",
		);
		expect(broken).toBeDefined();
		expect(broken?.error).toBeInstanceOf(ConfigValidateError);
	});

	test("ok and broken entries coexist", () => {
		// Write one healthy v1 trip
		const okDir = join(TEST_DIR, "ok-trip");
		mkdirSync(okDir, { recursive: true });
		writeFileSync(
			join(okDir, "settings.yaml"),
			stringify({
				version: 1,
				name: "OK",
				startDate: "2026-05-01",
				endDate: "2026-05-02",
				countries: ["X"],
				baseCurrency: "THB",
				currencies: {},
				categories: [],
				tags: [],
				exportPath: "./e.csv",
			}),
		);
		writeFileSync(join(okDir, "owners.yaml"), stringify({ owners: [] }));
		writeFileSync(join(okDir, "accounts.yaml"), stringify({ accounts: [] }));
		writeFileSync(join(okDir, "expenses.yaml"), stringify({ expenses: [] }));

		// Write one broken trip
		const brokenDir = join(TEST_DIR, "broken-trip");
		mkdirSync(brokenDir, { recursive: true });
		writeFileSync(join(brokenDir, "settings.yaml"), "::: bad");
		writeFileSync(
			join(brokenDir, "owners.yaml"),
			stringify({ owners: [] }),
		);
		writeFileSync(
			join(brokenDir, "accounts.yaml"),
			stringify({ accounts: [] }),
		);
		writeFileSync(
			join(brokenDir, "expenses.yaml"),
			stringify({ expenses: [] }),
		);

		const entries = listTrips(TEST_DIR);
		const kinds = entries.map((e) => `${e.kind}:${e.kind === "ok" ? e.trip.settings.name : e.dirName}`).sort();
		expect(kinds).toContain("ok:OK");
		expect(kinds).toContain("broken:broken-trip");
	});
});
```

Also at the top of the test file, ensure these imports exist (add if missing):

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/tripService.test.ts`
Expected: FAIL — `TripEntry` doesn't exist; `listTrips` still returns `Trip[]`.

- [ ] **Step 3: Update listTrips to return TripEntry[]**

Replace contents of `src/core/services/trip/listTrips.ts`:

```ts
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../../configs";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export type TripEntry =
	| { kind: "ok"; trip: Trip }
	| {
			kind: "broken";
			dirPath: string;
			dirName: string;
			error: ConfigError;
	  };

export function listTrips(dataDir: string): TripEntry[] {
	if (!existsSync(dataDir)) return [];

	const entries = readdirSync(dataDir, { withFileTypes: true });
	const out: TripEntry[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const tripDir = join(dataDir, entry.name);
		try {
			out.push({ kind: "ok", trip: loadTrip(tripDir) });
		} catch (error) {
			if (error instanceof ConfigError) {
				out.push({
					kind: "broken",
					dirPath: tripDir,
					dirName: entry.name,
					error,
				});
			} else {
				throw error;
			}
		}
	}

	return out;
}
```

- [ ] **Step 4: Re-export TripEntry from the services barrel**

Edit `src/core/services/trip/index.ts` — change the listTrips line to also re-export the type:

```ts
export type { TripEntry } from "./listTrips";
export { listTrips } from "./listTrips";
```

- [ ] **Step 5: Run tests**

Run: `bun test src/core/services/trip/__tests__/tripService.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify typecheck (will fail — sortTrips/TripList expect Trip[])**

Run: `bun run check:type`
Expected: FAIL. `sortTrips` is typed `(trips: Trip[]) => Trip[]`. `TripList` and `TripDuplicateSelect` etc. pass `listTrips(dataDir)` directly into things expecting `Trip[]`.

This is expected — we fix it in the next step.

- [ ] **Step 7: Update sortTrips to take and return TripEntry[]**

Replace the contents of `src/core/services/trip/sortTrips.ts` with the version below. The healthy-trip sort logic is byte-identical to the current implementation (active vs. ended split, then end-date + name comparators); broken entries always sort to the bottom in original order.

```ts
import type { Trip } from "../../models";
import type { TripEntry } from "./listTrips";

export function sortTrips(entries: TripEntry[], today: string): TripEntry[] {
	const compareName = (a: Trip, b: Trip): number =>
		a.settings.name.localeCompare(b.settings.name, undefined, {
			sensitivity: "base",
		});

	const okEntries: Extract<TripEntry, { kind: "ok" }>[] = [];
	const broken: Extract<TripEntry, { kind: "broken" }>[] = [];
	for (const e of entries) {
		if (e.kind === "ok") okEntries.push(e);
		else broken.push(e);
	}

	const active: Trip[] = [];
	const ended: Trip[] = [];
	for (const { trip } of okEntries) {
		if (today <= trip.settings.endDate) {
			active.push(trip);
		} else {
			ended.push(trip);
		}
	}

	active.sort((a, b) => {
		const cmp = a.settings.endDate.localeCompare(b.settings.endDate);
		return cmp !== 0 ? cmp : compareName(a, b);
	});

	ended.sort((a, b) => {
		const cmp = b.settings.endDate.localeCompare(a.settings.endDate);
		return cmp !== 0 ? cmp : compareName(a, b);
	});

	return [
		...active.map((trip): TripEntry => ({ kind: "ok", trip })),
		...ended.map((trip): TripEntry => ({ kind: "ok", trip })),
		...broken,
	];
}
```

Update `src/core/services/trip/__tests__/sortTrips.test.ts` so its fixtures wrap each `Trip` in `{ kind: "ok", trip }` and its assertions unwrap accordingly. The test file currently constructs `Trip[]` inputs and asserts on `Trip[]` outputs; convert both sides:

```ts
import type { TripEntry } from "../listTrips";

// Where the test had:
//   const trips: Trip[] = [trip1, trip2];
//   const sorted = sortTrips(trips, today);
//   expect(sorted).toEqual([expected1, expected2]);
//
// Replace with:
const entries: TripEntry[] = [
	{ kind: "ok", trip: trip1 },
	{ kind: "ok", trip: trip2 },
];
const sorted = sortTrips(entries, today);
expect(sorted).toEqual([
	{ kind: "ok", trip: expected1 },
	{ kind: "ok", trip: expected2 },
]);
```

Apply this pattern to every assertion in the file. The number of trips and expected ordering must remain unchanged.

- [ ] **Step 8: Verify all tests and typecheck pass**

Run: `bun run check:type`
Expected: still FAIL — the TUI files (`TripList`, `TripDuplicateSelect`, `TripDelete`) call `listTrips(dataDir)` and pass it to things expecting `Trip[]`. Fix those in Task 22. For now, we'll let those errors stand until we hit Task 22.

Actually, to keep each commit green, do this instead: in this task, update the TUI call sites to unwrap `TripEntry[]` into `Trip[]` at the boundary (filter to `kind === "ok"` and map to `.trip`):

Files to touch:
- `src/tui/screens/TripList.tsx` — call sites of `listTrips` + `sortTrips`
- `src/tui/screens/TripDuplicateSelect.tsx` — call sites of `listTrips`
- `src/tui/screens/TripDelete.tsx` — call sites of `listTrips`
- anywhere else that `bun run check:type` flags

For each: replace `const trips = listTrips(dataDir);` with:

```ts
const entries = listTrips(dataDir);
const trips = entries
	.filter((e): e is Extract<TripEntry, { kind: "ok" }> => e.kind === "ok")
	.map((e) => e.trip);
```

For `TripList.tsx` specifically, also keep the full `entries` array around — we'll need it in Task 22 to render broken rows. For now, both `entries` and `trips` exist; Task 22 changes how rendering uses `entries`.

Import `TripEntry` from `../../core/services/trip`.

Run: `bun run check:type`
Expected: PASS.

Run: `bun test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/core/services/trip/listTrips.ts src/core/services/trip/index.ts src/core/services/trip/sortTrips.ts src/core/services/trip/__tests__/tripService.test.ts src/core/services/trip/__tests__/sortTrips.test.ts src/tui/screens/TripList.tsx src/tui/screens/TripDuplicateSelect.tsx src/tui/screens/TripDelete.tsx
git commit -m "feat(core): listTrips returns TripEntry discriminated union"
```

---

## Task 21: TripBroken screen + /trips/broken route

**Files:**
- Modify: `src/tui/models/index.ts`
- Create: `src/tui/screens/TripBroken.tsx`
- Modify: `src/tui/router.ts`

These three changes ship together because the route params type, the screen component, and the route registration must all line up for typecheck to pass.

- [ ] **Step 1: Add the route params entry**

Edit `src/tui/models/index.ts`. Inside the `RouteParams` interface (after the `/trips/overview` entry, around line 16), add:

```ts
"/trips/broken": {
	dirName: string;
	dirPath: string;
	error: import("../../core/configs").ConfigError;
	dataDir?: string;
};
```

The inline `import(...).Type` avoids adding a static import at the top of the models file.

- [ ] **Step 2: Create the TripBroken screen**

Create `src/tui/screens/TripBroken.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
	ConfigFileMissingError,
	ConfigMigrateError,
	ConfigParseError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "../../core/configs";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripBroken(): JSX.Element {
	const { goBack } = useNavigation();
	const { focus } = useFocus();
	const { setHints, setColor } = useLayout();
	const { setMenu } = useMenu();
	const { dirName, dirPath, error } = useRouteProps("/trips/broken");

	useEffect(() => {
		setColor({ borderColor: "red" });
		setMenu(
			[
				{ label: "Back", value: "back", key: "q" },
			],
			(value) => {
				if (value === "back") goBack();
			},
		);
		setHints([{ key: "q", label: "Back to trip list" }]);
	}, [setColor, setMenu, setHints, goBack]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="red">
				Trip "{dirName}" cannot be opened
			</Text>
			<Text dimColor>Path: {dirPath}</Text>
			<Text color="red">
				{error.name}: {error.message}
			</Text>
			{error instanceof ConfigValidateError && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Schema issues (v{error.version}):</Text>
					{error.issues.map((issue, i) => (
						<Text key={i}>
							• {issue.path.join(".") || "(root)"}: {issue.message}
						</Text>
					))}
				</Box>
			)}
			{error instanceof ConfigParseError && (
				<Box marginTop={1}>
					<Text>Offending file: {error.file}</Text>
				</Box>
			)}
			{error instanceof ConfigFileMissingError && (
				<Box marginTop={1}>
					<Text>Missing file: {error.file}</Text>
				</Box>
			)}
			{error instanceof ConfigMigrateError && (
				<Box marginTop={1}>
					<Text>
						Migration v{error.from} → v{error.to} failed.
					</Text>
				</Box>
			)}
			{error instanceof ConfigUnknownVersionError && (
				<Box marginTop={1}>
					<Text>
						File reports v{error.version}; this build supports up to v{error.latest}.
					</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text dimColor>
					Edit the file manually and return to the trip list, or press [q] to go back.
				</Text>
			</Box>
		</Box>
	);
}
```

Note: this screen does not handle delete — `TripList` retains the `[x]` delete shortcut on broken rows, so users can clean up unrecoverable trips from the list itself.

- [ ] **Step 3: Register the route**

Edit `src/tui/router.ts`:

1. Add an import (alphabetically near `TripList`):

```ts
import { TripBroken } from "./screens/TripBroken";
```

2. Add a route entry inside `routes` (right after the `/trips/delete` entry):

```ts
"/trips/broken": {
	component: TripBroken as unknown as ComponentType,
	title: "Broken Trip",
	defaultFocus: "menu",
	borderColor: "red",
},
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/models/index.ts src/tui/router.ts src/tui/screens/TripBroken.tsx
git commit -m "feat(tui): TripBroken diagnostic screen + /trips/broken route"
```

---

## Task 22: TripList renders broken rows and gates actions

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Replace TripList rendering and menu logic**

The current `TripList` uses `trips` (a `Trip[]` we filtered out of `entries` in Task 20). Rework it to render every entry — broken rows with a warning marker, ok rows as today.

Replace the contents of `src/tui/screens/TripList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import {
	deleteTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripList(): JSX.Element {
	const { goTo, goBack } = useNavigation();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();

	const { dataDir = "./data" } = useRouteProps("/trips");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("trip-");
	}, [clearByPrefix]);

	const [entries, setEntries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	const hasOk = entries.some((e) => e.kind === "ok");

	useEffect(() => {
		setTitleSuffix(null);
		setColor({});

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{
					label: "Duplicate",
					value: "duplicate",
					key: "d",
					mainAction: {
						// Skip armed-duplicate on broken rows: can't duplicate what we can't read.
						check: (i) => entries[i]?.kind === "ok",
						onConfirm: (i) => {
							const e = entries[i];
							if (!e || e.kind !== "ok") return;
							goTo("/trips/new", {
								props: {
									dataDir,
									duplicateFromDirPath: e.trip.dirPath,
								},
							});
						},
					},
				},
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: {
						confirmCount: 2,
						onConfirm: (i) => {
							const e = entries[i];
							if (!e) return;
							const path = e.kind === "ok" ? e.trip.dirPath : e.dirPath;
							deleteTrip(path);
							const next = sortTrips(listTrips(dataDir), today());
							setEntries(next);
							if (next.length === 0) {
								goBack();
							}
						},
					},
				},
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && hasOk) {
					goTo("/trips/duplicate", { props: { dataDir } });
				} else if (value === "delete" && entries.length > 0) {
					goTo("/trips/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		dataDir,
		entries,
		hasOk,
		setMenu,
		setHints,
		setColor,
		setTitleSuffix,
		goTo,
		goBack,
	]);

	if (entries.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<ListSelect
			options={entries.map((e) =>
				e.kind === "ok"
					? {
							label: e.trip.settings.name,
							value: e.trip.dirPath,
							detail: `(${e.trip.settings.startDate} — ${e.trip.settings.endDate})`,
						}
					: {
							label: `⚠ ${e.dirName} — ${e.error.name}`,
							value: `__broken__:${e.dirPath}`,
							detail: "(broken — press Enter for details)",
						},
			)}
			onChange={(value) => {
				if (value.startsWith("__broken__:")) {
					const dirPath = value.slice("__broken__:".length);
					const entry = entries.find(
						(e): e is Extract<TripEntry, { kind: "broken" }> =>
							e.kind === "broken" && e.dirPath === dirPath,
					);
					if (!entry) return;
					goTo("/trips/broken", {
						props: {
							dirName: entry.dirName,
							dirPath: entry.dirPath,
							error: entry.error,
							dataDir,
						},
					});
					return;
				}
				const entry = entries.find(
					(e): e is Extract<TripEntry, { kind: "ok" }> =>
						e.kind === "ok" && e.trip.dirPath === value,
				);
				if (entry) {
					goTo("/trips/overview", {
						props: {
							tripDirPath: entry.trip.dirPath,
							tripName: entry.trip.settings.name,
							dataDir,
						},
					});
				}
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
```

Notes on the changes:
- `entries` replaces `trips` as the source of truth.
- Each list row's `value` is either the trip's `dirPath` (ok rows) or `__broken__:<dirPath>` (broken rows). `onChange` discriminates on the prefix.
- `Duplicate`'s armed-row action gates via `mainAction.check` — pressing `[d]` while a broken row is highlighted refuses to arm, so the user can't duplicate something that didn't load. The `mainAction.onConfirm` defends with a `kind !== "ok"` check as well.
- `Delete` works on both ok and broken rows — the dirPath comes from either branch of the discriminated union.
- The menu shortcut `[d]` (independent of the highlighted row) still opens `/trips/duplicate` whenever any healthy trip exists. That screen filters healthy trips itself.

- [ ] **Step 2: Verify typecheck and tests pass**

Run: `bun run check:type`
Expected: PASS.

Run: `bun test`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Create a broken trip on disk so the TUI has something to render:

```bash
mkdir -p /tmp/finmove-smoke/broken-test
echo ":: not yaml ::" > /tmp/finmove-smoke/broken-test/settings.yaml
echo "owners: []" > /tmp/finmove-smoke/broken-test/owners.yaml
echo "accounts: []" > /tmp/finmove-smoke/broken-test/accounts.yaml
echo "expenses: []" > /tmp/finmove-smoke/broken-test/expenses.yaml
```

Run: `bun run start --data-dir /tmp/finmove-smoke`

Verify:
- The broken trip appears as `⚠ broken-test — ConfigParseError` in the list
- Pressing `Enter` on it navigates to the broken screen showing the error details
- `[q]` returns to the trip list
- `[x]` on the broken row prompts for delete-confirmation (2x) and removes the directory
- `[d]` while the broken row is highlighted refuses to arm (no "Press [d] again" hint)

Clean up: `rm -rf /tmp/finmove-smoke`

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "feat(tui): render broken trips with diagnostic navigation"
```

---

## Done

The feature is complete:

- `src/core/configs/` houses a generic versioned-config kernel
- `tripConfig` registers the trip namespace with v0/v1 schemas + v0→v1 migration
- `loadTrip` and `createTrip` route through the kernel
- `listTrips` surfaces broken trips as a discriminated union
- The TUI renders broken rows and navigates to a diagnostic screen

Run a final full check before opening a PR:

```bash
bun run check:type
bun test
bun run check
```
