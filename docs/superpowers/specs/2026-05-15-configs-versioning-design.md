# Versioned, schema-validated configs

## Goal

Introduce `src/core/configs/` as a generic, versioned configuration kernel. Each "config namespace" (starting with `trip`, designed to host a future `app` namespace) declares:

- A set of zod schemas keyed by version
- Migration functions between versions
- Pluggable read/write/version-parse functions

The kernel handles: read → detect version → validate-and-migrate up the chain → return the latest-shape data (and silently rewrite the upgraded files). All failure modes surface as typed `ConfigError` subclasses so the TUI can render diagnostic states for corrupt or unreadable trips.

## Background

Per-trip data is stored across four YAML files:

```
data/<trip-slug>/
├── settings.yaml
├── owners.yaml
├── accounts.yaml
└── expenses.yaml
```

`src/core/services/trip/loadTrip.ts` reads all four, parses them with `yaml.parse`, and casts the result directly to TypeScript types — no schema validation. It also performs an ad-hoc one-shot normalization (legacy `tags: string[]` → `tags: Tag[]`) that rewrites `settings.yaml` in place when triggered.

There is no `version` field on disk anywhere. Future shape changes have to either be silent in-place rewrites (like the current tag normalization) or break older trips.

`zod` is not yet a dependency.

## Decisions

| Question | Decision |
|---|---|
| Scope | Generic kernel; trip namespace today, app-level namespace later |
| Versioning unit | One `version` field per trip, living in `settings.yaml` |
| Migration write-back | Silent auto-rewrite on load; no on-disk backup |
| Corruption UX | Show broken trip as a flagged row in the trip list with a diagnostic screen; only Delete is allowed |
| First migration | v0 → v1: stamp `version: 1`, normalize legacy string tags; remove the in-place tag rewrite from `loadTrip` |
| Migration selection | Greedy — at each step, pick the largest available target ≤ `latestVersion` |
| Read/write contract | Symmetric `readConfig` + `writeConfig` on the namespace definition |
| Sync vs async | Sync, matching the rest of the codebase |

## Module layout

```
src/core/configs/
├── index.ts                     # public surface
├── kernel.ts                    # loadConfig, saveConfig, defineConfig
├── types.ts                     # ConfigDefinition, ConfigSchemas, ConfigResult, ConfigRaw
├── errors.ts                    # ConfigError + subclasses
├── trip/
│   ├── index.ts                 # trip namespace public surface
│   ├── definition.ts            # tripConfig = defineConfig({...})
│   ├── io.ts                    # readTripConfig, readTripConfigVersion, writeTripConfig
│   ├── schemas/
│   │   ├── v0.ts                # loose pre-version shape (tags as string[] | Tag[], no version)
│   │   └── v1.ts                # current shape + version: 1, strict
│   └── migrations/
│       └── v0_to_v1.ts          # stamp version, normalize tags
└── __tests__/
    ├── kernel.test.ts
    └── trip.test.ts
```

Namespaces are co-located: everything `trip` lives under `configs/trip/`. A future `configs/app/` is symmetric.

## Kernel types

```ts
// configs/types.ts
import type { z } from "zod";

export type ConfigRaw = Record<string, unknown>;

export type ConfigSchemas<S extends Record<number, z.ZodTypeAny>> = {
  [V in keyof S]: {
    schema: S[V];
    migrations?: {
      [Target in Exclude<keyof S, V>]?: (current: z.infer<S[V]>) => z.infer<S[Target]>;
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

The TypeScript constraints give:

- Migration target keys can only be other versions present in the same `Schemas` map.
- A migration's input/output are typed as `z.infer<source>` and `z.infer<target>` — no casting.
- `loadConfig` returns the inferred type of the latest schema.

## Kernel API

```ts
// configs/kernel.ts
export function defineConfig<
  N extends string,
  S extends Record<number, z.ZodTypeAny>,
  L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>): ConfigDefinition<N, S, L> {
  return def; // pure type-inference funnel
}

export function loadConfig<
  N extends string,
  S extends Record<number, z.ZodTypeAny>,
  L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>, location: string): ConfigResult<S, L>;

export function saveConfig<
  N extends string,
  S extends Record<number, z.ZodTypeAny>,
  L extends keyof S & number,
>(def: ConfigDefinition<N, S, L>, location: string, data: z.infer<S[L]>): void;
```

### `loadConfig` algorithm

```
1. raw       ← def.readConfig(location)                    # may throw FileMissing/Parse
2. v         ← def.parseVersion(raw)
3. initialV  ← v
4. if v > def.latestVersion or v not in def.schemas: throw UnknownVersion(v)

5. current ← raw
6. loop:
     entry   ← def.schemas[v]
     parsed  ← entry.schema.safeParse(current)
     if !parsed.success: throw Validate(v, parsed.error.issues)
     current ← parsed.data

     if v === def.latestVersion: break

     next ← chooseNextVersion(entry.migrations, v, def.latestVersion)
       # greedy: largest target ≤ latestVersion among entry.migrations keys
     if next is null: throw NoMigrationPath(v, def.latestVersion)

     try:   current ← entry.migrations[next](current)
     catch: throw Migrate(v, next, cause)
     v ← next

7. if initialV < def.latestVersion:
     saveConfig(def, location, current)         # silent rewrite

8. return { data: current, migrated: initialV < def.latestVersion,
            fromVersion: initialV, toVersion: def.latestVersion }
```

Validation runs at every version on the way up — if a migration produces a malformed object, the next iteration's `safeParse` catches it before the next migration consumes it.

### `saveConfig`

```
1. valid ← def.schemas[def.latestVersion].schema.parse(data)   # throws on invalid
2. def.writeConfig(location, valid)
```

`saveConfig` always validates before writing. Disk never receives a shape that doesn't match the latest schema.

### `chooseNextVersion`

```ts
function chooseNextVersion(
  migrations: Record<number, Function> | undefined,
  from: number,
  latest: number,
): number | null {
  if (!migrations) return null;
  const candidates = Object.keys(migrations)
    .map(Number)
    .filter((t) => t > from && t <= latest);
  if (candidates.length === 0) return null;
  return Math.max(...candidates); // greedy
}
```

## Trip namespace

### `configs/trip/io.ts`

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { ConfigFileMissingError, ConfigParseError } from "../errors";
import type { ConfigRaw } from "../types";

const FILES = {
  settings: "settings.yaml",
  owners:   "owners.yaml",
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
    out[key] =
      key === "settings"
        ? (raw ?? {})
        : ((raw as Record<string, unknown> | null)?.[key] ?? []);
  }
  return out;
}

export function readTripConfigVersion(raw: ConfigRaw): number {
  const v = (raw.settings as { version?: number } | undefined)?.version;
  return typeof v === "number" ? v : 0;
}

export function writeTripConfig(location: string, data: ConfigRaw): void {
  writeFileSync(join(location, FILES.settings), stringify(data.settings));
  writeFileSync(join(location, FILES.owners),   stringify({ owners:   data.owners }));
  writeFileSync(join(location, FILES.accounts), stringify({ accounts: data.accounts }));
  writeFileSync(join(location, FILES.expenses), stringify({ expenses: data.expenses }));
}
```

### `configs/trip/schemas/v1.ts`

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
  owners: z.union([z.array(z.string()), z.array(expenseOwnerSplitSchema)]).optional(),
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

### `configs/trip/schemas/v0.ts`

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
    currencies: z.record(z.string(), z.object({ exchangeRate: z.number().optional() })),
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

`v0` validates loosely — only the fields the migration needs to touch are checked. Owners/accounts/expenses are passed through as `unknown` arrays because their shapes are unchanged in v0→v1; revalidating them happens when the kernel reaches `tripV1Schema`.

### `configs/trip/migrations/v0_to_v1.ts`

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

The cast on owners/accounts/expenses is safe because the kernel will re-validate against `tripV1Schema` immediately after this migration runs. If a v0 trip contains an owner/account/expense that doesn't match v1's schema, the next loop iteration throws `ConfigValidateError` — exactly the desired behavior.

### `configs/trip/definition.ts`

```ts
import { defineConfig } from "../kernel";
import { tripV0Schema } from "./schemas/v0";
import { tripV1Schema } from "./schemas/v1";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { readTripConfig, readTripConfigVersion, writeTripConfig } from "./io";

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

### `configs/trip/index.ts`

```ts
export { tripConfig } from "./definition";
export { tripV1Schema } from "./schemas/v1";
export type { TripV1 } from "./schemas/v1";
```

### `configs/index.ts`

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
export { tripConfig, tripV1Schema } from "./trip";
export type { TripV1 } from "./trip";
```

## Errors

```ts
// configs/errors.ts
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
  constructor(ns: string, loc: string, public readonly file: string) {
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
    super(ns, loc, `Failed to parse ${file}: ${(cause as Error)?.message ?? cause}`);
    this.name = "ConfigParseError";
  }
}

export class ConfigValidateError extends ConfigError {
  constructor(
    ns: string,
    loc: string,
    public readonly version: number,
    public readonly issues: import("zod").ZodIssue[],
  ) {
    super(ns, loc, `Schema validation failed at v${version} (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
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
    super(ns, loc, `Migration v${from}→v${to} failed: ${(cause as Error)?.message ?? cause}`);
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
    super(ns, loc, `Unknown version v${version} (latest supported: v${latest})`);
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

Every kernel failure is one of these. The kernel never crashes or throws untyped errors.

## Service integration

### `services/trip/loadTrip.ts` (replaces current implementation)

```ts
import { loadConfig } from "../../configs";
import { tripConfig } from "../../configs/trip";
import type { Trip } from "../../models";

export function loadTrip(tripPath: string): Trip {
  const { data } = loadConfig(tripConfig, tripPath);
  return { dirPath: tripPath, ...data };
}
```

The previous file's `normalizeTags` helper and the ad-hoc `settings.yaml` rewrite are deleted — both responsibilities move into the v0→v1 migration and the kernel's silent-rewrite step.

### `services/trip/createTrip.ts`

Currently writes the four YAML files directly. Change it to call `saveConfig(tripConfig, tripPath, { settings: { ...input, version: 1 }, owners: [], accounts: [], expenses: [] })` so new trips are created at the latest version with schema validation.

### `services/trip/listTrips.ts` — return type change

`listTrips` currently returns `Trip[]`, skipping directories without `settings.yaml`. Change it to return a discriminated union so the UI can surface broken trips:

```ts
import type { ConfigError } from "../../configs";

export type TripEntry =
  | { kind: "ok"; trip: Trip }
  | { kind: "broken"; dirPath: string; dirName: string; error: ConfigError };

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
        throw error; // unexpected errors still propagate
      }
    }
  }

  return out;
}
```

### Other mutating services unchanged

`addExpense`, `removeExpense`, `updateExpense`, `addOwner`, `removeOwner`, `updateOwner`, `addAccount`, `removeAccount`, `updateAccount`, `updateSettings` keep their current per-file `readFileSync` / `writeFileSync`. They always operate on a trip that has already been loaded through `loadConfig` (via `loadTrip`), so the on-disk shape is the latest schema by the time they touch it. Routing every mutation through `saveConfig` is a follow-up, called out under Out of scope.

## UI / TUI changes

### `TripList` screen

Reads `listTrips()` and renders each entry:

- `kind: "ok"` rows are unchanged.
- `kind: "broken"` rows render with a warning marker and dim/error color:
  - Label: `⚠ <dirName> — <error.name>`
  - `[Enter]` navigates to `/trips/broken` with the entry's `dirName`, `dirPath`, and `error` passed as route params.
  - Normal row actions (`[d]` duplicate, `[s]` settings/overview, etc.) are disabled when the focused row is broken.
  - `[x]` delete remains available so the user can clean up unrecoverable trips.

### New `TripBroken` screen

Route: `/trips/broken`. Registered in `tui/router.ts` with `borderColor: "red"`.

Route params (typed):

```ts
type TripBrokenParams = {
  dirName: string;
  dirPath: string;
  error: ConfigError;
};
```

The screen receives the params directly — it does not re-run `loadTrip`. The error captured at list-time is the source of truth; if the user has fixed the underlying file, they navigate back to the trip list, which re-runs `listTrips` and the row either heals or surfaces a different error.

The screen renders:

- Header: `Trip "<dirName>" cannot be opened`
- Path: `dirPath`
- Error class name and `error.message`
- For `ConfigValidateError`: a list of zod issues — for each issue, `path.join(".")` + `expected` vs `received`
- For `ConfigParseError`: the wrapped cause's message and the offending `file`
- For `ConfigMigrateError`: `v<from> → v<to>` and the cause's message
- For `ConfigFileMissingError`: the missing `file`
- For `ConfigUnknownVersionError`: `version` vs `latest`
- Footer hint: `Edit the file manually and return to the trip list, or press [x] to delete this trip.`

Menu: `[q]` back to trip list, `[x]` delete trip.

No auto-repair button in this iteration. The screen exists to make the failure visible and actionable, not to fix it automatically.

## Tests

### `__tests__/kernel.test.ts`

Uses synthetic in-memory definitions (no fs) to verify generic behavior:

- Stepwise migration: v0 → v1 → v2 → v3 when only stepwise migrations are defined.
- Greedy jump: v0 with migrations `{1, 3}` and latest=3 picks `v0→v3` directly.
- Greedy stops at latest: v0 with migrations `{1, 3}` and latest=2 picks `v0→v1`.
- Mid-chain validation: a buggy migration that produces a malformed shape causes `ConfigValidateError` on the *next* iteration, not the migration itself.
- `ConfigUnknownVersionError` when parsed version exceeds latest or is absent from the schema map.
- `ConfigNoMigrationPathError` when an intermediate version has no outgoing migration ≤ latest.
- `loadConfig` calls `writeConfig` exactly when `initialV < latestVersion`.
- `saveConfig` rejects invalid data with the zod error from the latest schema.

### `__tests__/trip.test.ts`

- Round-trip: `writeTripConfig` → `readTripConfig` produces a deep-equal `ConfigRaw`.
- v0 fixture (no version, mixed `tags: ["foo", {value: "bar", default: true}]`) loads → returns v1 shape with all tags as `Tag[]` and `settings.version === 1` → `settings.yaml` on disk now contains `version: 1` and the normalized tags array.
- v1 fixture loads without rewriting any file (asserted by snapshotting mtimes or by stubbing `writeFileSync`).
- Corruption fixtures throw the right error:
  - Malformed YAML → `ConfigParseError`
  - Missing `owners.yaml` → `ConfigFileMissingError`
  - Settings with `baseCurrency: "USD"` → `ConfigValidateError`
  - Settings with `version: 99` → `ConfigUnknownVersionError`

### Type-level sanity check

A test file containing only assignability assertions prevents silent drift between the hand-written model interfaces and the inferred schema types:

```ts
// __tests__/trip-types.test.ts
import type { Account, Expense, Owner, Settings } from "../../models";
import type { TripV1 } from "../trip";

// Will fail to compile if any field shape diverges.
const _settings: Settings = {} as TripV1["settings"];
const _owner: Owner       = {} as TripV1["owners"][number];
const _account: Account   = {} as TripV1["accounts"][number];
const _expense: Expense   = {} as TripV1["expenses"][number];
```

The test contains no runtime assertions — `tsc --noEmit` catches drift.

## Touched files

**New:**
- `src/core/configs/index.ts`
- `src/core/configs/kernel.ts`
- `src/core/configs/types.ts`
- `src/core/configs/errors.ts`
- `src/core/configs/trip/index.ts`
- `src/core/configs/trip/definition.ts`
- `src/core/configs/trip/io.ts`
- `src/core/configs/trip/schemas/v0.ts`
- `src/core/configs/trip/schemas/v1.ts`
- `src/core/configs/trip/migrations/v0_to_v1.ts`
- `src/core/configs/__tests__/kernel.test.ts`
- `src/core/configs/__tests__/trip.test.ts`
- `src/tui/screens/TripBroken.tsx`

**Updated:**
- `package.json` — add `zod` dependency
- `src/core/services/trip/loadTrip.ts` — replace body with `loadConfig` call
- `src/core/services/trip/createTrip.ts` — use `saveConfig`, stamp `version: 1`
- `src/core/services/trip/listTrips.ts` — return `TripEntry[]` discriminated union
- `src/core/services/trip/index.ts` — re-export `TripEntry`
- `src/core/models/settings.ts` — `version: 1` added to the `Settings` interface (keeps TS types aligned with the schema)
- `src/tui/screens/TripList.tsx` — render broken rows distinctly; disable normal actions on broken rows
- `src/tui/router.ts` — register `/trips/broken` route

**No change required:**
- The other mutating services (`addExpense`, `addOwner`, `addAccount`, `updateExpense`, `updateAccount`, etc.) — they read/write individual files and rely on `loadTrip` having normalized the data first.
- Existing data on disk — handled by the v0→v1 migration on next load.

## Out of scope

- Routing every mutating service through `saveConfig` for end-to-end validation on every write. Today's per-file `readFileSync`/`writeFileSync` calls stay; can be migrated later.
- On-disk backups before migrating (`.backups/<trip>/v<n>-<ts>/`). The decision is silent auto-migrate.
- An auto-repair button on `TripBroken`. The screen is read-only diagnostic; the user fixes files manually or deletes the trip.
- Migrating any other file format (CSV exports, etc.).
- A second namespace (`appConfig`) — the design supports it but no app-level config exists yet to implement.
- Graph search for non-greedy migration paths. The greedy selector covers every realistic case while remaining trivially predictable.
