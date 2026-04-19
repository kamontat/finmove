# Travel Expense Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TUI-based travel expense management tool with YAML data storage, multi-currency support, and CSV export.

**Architecture:** Layered modules — `src/core/` contains pure logic (models, services, validators) with zero UI deps; `src/tui/` contains React+Ink screens and atomic-design components. One function per file in core, `index.ts` re-exports. No `index.ts` in TUI — direct imports only.

**Tech Stack:** Bun, TypeScript, React + Ink + @inkjs/ui, yaml, csv-stringify, Biome

---

### Task 1: Core Models

**Files:**
- Create: `src/core/models/settings.ts`
- Create: `src/core/models/owner.ts`
- Create: `src/core/models/account.ts`
- Create: `src/core/models/expense.ts`
- Create: `src/core/models/trip.ts`
- Create: `src/core/models/index.ts`
- Test: `src/core/models/__tests__/models.test.ts`

- [ ] **Step 1: Create `src/core/models/settings.ts`**

```ts
export interface CurrencyConfig {
  exchangeRate: number;
}

export interface Settings {
  name: string;
  startDate: string;
  endDate: string;
  countries: string[];
  baseCurrency: "THB";
  currencies: Record<string, CurrencyConfig>;
  categories: string[];
  tags: string[];
  exportPath: string;
}
```

- [ ] **Step 2: Create `src/core/models/owner.ts`**

```ts
export interface Owner {
  id: string;
  name: string;
}
```

- [ ] **Step 3: Create `src/core/models/account.ts`**

```ts
export enum AccountType {
  Credit = "Credit",
  Debit = "Debit",
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owners: string[]; // owner IDs
}
```

- [ ] **Step 4: Create `src/core/models/expense.ts`**

```ts
export enum SplitType {
  Equal = "Equal",
  Percentage = "Percentage",
  Amount = "Amount",
}

export interface ExpenseOwnerSplit {
  id: string;
  split?: string | number; // "50%" or 500
}

export interface Expense {
  id: string;
  accountId: string;
  date: string;
  payee: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  owners?: string[] | ExpenseOwnerSplit[];
  description: string;
  tags: string[];
}
```

- [ ] **Step 5: Create `src/core/models/trip.ts`**

```ts
import type { Settings } from "./settings";
import type { Owner } from "./owner";
import type { Account } from "./account";
import type { Expense } from "./expense";

export interface Trip {
  dirPath: string;
  settings: Settings;
  owners: Owner[];
  accounts: Account[];
  expenses: Expense[];
}
```

- [ ] **Step 6: Create `src/core/models/index.ts`**

```ts
export type { CurrencyConfig, Settings } from "./settings";
export type { Owner } from "./owner";
export { AccountType } from "./account";
export type { Account } from "./account";
export { SplitType } from "./expense";
export type { ExpenseOwnerSplit, Expense } from "./expense";
export type { Trip } from "./trip";
```

- [ ] **Step 7: Write a smoke test for model imports**

```ts
// src/core/models/__tests__/models.test.ts
import { describe, expect, test } from "bun:test";
import { AccountType, SplitType } from "../index";
import type {
  Account,
  CurrencyConfig,
  Expense,
  ExpenseOwnerSplit,
  Owner,
  Settings,
  Trip,
} from "../index";

describe("core models", () => {
  test("AccountType enum has correct values", () => {
    expect(AccountType.Credit).toBe("Credit");
    expect(AccountType.Debit).toBe("Debit");
  });

  test("SplitType enum has correct values", () => {
    expect(SplitType.Equal).toBe("Equal");
    expect(SplitType.Percentage).toBe("Percentage");
    expect(SplitType.Amount).toBe("Amount");
  });

  test("types are structurally sound", () => {
    const owner: Owner = { id: "alice", name: "Alice" };
    expect(owner.id).toBe("alice");

    const account: Account = {
      id: "a1",
      name: "Visa",
      type: AccountType.Credit,
      owners: ["alice"],
    };
    expect(account.type).toBe("Credit");

    const expense: Expense = {
      id: "e1",
      accountId: "a1",
      date: "2026-05-01",
      payee: "Test",
      category: "Eating",
      amount: 100,
      currency: "THB",
      description: "test",
      tags: [],
    };
    expect(expense.amount).toBe(100);
  });
});
```

- [ ] **Step 8: Run tests**

Run: `bun test src/core/models/__tests__/models.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/core/models/
git commit -m "feat: add core data models for trip, owner, account, expense, settings"
```

---

### Task 2: Currency Service

**Files:**
- Create: `src/core/services/currency/convert-to-thb.ts`
- Create: `src/core/services/currency/index.ts`
- Test: `src/core/services/currency/__tests__/convert-to-thb.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/currency/__tests__/convert-to-thb.test.ts
import { describe, expect, test } from "bun:test";
import { convertToTHB } from "../convert-to-thb";

describe("convertToTHB", () => {
  test("returns amount unchanged when currency is THB", () => {
    expect(convertToTHB(100, "THB")).toBe(100);
  });

  test("converts using expense-level exchange rate", () => {
    // 2400 JPY * 0.23 = 552 THB
    expect(convertToTHB(2400, "JPY", 0.23)).toBe(552);
  });

  test("falls back to trip-level exchange rate", () => {
    // 1000 KRW * 0.027 = 27 THB
    expect(convertToTHB(1000, "KRW", undefined, 0.027)).toBe(27);
  });

  test("prefers expense rate over trip rate", () => {
    expect(convertToTHB(100, "JPY", 0.25, 0.23)).toBe(25);
  });

  test("throws when no exchange rate available for foreign currency", () => {
    expect(() => convertToTHB(100, "JPY")).toThrow(
      "No exchange rate available for JPY"
    );
  });

  test("rounds to 2 decimal places", () => {
    // 333 * 0.027 = 8.991
    expect(convertToTHB(333, "KRW", 0.027)).toBe(8.99);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/currency/__tests__/convert-to-thb.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `convert-to-thb.ts`**

```ts
// src/core/services/currency/convert-to-thb.ts
export function convertToTHB(
  amount: number,
  currency: string,
  expenseRate?: number,
  tripRate?: number
): number {
  if (currency === "THB") {
    return amount;
  }

  const rate = expenseRate ?? tripRate;
  if (rate === undefined) {
    throw new Error(`No exchange rate available for ${currency}`);
  }

  return Math.round(amount * rate * 100) / 100;
}
```

- [ ] **Step 4: Create `src/core/services/currency/index.ts`**

```ts
export { convertToTHB } from "./convert-to-thb";
```

- [ ] **Step 5: Run tests**

Run: `bun test src/core/services/currency/__tests__/convert-to-thb.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/services/currency/
git commit -m "feat: add currency conversion service with THB base"
```

---

### Task 3: Split Calculation Utility

**Files:**
- Create: `src/core/services/expense/calculate-splits.ts`
- Test: `src/core/services/expense/__tests__/calculate-splits.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/expense/__tests__/calculate-splits.test.ts
import { describe, expect, test } from "bun:test";
import { calculateSplits } from "../calculate-splits";
import type { Owner, ExpenseOwnerSplit } from "../../../models";

const allOwners: Owner[] = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "carol", name: "Carol" },
];

describe("calculateSplits", () => {
  test("omitted owners: equal split among all trip owners", () => {
    const result = calculateSplits(900, undefined, allOwners);
    expect(result).toEqual([
      { ownerId: "alice", amount: 300 },
      { ownerId: "bob", amount: 300 },
      { ownerId: "carol", amount: 300 },
    ]);
  });

  test("list of IDs: equal split among listed owners only", () => {
    const result = calculateSplits(600, ["alice", "bob"], allOwners);
    expect(result).toEqual([
      { ownerId: "alice", amount: 300 },
      { ownerId: "bob", amount: 300 },
    ]);
  });

  test("percentage split", () => {
    const splits: ExpenseOwnerSplit[] = [
      { id: "alice", split: "60%" },
      { id: "bob", split: "40%" },
    ];
    const result = calculateSplits(1000, splits, allOwners);
    expect(result).toEqual([
      { ownerId: "alice", amount: 600 },
      { ownerId: "bob", amount: 400 },
    ]);
  });

  test("fixed amount split", () => {
    const splits: ExpenseOwnerSplit[] = [
      { id: "alice", split: 700 },
      { id: "bob", split: 300 },
    ];
    const result = calculateSplits(1000, splits, allOwners);
    expect(result).toEqual([
      { ownerId: "alice", amount: 700 },
      { ownerId: "bob", amount: 300 },
    ]);
  });

  test("split with object entries but no split field: equal among listed", () => {
    const splits: ExpenseOwnerSplit[] = [
      { id: "alice" },
      { id: "bob" },
    ];
    const result = calculateSplits(400, splits, allOwners);
    expect(result).toEqual([
      { ownerId: "alice", amount: 200 },
      { ownerId: "bob", amount: 200 },
    ]);
  });

  test("rounds to 2 decimal places", () => {
    const result = calculateSplits(100, undefined, allOwners);
    // 100 / 3 = 33.33 each
    expect(result[0].amount).toBe(33.33);
    expect(result[1].amount).toBe(33.33);
    expect(result[2].amount).toBe(33.33);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/expense/__tests__/calculate-splits.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `calculate-splits.ts`**

```ts
// src/core/services/expense/calculate-splits.ts
import type { ExpenseOwnerSplit, Owner } from "../../models";

export interface OwnerAmount {
  ownerId: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isStringArray(arr: unknown[]): arr is string[] {
  return typeof arr[0] === "string";
}

export function calculateSplits(
  totalAmount: number,
  owners: string[] | ExpenseOwnerSplit[] | undefined,
  allTripOwners: Owner[]
): OwnerAmount[] {
  // Case 1: omitted — equal split among all trip owners
  if (owners === undefined || owners.length === 0) {
    const share = round2(totalAmount / allTripOwners.length);
    return allTripOwners.map((o) => ({ ownerId: o.id, amount: share }));
  }

  // Case 2: list of string IDs — equal split among listed
  if (isStringArray(owners)) {
    const share = round2(totalAmount / owners.length);
    return owners.map((id) => ({ ownerId: id, amount: share }));
  }

  // Case 3: list of ExpenseOwnerSplit objects
  const firstWithSplit = owners.find((o) => o.split !== undefined);

  // No split fields — equal split among listed
  if (firstWithSplit === undefined) {
    const share = round2(totalAmount / owners.length);
    return owners.map((o) => ({ ownerId: o.id, amount: share }));
  }

  // Percentage split
  if (typeof firstWithSplit.split === "string" && firstWithSplit.split.endsWith("%")) {
    return owners.map((o) => {
      const pct = Number.parseFloat((o.split as string).replace("%", "")) / 100;
      return { ownerId: o.id, amount: round2(totalAmount * pct) };
    });
  }

  // Fixed amount split
  return owners.map((o) => ({
    ownerId: o.id,
    amount: round2(o.split as number),
  }));
}
```

- [ ] **Step 4: Run tests**

Run: `bun test src/core/services/expense/__tests__/calculate-splits.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/services/expense/calculate-splits.ts src/core/services/expense/__tests__/
git commit -m "feat: add expense split calculation with equal, percentage, and fixed amount modes"
```

---

### Task 4: YAML I/O — Trip Service

**Files:**
- Create: `src/core/services/trip/list-trips.ts`
- Create: `src/core/services/trip/load-trip.ts`
- Create: `src/core/services/trip/create-trip.ts`
- Create: `src/core/services/trip/index.ts`
- Test: `src/core/services/trip/__tests__/trip-service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/trip/__tests__/trip-service.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { listTrips } from "../list-trips";
import { loadTrip } from "../load-trip";
import { createTrip } from "../create-trip";
import type { Settings } from "../../../models";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
  name: "Test Trip",
  startDate: "2026-05-01",
  endDate: "2026-05-07",
  countries: ["Japan"],
  baseCurrency: "THB",
  currencies: { JPY: { exchangeRate: 0.23 } },
  categories: ["Flight", "Hotels", "Transportation", "Shopping", "Eating", "Activities"],
  tags: ["test"],
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
      stringify({ owners: [{ id: "alice", name: "Alice" }] })
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/trip-service.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `list-trips.ts`**

```ts
// src/core/services/trip/list-trips.ts
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Trip } from "../../models";
import { loadTrip } from "./load-trip";

export function listTrips(dataDir: string): Trip[] {
  if (!existsSync(dataDir)) {
    return [];
  }

  const entries = readdirSync(dataDir, { withFileTypes: true });
  const trips: Trip[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tripDir = join(dataDir, entry.name);
    const settingsPath = join(tripDir, "settings.yaml");
    if (!existsSync(settingsPath)) continue;
    trips.push(loadTrip(tripDir));
  }

  return trips;
}
```

- [ ] **Step 4: Implement `load-trip.ts`**

```ts
// src/core/services/trip/load-trip.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Trip, Settings, Owner, Account, Expense } from "../../models";

export function loadTrip(tripPath: string): Trip {
  const settingsRaw = readFileSync(join(tripPath, "settings.yaml"), "utf-8");
  const ownersRaw = readFileSync(join(tripPath, "owners.yaml"), "utf-8");
  const accountsRaw = readFileSync(join(tripPath, "accounts.yaml"), "utf-8");
  const expensesRaw = readFileSync(join(tripPath, "expenses.yaml"), "utf-8");

  const settings: Settings = parse(settingsRaw);
  const owners: Owner[] = parse(ownersRaw)?.owners ?? [];
  const accounts: Account[] = parse(accountsRaw)?.accounts ?? [];
  const expenses: Expense[] = parse(expensesRaw)?.expenses ?? [];

  return {
    dirPath: tripPath,
    settings,
    owners,
    accounts,
    expenses,
  };
}
```

- [ ] **Step 5: Implement `create-trip.ts`**

```ts
// src/core/services/trip/create-trip.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Trip, Settings } from "../../models";

export function createTrip(
  dataDir: string,
  dirName: string,
  settings: Settings
): Trip {
  const tripPath = join(dataDir, dirName);
  mkdirSync(tripPath, { recursive: true });

  writeFileSync(join(tripPath, "settings.yaml"), stringify(settings));
  writeFileSync(join(tripPath, "owners.yaml"), stringify({ owners: [] }));
  writeFileSync(join(tripPath, "accounts.yaml"), stringify({ accounts: [] }));
  writeFileSync(join(tripPath, "expenses.yaml"), stringify({ expenses: [] }));

  return {
    dirPath: tripPath,
    settings,
    owners: [],
    accounts: [],
    expenses: [],
  };
}
```

- [ ] **Step 6: Create `src/core/services/trip/index.ts`**

```ts
export { listTrips } from "./list-trips";
export { loadTrip } from "./load-trip";
export { createTrip } from "./create-trip";
```

- [ ] **Step 7: Run tests**

Run: `bun test src/core/services/trip/__tests__/trip-service.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/services/trip/
git commit -m "feat: add trip service with list, load, and create operations"
```

---

### Task 5: Owner Service

**Files:**
- Create: `src/core/services/owner/get-owners.ts`
- Create: `src/core/services/owner/add-owner.ts`
- Create: `src/core/services/owner/remove-owner.ts`
- Create: `src/core/services/owner/index.ts`
- Test: `src/core/services/owner/__tests__/owner-service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/owner/__tests__/owner-service.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { getOwners } from "../get-owners";
import { addOwner } from "../add-owner";
import { removeOwner } from "../remove-owner";
import { loadTrip } from "../../trip/load-trip";
import type { Settings } from "../../../models";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
  name: "Test",
  startDate: "2026-01-01",
  endDate: "2026-01-07",
  countries: ["Japan"],
  baseCurrency: "THB",
  currencies: {},
  categories: [],
  tags: [],
  exportPath: "./expenses.csv",
};

function setupTrip() {
  const tripDir = join(TEST_DIR, "test-trip");
  mkdirSync(tripDir, { recursive: true });
  writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
  writeFileSync(
    join(tripDir, "owners.yaml"),
    stringify({ owners: [{ id: "alice", name: "Alice" }] })
  );
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

describe("getOwners", () => {
  test("returns owners from trip", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    const owners = getOwners(trip);
    expect(owners).toEqual([{ id: "alice", name: "Alice" }]);
  });
});

describe("addOwner", () => {
  test("adds an owner and persists to YAML", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    addOwner(trip, { id: "bob", name: "Bob" });

    // Reload to verify persistence
    trip = loadTrip(tripDir);
    expect(trip.owners).toHaveLength(2);
    expect(trip.owners[1]).toEqual({ id: "bob", name: "Bob" });
  });

  test("throws when adding duplicate owner ID", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(() => addOwner(trip, { id: "alice", name: "Alice2" })).toThrow(
      'Owner with id "alice" already exists'
    );
  });
});

describe("removeOwner", () => {
  test("removes an owner and persists to YAML", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    removeOwner(trip, "alice");

    trip = loadTrip(tripDir);
    expect(trip.owners).toHaveLength(0);
  });

  test("throws when removing non-existent owner", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(() => removeOwner(trip, "bob")).toThrow(
      'Owner with id "bob" not found'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/owner/__tests__/owner-service.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `get-owners.ts`**

```ts
// src/core/services/owner/get-owners.ts
import type { Owner, Trip } from "../../models";

export function getOwners(trip: Trip): Owner[] {
  return trip.owners;
}
```

- [ ] **Step 4: Implement `add-owner.ts`**

```ts
// src/core/services/owner/add-owner.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Owner, Trip } from "../../models";

export function addOwner(trip: Trip, owner: Owner): void {
  const existing = trip.owners.find((o) => o.id === owner.id);
  if (existing) {
    throw new Error(`Owner with id "${owner.id}" already exists`);
  }

  const filePath = join(trip.dirPath, "owners.yaml");
  const data = parse(readFileSync(filePath, "utf-8")) ?? { owners: [] };
  data.owners.push(owner);
  writeFileSync(filePath, stringify(data));
  trip.owners.push(owner);
}
```

- [ ] **Step 5: Implement `remove-owner.ts`**

```ts
// src/core/services/owner/remove-owner.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeOwner(trip: Trip, ownerId: string): void {
  const index = trip.owners.findIndex((o) => o.id === ownerId);
  if (index === -1) {
    throw new Error(`Owner with id "${ownerId}" not found`);
  }

  const filePath = join(trip.dirPath, "owners.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.owners.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.owners.splice(index, 1);
}
```

- [ ] **Step 6: Create `src/core/services/owner/index.ts`**

```ts
export { getOwners } from "./get-owners";
export { addOwner } from "./add-owner";
export { removeOwner } from "./remove-owner";
```

- [ ] **Step 7: Run tests**

Run: `bun test src/core/services/owner/__tests__/owner-service.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/services/owner/
git commit -m "feat: add owner service with get, add, remove operations"
```

---

### Task 6: Account Service

**Files:**
- Create: `src/core/services/account/get-accounts.ts`
- Create: `src/core/services/account/add-account.ts`
- Create: `src/core/services/account/remove-account.ts`
- Create: `src/core/services/account/index.ts`
- Test: `src/core/services/account/__tests__/account-service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/account/__tests__/account-service.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { getAccounts } from "../get-accounts";
import { addAccount } from "../add-account";
import { removeAccount } from "../remove-account";
import { loadTrip } from "../../trip/load-trip";
import { AccountType } from "../../../models";
import type { Settings } from "../../../models";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
  name: "Test",
  startDate: "2026-01-01",
  endDate: "2026-01-07",
  countries: ["Japan"],
  baseCurrency: "THB",
  currencies: {},
  categories: [],
  tags: [],
  exportPath: "./expenses.csv",
};

function setupTrip() {
  const tripDir = join(TEST_DIR, "test-trip");
  mkdirSync(tripDir, { recursive: true });
  writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
  writeFileSync(
    join(tripDir, "owners.yaml"),
    stringify({ owners: [{ id: "alice", name: "Alice" }] })
  );
  writeFileSync(
    join(tripDir, "accounts.yaml"),
    stringify({
      accounts: [
        { id: "a1", name: "Visa", type: "Credit", owners: ["alice"] },
      ],
    })
  );
  writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
  return tripDir;
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("getAccounts", () => {
  test("returns accounts from trip", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    const accounts = getAccounts(trip);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe("Visa");
  });
});

describe("addAccount", () => {
  test("adds an account and persists to YAML", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    addAccount(trip, {
      id: "a2",
      name: "Cash",
      type: AccountType.Debit,
      owners: ["alice"],
    });

    trip = loadTrip(tripDir);
    expect(trip.accounts).toHaveLength(2);
    expect(trip.accounts[1].name).toBe("Cash");
  });

  test("throws when adding duplicate account ID", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(() =>
      addAccount(trip, {
        id: "a1",
        name: "Dup",
        type: AccountType.Credit,
        owners: ["alice"],
      })
    ).toThrow('Account with id "a1" already exists');
  });

  test("throws when owner ID does not exist", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(() =>
      addAccount(trip, {
        id: "a3",
        name: "Bad",
        type: AccountType.Credit,
        owners: ["nobody"],
      })
    ).toThrow('Owner "nobody" not found');
  });
});

describe("removeAccount", () => {
  test("removes an account and persists", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    removeAccount(trip, "a1");

    trip = loadTrip(tripDir);
    expect(trip.accounts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/account/__tests__/account-service.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `get-accounts.ts`**

```ts
// src/core/services/account/get-accounts.ts
import type { Account, Trip } from "../../models";

export function getAccounts(trip: Trip): Account[] {
  return trip.accounts;
}
```

- [ ] **Step 4: Implement `add-account.ts`**

```ts
// src/core/services/account/add-account.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Account, Trip } from "../../models";

export function addAccount(trip: Trip, account: Account): void {
  const existing = trip.accounts.find((a) => a.id === account.id);
  if (existing) {
    throw new Error(`Account with id "${account.id}" already exists`);
  }

  for (const ownerId of account.owners) {
    if (!trip.owners.some((o) => o.id === ownerId)) {
      throw new Error(`Owner "${ownerId}" not found`);
    }
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8")) ?? { accounts: [] };
  data.accounts.push(account);
  writeFileSync(filePath, stringify(data));
  trip.accounts.push(account);
}
```

- [ ] **Step 5: Implement `remove-account.ts`**

```ts
// src/core/services/account/remove-account.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeAccount(trip: Trip, accountId: string): void {
  const index = trip.accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    throw new Error(`Account with id "${accountId}" not found`);
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.accounts.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.accounts.splice(index, 1);
}
```

- [ ] **Step 6: Create `src/core/services/account/index.ts`**

```ts
export { getAccounts } from "./get-accounts";
export { addAccount } from "./add-account";
export { removeAccount } from "./remove-account";
```

- [ ] **Step 7: Run tests**

Run: `bun test src/core/services/account/__tests__/account-service.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/services/account/
git commit -m "feat: add account service with get, add, remove and owner validation"
```

---

### Task 7: Expense Service

**Files:**
- Create: `src/core/services/expense/get-expenses.ts`
- Create: `src/core/services/expense/add-expense.ts`
- Create: `src/core/services/expense/remove-expense.ts`
- Create: `src/core/services/expense/index.ts`
- Test: `src/core/services/expense/__tests__/expense-service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/expense/__tests__/expense-service.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { getExpenses } from "../get-expenses";
import { addExpense } from "../add-expense";
import { removeExpense } from "../remove-expense";
import { loadTrip } from "../../trip/load-trip";
import type { Expense, Settings } from "../../../models";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
  name: "Test",
  startDate: "2026-01-01",
  endDate: "2026-01-07",
  countries: ["Japan"],
  baseCurrency: "THB",
  currencies: { JPY: { exchangeRate: 0.23 } },
  categories: ["Eating"],
  tags: [],
  exportPath: "./expenses.csv",
};

function setupTrip() {
  const tripDir = join(TEST_DIR, "test-trip");
  mkdirSync(tripDir, { recursive: true });
  writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
  writeFileSync(
    join(tripDir, "owners.yaml"),
    stringify({ owners: [{ id: "alice", name: "Alice" }] })
  );
  writeFileSync(
    join(tripDir, "accounts.yaml"),
    stringify({
      accounts: [
        { id: "a1", name: "Visa", type: "Credit", owners: ["alice"] },
      ],
    })
  );
  writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
  return tripDir;
}

const sampleExpense: Expense = {
  id: "e1",
  accountId: "a1",
  date: "2026-01-02",
  payee: "Ramen Shop",
  category: "Eating",
  amount: 1000,
  currency: "JPY",
  description: "Lunch",
  tags: ["food"],
};

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("getExpenses", () => {
  test("returns expenses from trip", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(getExpenses(trip)).toEqual([]);
  });
});

describe("addExpense", () => {
  test("adds an expense and persists to YAML", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    addExpense(trip, sampleExpense);

    trip = loadTrip(tripDir);
    expect(trip.expenses).toHaveLength(1);
    expect(trip.expenses[0].payee).toBe("Ramen Shop");
  });

  test("throws when account ID does not exist", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    expect(() =>
      addExpense(trip, { ...sampleExpense, accountId: "bad" })
    ).toThrow('Account "bad" not found');
  });

  test("throws when adding duplicate expense ID", () => {
    const tripDir = setupTrip();
    const trip = loadTrip(tripDir);
    addExpense(trip, sampleExpense);
    expect(() => addExpense(trip, sampleExpense)).toThrow(
      'Expense with id "e1" already exists'
    );
  });
});

describe("removeExpense", () => {
  test("removes an expense and persists", () => {
    const tripDir = setupTrip();
    let trip = loadTrip(tripDir);
    addExpense(trip, sampleExpense);
    removeExpense(trip, "e1");

    trip = loadTrip(tripDir);
    expect(trip.expenses).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/expense/__tests__/expense-service.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `get-expenses.ts`**

```ts
// src/core/services/expense/get-expenses.ts
import type { Expense, Trip } from "../../models";

export function getExpenses(trip: Trip): Expense[] {
  return trip.expenses;
}
```

- [ ] **Step 4: Implement `add-expense.ts`**

```ts
// src/core/services/expense/add-expense.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Expense, Trip } from "../../models";

export function addExpense(trip: Trip, expense: Expense): void {
  const existing = trip.expenses.find((e) => e.id === expense.id);
  if (existing) {
    throw new Error(`Expense with id "${expense.id}" already exists`);
  }

  if (!trip.accounts.some((a) => a.id === expense.accountId)) {
    throw new Error(`Account "${expense.accountId}" not found`);
  }

  const filePath = join(trip.dirPath, "expenses.yaml");
  const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
  data.expenses.push(expense);
  writeFileSync(filePath, stringify(data));
  trip.expenses.push(expense);
}
```

- [ ] **Step 5: Implement `remove-expense.ts`**

```ts
// src/core/services/expense/remove-expense.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeExpense(trip: Trip, expenseId: string): void {
  const index = trip.expenses.findIndex((e) => e.id === expenseId);
  if (index === -1) {
    throw new Error(`Expense with id "${expenseId}" not found`);
  }

  const filePath = join(trip.dirPath, "expenses.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.expenses.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.expenses.splice(index, 1);
}
```

- [ ] **Step 6: Create `src/core/services/expense/index.ts`**

```ts
export { getExpenses } from "./get-expenses";
export { addExpense } from "./add-expense";
export { removeExpense } from "./remove-expense";
export { calculateSplits } from "./calculate-splits";
export type { OwnerAmount } from "./calculate-splits";
```

- [ ] **Step 7: Run tests**

Run: `bun test src/core/services/expense/__tests__/`
Expected: All tests PASS (both expense-service and calculate-splits)

- [ ] **Step 8: Commit**

```bash
git add src/core/services/expense/
git commit -m "feat: add expense service with get, add, remove and account validation"
```

---

### Task 8: CSV Export Service

**Files:**
- Create: `src/core/services/export/export-csv.ts`
- Create: `src/core/services/export/index.ts`
- Test: `src/core/services/export/__tests__/export-csv.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/services/export/__tests__/export-csv.test.ts
import { describe, expect, test } from "bun:test";
import { exportCSV } from "../export-csv";
import type { Trip } from "../../../models";

function makeTripFixture(): Trip {
  return {
    dirPath: "/tmp/test-trip",
    settings: {
      name: "Test Trip",
      startDate: "2026-05-01",
      endDate: "2026-05-07",
      countries: ["Japan"],
      baseCurrency: "THB",
      currencies: { JPY: { exchangeRate: 0.23 } },
      categories: ["Eating"],
      tags: [],
      exportPath: "./expenses.csv",
    },
    owners: [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ],
    accounts: [
      { id: "a1", name: "Alice's Visa", type: "Credit" as const, owners: ["alice"] },
    ],
    expenses: [],
  };
}

describe("exportCSV", () => {
  test("produces header row when no expenses", () => {
    const trip = makeTripFixture();
    const csv = exportCSV(trip);
    expect(csv).toBe(
      '"Account","Owner","Date","Payee","Category","Amount","Description","Tags"\n'
    );
  });

  test("single expense, single owner, THB", () => {
    const trip = makeTripFixture();
    trip.expenses = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-05-02",
        payee: "7-Eleven",
        category: "Eating",
        amount: 100,
        currency: "THB",
        description: "Snacks",
        tags: ["food"],
        owners: ["alice"],
      },
    ];
    const csv = exportCSV(trip);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '"Alice\'s Visa","Alice","2026-05-02","7-Eleven","Eating","100.00","Snacks","food"'
    );
  });

  test("multi-owner expense with percentage split", () => {
    const trip = makeTripFixture();
    trip.expenses = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-05-02",
        payee: "Ichiran",
        category: "Eating",
        amount: 2400,
        currency: "JPY",
        exchangeRate: 0.23,
        description: "Ramen",
        tags: ["food", "ramen"],
        owners: [
          { id: "alice", split: "60%" },
          { id: "bob", split: "40%" },
        ],
      },
    ];
    const csv = exportCSV(trip);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    // 2400 * 0.23 = 552. Alice: 552 * 0.6 = 331.20, Bob: 552 * 0.4 = 220.80
    expect(lines[1]).toBe(
      '"Alice\'s Visa","Alice","2026-05-02","Ichiran","Eating","331.20","Ramen","food;ramen"'
    );
    expect(lines[2]).toBe(
      '"Alice\'s Visa","Bob","2026-05-02","Ichiran","Eating","220.80","Ramen","food;ramen"'
    );
  });

  test("omitted owners defaults to equal split among all trip owners", () => {
    const trip = makeTripFixture();
    trip.expenses = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-05-02",
        payee: "Taxi",
        category: "Eating",
        amount: 200,
        currency: "THB",
        description: "Taxi ride",
        tags: [],
      },
    ];
    const csv = exportCSV(trip);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    // 200 / 2 = 100 each
    expect(lines[1]).toBe(
      '"Alice\'s Visa","Alice","2026-05-02","Taxi","Eating","100.00","Taxi ride",""'
    );
    expect(lines[2]).toBe(
      '"Alice\'s Visa","Bob","2026-05-02","Taxi","Eating","100.00","Taxi ride",""'
    );
  });

  test("uses trip-level exchange rate as fallback", () => {
    const trip = makeTripFixture();
    trip.expenses = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-05-02",
        payee: "Shop",
        category: "Eating",
        amount: 1000,
        currency: "JPY",
        // no exchangeRate — should use trip's 0.23
        description: "Shopping",
        tags: [],
        owners: ["alice"],
      },
    ];
    const csv = exportCSV(trip);
    const lines = csv.trim().split("\n");
    // 1000 * 0.23 = 230
    expect(lines[1]).toBe(
      '"Alice\'s Visa","Alice","2026-05-02","Shop","Eating","230.00","Shopping",""'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/export/__tests__/export-csv.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `export-csv.ts`**

```ts
// src/core/services/export/export-csv.ts
import type { Trip, Expense } from "../../models";
import { convertToTHB } from "../currency/convert-to-thb";
import { calculateSplits } from "../expense/calculate-splits";

const HEADERS = [
  "Account",
  "Owner",
  "Date",
  "Payee",
  "Category",
  "Amount",
  "Description",
  "Tags",
];

function quoteField(value: string): string {
  return `"${value}"`;
}

function formatRow(fields: string[]): string {
  return fields.map(quoteField).join(",");
}

export function exportCSV(trip: Trip): string {
  const lines: string[] = [formatRow(HEADERS)];

  for (const expense of trip.expenses) {
    const account = trip.accounts.find((a) => a.id === expense.accountId);
    if (!account) continue;

    const tripRate = trip.settings.currencies[expense.currency]?.exchangeRate;
    const thbTotal = convertToTHB(
      expense.amount,
      expense.currency,
      expense.exchangeRate,
      tripRate
    );

    const splits = calculateSplits(thbTotal, expense.owners, trip.owners);

    for (const split of splits) {
      const owner = trip.owners.find((o) => o.id === split.ownerId);
      if (!owner) continue;

      const amount = split.amount.toFixed(2);
      const tags = expense.tags.join(";");

      lines.push(
        formatRow([
          account.name,
          owner.name,
          expense.date,
          expense.payee,
          expense.category,
          amount,
          expense.description,
          tags,
        ])
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Create `src/core/services/export/index.ts`**

```ts
export { exportCSV } from "./export-csv";
```

- [ ] **Step 5: Run tests**

Run: `bun test src/core/services/export/__tests__/export-csv.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/services/export/
git commit -m "feat: add CSV export with multi-owner row expansion and currency conversion"
```

---

### Task 9: Validators

**Files:**
- Create: `src/core/validators/validate-settings.ts`
- Create: `src/core/validators/validate-owners.ts`
- Create: `src/core/validators/validate-accounts.ts`
- Create: `src/core/validators/validate-expenses.ts`
- Create: `src/core/validators/index.ts`
- Test: `src/core/validators/__tests__/validators.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/core/validators/__tests__/validators.test.ts
import { describe, expect, test } from "bun:test";
import { validateSettings } from "../validate-settings";
import { validateOwners } from "../validate-owners";
import { validateAccounts } from "../validate-accounts";
import { validateExpenses } from "../validate-expenses";
import type { Settings, Owner, Account, Expense } from "../../models";

const validSettings: Settings = {
  name: "Test",
  startDate: "2026-01-01",
  endDate: "2026-01-07",
  countries: ["Japan"],
  baseCurrency: "THB",
  currencies: { JPY: { exchangeRate: 0.23 } },
  categories: ["Eating"],
  tags: [],
  exportPath: "./expenses.csv",
};

const validOwners: Owner[] = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
];

const validAccounts: Account[] = [
  { id: "a1", name: "Visa", type: "Credit" as const, owners: ["alice"] },
];

describe("validateSettings", () => {
  test("passes with valid settings", () => {
    expect(validateSettings(validSettings)).toEqual([]);
  });

  test("fails when name is empty", () => {
    const errors = validateSettings({ ...validSettings, name: "" });
    expect(errors.length).toBeGreaterThan(0);
  });

  test("fails when startDate is after endDate", () => {
    const errors = validateSettings({
      ...validSettings,
      startDate: "2026-01-10",
      endDate: "2026-01-01",
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("validateOwners", () => {
  test("passes with valid owners", () => {
    expect(validateOwners(validOwners)).toEqual([]);
  });

  test("fails with duplicate owner IDs", () => {
    const errors = validateOwners([
      { id: "alice", name: "Alice" },
      { id: "alice", name: "Alice2" },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("validateAccounts", () => {
  test("passes with valid accounts", () => {
    expect(validateAccounts(validAccounts, validOwners)).toEqual([]);
  });

  test("fails when account references non-existent owner", () => {
    const accounts: Account[] = [
      { id: "a1", name: "Visa", type: "Credit" as const, owners: ["nobody"] },
    ];
    const errors = validateAccounts(accounts, validOwners);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("validateExpenses", () => {
  test("passes with valid expenses", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-01-02",
        payee: "Shop",
        category: "Eating",
        amount: 100,
        currency: "THB",
        description: "test",
        tags: [],
      },
    ];
    expect(validateExpenses(expenses, validAccounts, validOwners)).toEqual([]);
  });

  test("fails when expense references non-existent account", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        accountId: "bad",
        date: "2026-01-02",
        payee: "Shop",
        category: "Eating",
        amount: 100,
        currency: "THB",
        description: "test",
        tags: [],
      },
    ];
    const errors = validateExpenses(expenses, validAccounts, validOwners);
    expect(errors.length).toBeGreaterThan(0);
  });

  test("fails when percentage split does not add to 100", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        accountId: "a1",
        date: "2026-01-02",
        payee: "Shop",
        category: "Eating",
        amount: 100,
        currency: "THB",
        description: "test",
        tags: [],
        owners: [
          { id: "alice", split: "60%" },
          { id: "bob", split: "30%" },
        ],
      },
    ];
    const errors = validateExpenses(expenses, validAccounts, validOwners);
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/validators/__tests__/validators.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `validate-settings.ts`**

```ts
// src/core/validators/validate-settings.ts
import type { Settings } from "../models";

export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];

  if (!settings.name || settings.name.trim() === "") {
    errors.push("Trip name is required");
  }

  if (!settings.startDate) {
    errors.push("Start date is required");
  }

  if (!settings.endDate) {
    errors.push("End date is required");
  }

  if (settings.startDate && settings.endDate && settings.startDate > settings.endDate) {
    errors.push("Start date must be before or equal to end date");
  }

  if (!settings.countries || settings.countries.length === 0) {
    errors.push("At least one country is required");
  }

  return errors;
}
```

- [ ] **Step 4: Implement `validate-owners.ts`**

```ts
// src/core/validators/validate-owners.ts
import type { Owner } from "../models";

export function validateOwners(owners: Owner[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const owner of owners) {
    if (ids.has(owner.id)) {
      errors.push(`Duplicate owner ID: "${owner.id}"`);
    }
    ids.add(owner.id);

    if (!owner.name || owner.name.trim() === "") {
      errors.push(`Owner "${owner.id}" must have a name`);
    }
  }

  return errors;
}
```

- [ ] **Step 5: Implement `validate-accounts.ts`**

```ts
// src/core/validators/validate-accounts.ts
import type { Account, Owner } from "../models";

export function validateAccounts(
  accounts: Account[],
  owners: Owner[]
): string[] {
  const errors: string[] = [];
  const ownerIds = new Set(owners.map((o) => o.id));
  const accountIds = new Set<string>();

  for (const account of accounts) {
    if (accountIds.has(account.id)) {
      errors.push(`Duplicate account ID: "${account.id}"`);
    }
    accountIds.add(account.id);

    for (const ownerId of account.owners) {
      if (!ownerIds.has(ownerId)) {
        errors.push(
          `Account "${account.id}" references non-existent owner "${ownerId}"`
        );
      }
    }

    if (account.owners.length === 0) {
      errors.push(`Account "${account.id}" must have at least one owner`);
    }
  }

  return errors;
}
```

- [ ] **Step 6: Implement `validate-expenses.ts`**

```ts
// src/core/validators/validate-expenses.ts
import type { Account, Expense, ExpenseOwnerSplit, Owner } from "../models";

function isExpenseOwnerSplitArray(
  arr: unknown[]
): arr is ExpenseOwnerSplit[] {
  return arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null;
}

export function validateExpenses(
  expenses: Expense[],
  accounts: Account[],
  owners: Owner[]
): string[] {
  const errors: string[] = [];
  const accountIds = new Set(accounts.map((a) => a.id));
  const ownerIds = new Set(owners.map((o) => o.id));
  const expenseIds = new Set<string>();

  for (const expense of expenses) {
    if (expenseIds.has(expense.id)) {
      errors.push(`Duplicate expense ID: "${expense.id}"`);
    }
    expenseIds.add(expense.id);

    if (!accountIds.has(expense.accountId)) {
      errors.push(
        `Expense "${expense.id}" references non-existent account "${expense.accountId}"`
      );
    }

    if (expense.owners && Array.isArray(expense.owners) && expense.owners.length > 0) {
      if (isExpenseOwnerSplitArray(expense.owners)) {
        for (const split of expense.owners) {
          if (!ownerIds.has(split.id)) {
            errors.push(
              `Expense "${expense.id}" references non-existent owner "${split.id}"`
            );
          }
        }

        // Check percentage splits add up to 100
        const firstWithSplit = expense.owners.find((o) => o.split !== undefined);
        if (
          firstWithSplit &&
          typeof firstWithSplit.split === "string" &&
          firstWithSplit.split.endsWith("%")
        ) {
          const total = expense.owners.reduce((sum, o) => {
            const pct = Number.parseFloat(
              ((o.split as string) ?? "0").replace("%", "")
            );
            return sum + pct;
          }, 0);
          if (Math.abs(total - 100) > 0.01) {
            errors.push(
              `Expense "${expense.id}" percentage splits sum to ${total}%, expected 100%`
            );
          }
        }
      } else {
        // String array of owner IDs
        for (const ownerId of expense.owners as string[]) {
          if (!ownerIds.has(ownerId)) {
            errors.push(
              `Expense "${expense.id}" references non-existent owner "${ownerId}"`
            );
          }
        }
      }
    }
  }

  return errors;
}
```

- [ ] **Step 7: Create `src/core/validators/index.ts`**

```ts
export { validateSettings } from "./validate-settings";
export { validateOwners } from "./validate-owners";
export { validateAccounts } from "./validate-accounts";
export { validateExpenses } from "./validate-expenses";
```

- [ ] **Step 8: Run tests**

Run: `bun test src/core/validators/__tests__/validators.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/core/validators/
git commit -m "feat: add validators for settings, owners, accounts, and expenses"
```

---

### Task 10: CLI Entry Point and Arg Parsing

**Files:**
- Modify: `src/main.ts`
- Test: `src/core/__tests__/parse-args.test.ts`
- Create: `src/core/parse-args.ts`

- [ ] **Step 1: Write failing test for arg parsing**

```ts
// src/core/__tests__/parse-args.test.ts
import { describe, expect, test } from "bun:test";
import { parseArgs } from "../parse-args";

describe("parseArgs", () => {
  test("returns defaults when no args", () => {
    const result = parseArgs([]);
    expect(result).toEqual({
      dataDir: "./data",
      trip: undefined,
      page: undefined,
    });
  });

  test("parses --data-dir", () => {
    const result = parseArgs(["--data-dir", "/custom/path"]);
    expect(result.dataDir).toBe("/custom/path");
  });

  test("parses --trip", () => {
    const result = parseArgs(["--trip", "japan-2026"]);
    expect(result.trip).toBe("japan-2026");
  });

  test("parses --page", () => {
    const result = parseArgs(["--trip", "japan", "--page", "expenses"]);
    expect(result.page).toBe("expenses");
  });

  test("parses all flags together", () => {
    const result = parseArgs([
      "--data-dir", "/data",
      "--trip", "korea",
      "--page", "accounts",
    ]);
    expect(result).toEqual({
      dataDir: "/data",
      trip: "korea",
      page: "accounts",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/__tests__/parse-args.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `parse-args.ts`**

```ts
// src/core/parse-args.ts
export interface AppArgs {
  dataDir: string;
  trip?: string;
  page?: string;
}

export function parseArgs(argv: string[]): AppArgs {
  const result: AppArgs = {
    dataDir: "./data",
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--data-dir":
        result.dataDir = argv[++i];
        break;
      case "--trip":
        result.trip = argv[++i];
        break;
      case "--page":
        result.page = argv[++i];
        break;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `bun test src/core/__tests__/parse-args.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Update `src/main.ts` to use arg parsing and launch Ink app**

```ts
// src/main.ts
import { render } from "ink";
import React from "react";
import { parseArgs } from "./core/parse-args";
import { App } from "./tui/app";

const args = parseArgs(process.argv.slice(2));
render(React.createElement(App, { args }));
```

- [ ] **Step 6: Commit**

```bash
git add src/core/parse-args.ts src/core/__tests__/parse-args.test.ts src/main.ts
git commit -m "feat: add CLI arg parsing and wire up Ink app entry point"
```

---

### Task 11: TUI Atoms

**Files:**
- Create: `src/tui/components/atoms/text-label.tsx`
- Create: `src/tui/components/atoms/text-input.tsx`
- Create: `src/tui/components/atoms/select-input.tsx`
- Create: `src/tui/components/atoms/checkbox.tsx`

- [ ] **Step 1: Create `text-label.tsx`**

```tsx
// src/tui/components/atoms/text-label.tsx
import { Text } from "ink";
import React from "react";

interface TextLabelProps {
  text: string;
  bold?: boolean;
  color?: string;
  dimColor?: boolean;
}

export function TextLabel({ text, bold, color, dimColor }: TextLabelProps) {
  return (
    <Text bold={bold} color={color} dimColor={dimColor}>
      {text}
    </Text>
  );
}
```

- [ ] **Step 2: Create `text-input.tsx`**

```tsx
// src/tui/components/atoms/text-input.tsx
import { TextInput as InkTextInput } from "@inkjs/ui";
import React from "react";

interface TextInputProps {
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
}

export function TextInput({ placeholder, defaultValue, onSubmit }: TextInputProps) {
  return (
    <InkTextInput
      placeholder={placeholder}
      defaultValue={defaultValue}
      onSubmit={onSubmit}
    />
  );
}
```

- [ ] **Step 3: Create `select-input.tsx`**

```tsx
// src/tui/components/atoms/select-input.tsx
import { Select } from "@inkjs/ui";
import React from "react";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectInput({ options, onChange }: SelectInputProps) {
  return <Select options={options} onChange={onChange} />;
}
```

- [ ] **Step 4: Create `checkbox.tsx`**

```tsx
// src/tui/components/atoms/checkbox.tsx
import { Text } from "ink";
import React from "react";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function Checkbox({ label, checked }: CheckboxProps) {
  return (
    <Text>
      {checked ? "[x] " : "[ ] "}
      {label}
    </Text>
  );
}
```

- [ ] **Step 5: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/tui/components/atoms/
git commit -m "feat: add TUI atom components — text-label, text-input, select-input, checkbox"
```

---

### Task 12: TUI Molecules

**Files:**
- Create: `src/tui/components/molecules/form-field.tsx`
- Create: `src/tui/components/molecules/confirm-prompt.tsx`
- Create: `src/tui/components/molecules/list-item.tsx`

- [ ] **Step 1: Create `form-field.tsx`**

```tsx
// src/tui/components/molecules/form-field.tsx
import { Box } from "ink";
import React from "react";
import { TextLabel } from "../atoms/text-label";
import { TextInput } from "../atoms/text-input";

interface FormFieldProps {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
}

export function FormField({ label, placeholder, defaultValue, onSubmit }: FormFieldProps) {
  return (
    <Box flexDirection="column">
      <TextLabel text={label} bold />
      <TextInput
        placeholder={placeholder}
        defaultValue={defaultValue}
        onSubmit={onSubmit}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Create `confirm-prompt.tsx`**

```tsx
// src/tui/components/molecules/confirm-prompt.tsx
import { ConfirmInput } from "@inkjs/ui";
import { Box } from "ink";
import React from "react";
import { TextLabel } from "../atoms/text-label";

interface ConfirmPromptProps {
  message: string;
  onConfirm: (confirmed: boolean) => void;
}

export function ConfirmPrompt({ message, onConfirm }: ConfirmPromptProps) {
  return (
    <Box flexDirection="column">
      <TextLabel text={message} bold />
      <ConfirmInput onConfirm={onConfirm} />
    </Box>
  );
}
```

- [ ] **Step 3: Create `list-item.tsx`**

```tsx
// src/tui/components/molecules/list-item.tsx
import { Box, Text } from "ink";
import React from "react";

interface ListItemProps {
  icon?: string;
  label: string;
  detail?: string;
}

export function ListItem({ icon, label, detail }: ListItemProps) {
  return (
    <Box gap={1}>
      {icon && <Text>{icon}</Text>}
      <Text>{label}</Text>
      {detail && <Text dimColor>{detail}</Text>}
    </Box>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/tui/components/molecules/
git commit -m "feat: add TUI molecule components — form-field, confirm-prompt, list-item"
```

---

### Task 13: TUI Organisms

**Files:**
- Create: `src/tui/components/organisms/data-table.tsx`
- Create: `src/tui/components/organisms/navigation-menu.tsx`

- [ ] **Step 1: Create `data-table.tsx`**

```tsx
// src/tui/components/organisms/data-table.tsx
import { Box, Text } from "ink";
import React from "react";

interface DataTableProps {
  headers: string[];
  rows: string[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce(
      (max, row) => Math.max(max, (row[i] ?? "").length),
      0
    );
    return Math.max(h.length, maxData) + 2;
  });

  return (
    <Box flexDirection="column">
      <Box>
        {headers.map((h, i) => (
          <Box key={h} width={colWidths[i]}>
            <Text bold>{h}</Text>
          </Box>
        ))}
      </Box>
      {rows.map((row, ri) => (
        <Box key={`row-${ri}`}>
          {row.map((cell, ci) => (
            <Box key={`cell-${ri}-${ci}`} width={colWidths[ci]}>
              <Text>{cell}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Create `navigation-menu.tsx`**

```tsx
// src/tui/components/organisms/navigation-menu.tsx
import { Box } from "ink";
import React from "react";
import { SelectInput } from "../atoms/select-input";
import { TextLabel } from "../atoms/text-label";
import type { SelectOption } from "../atoms/select-input";

interface NavigationMenuProps {
  title: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
}

export function NavigationMenu({ title, options, onSelect }: NavigationMenuProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text={title} bold color="cyan" />
      <SelectInput options={options} onChange={onSelect} />
    </Box>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/tui/components/organisms/
git commit -m "feat: add TUI organism components — data-table, navigation-menu"
```

---

### Task 14: TUI Screens — Trip List and Trip Menu

**Files:**
- Create: `src/tui/screens/trip-list.tsx`
- Create: `src/tui/screens/trip-menu.tsx`

- [ ] **Step 1: Create `trip-list.tsx`**

```tsx
// src/tui/screens/trip-list.tsx
import { Box } from "ink";
import React, { useState } from "react";
import { listTrips } from "../../core/services/trip";
import { NavigationMenu } from "../components/organisms/navigation-menu";
import { FormField } from "../components/molecules/form-field";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip } from "../../core/models";

interface TripListProps {
  dataDir: string;
  onSelectTrip: (trip: Trip) => void;
  onCreateTrip: (dirName: string) => void;
}

export function TripList({ dataDir, onSelectTrip, onCreateTrip }: TripListProps) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const trips = listTrips(dataDir);

  if (mode === "create") {
    return (
      <Box flexDirection="column" gap={1}>
        <TextLabel text="Create New Trip" bold color="cyan" />
        <FormField
          label="Trip directory name:"
          placeholder="e.g. japan-2026"
          onSubmit={(name) => onCreateTrip(name)}
        />
      </Box>
    );
  }

  const options = [
    ...trips.map((t) => ({
      label: `${t.settings.name} (${t.settings.startDate} — ${t.settings.endDate})`,
      value: t.dirPath,
    })),
    { label: "+ Create new trip", value: "__create__" },
  ];

  return (
    <NavigationMenu
      title="Select a Trip"
      options={options}
      onSelect={(value) => {
        if (value === "__create__") {
          setMode("create");
          return;
        }
        const trip = trips.find((t) => t.dirPath === value);
        if (trip) onSelectTrip(trip);
      }}
    />
  );
}
```

- [ ] **Step 2: Create `trip-menu.tsx`**

```tsx
// src/tui/screens/trip-menu.tsx
import { Box } from "ink";
import React from "react";
import { NavigationMenu } from "../components/organisms/navigation-menu";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip } from "../../core/models";

export type TripPage = "owners" | "accounts" | "expenses" | "export";

interface TripMenuProps {
  trip: Trip;
  onNavigate: (page: TripPage) => void;
  onBack: () => void;
}

export function TripMenu({ trip, onNavigate, onBack }: TripMenuProps) {
  const { settings } = trip;

  const options = [
    { label: "Owners", value: "owners" },
    { label: "Accounts", value: "accounts" },
    { label: "Expenses", value: "expenses" },
    { label: "Export CSV", value: "export" },
    { label: "Back", value: "__back__" },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text={settings.name} bold color="cyan" />
      <TextLabel
        text={`${settings.startDate} — ${settings.endDate} | ${settings.countries.join(", ")}`}
        dimColor
      />
      <NavigationMenu
        title="Menu"
        options={options}
        onSelect={(value) => {
          if (value === "__back__") {
            onBack();
            return;
          }
          onNavigate(value as TripPage);
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/trip-list.tsx src/tui/screens/trip-menu.tsx
git commit -m "feat: add trip list and trip menu TUI screens"
```

---

### Task 15: TUI Screens — Owner List, Account List

**Files:**
- Create: `src/tui/screens/owner-list.tsx`
- Create: `src/tui/screens/account-list.tsx`

- [ ] **Step 1: Create `owner-list.tsx`**

```tsx
// src/tui/screens/owner-list.tsx
import { Box } from "ink";
import React, { useState } from "react";
import { addOwner, removeOwner } from "../../core/services/owner";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";
import { FormField } from "../components/molecules/form-field";
import { ConfirmPrompt } from "../components/molecules/confirm-prompt";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip } from "../../core/models";

interface OwnerListProps {
  trip: Trip;
  onBack: () => void;
  onTripUpdated: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "remove";

export function OwnerList({ trip, onBack, onTripUpdated }: OwnerListProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [newId, setNewId] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (mode === "add-id") {
    return (
      <FormField
        label="Owner ID (slug):"
        placeholder="e.g. alice"
        onSubmit={(id) => {
          setNewId(id);
          setMode("add-name");
        }}
      />
    );
  }

  if (mode === "add-name") {
    return (
      <FormField
        label="Owner display name:"
        placeholder="e.g. Alice"
        onSubmit={(name) => {
          addOwner(trip, { id: newId, name });
          onTripUpdated();
          setMode("list");
        }}
      />
    );
  }

  if (mode === "remove" && removeId) {
    return (
      <ConfirmPrompt
        message={`Remove owner "${removeId}"?`}
        onConfirm={(yes) => {
          if (yes) {
            removeOwner(trip, removeId);
            onTripUpdated();
          }
          setRemoveId(null);
          setMode("list");
        }}
      />
    );
  }

  const rows = trip.owners.map((o) => [o.id, o.name]);

  const menuOptions = [
    { label: "Add owner", value: "add" },
    ...trip.owners.map((o) => ({
      label: `Remove ${o.name}`,
      value: `remove:${o.id}`,
    })),
    { label: "Back", value: "__back__" },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text="Owners" bold color="cyan" />
      {rows.length > 0 && <DataTable headers={["ID", "Name"]} rows={rows} />}
      {rows.length === 0 && <TextLabel text="No owners yet." dimColor />}
      <NavigationMenu
        title="Actions"
        options={menuOptions}
        onSelect={(value) => {
          if (value === "__back__") return onBack();
          if (value === "add") return setMode("add-id");
          if (value.startsWith("remove:")) {
            setRemoveId(value.replace("remove:", ""));
            setMode("remove");
          }
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Create `account-list.tsx`**

```tsx
// src/tui/screens/account-list.tsx
import { Box } from "ink";
import React, { useState } from "react";
import { addAccount, removeAccount } from "../../core/services/account";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";
import { FormField } from "../components/molecules/form-field";
import { TextLabel } from "../components/atoms/text-label";
import { SelectInput } from "../components/atoms/select-input";
import { AccountType } from "../../core/models";
import type { Trip } from "../../core/models";

interface AccountListProps {
  trip: Trip;
  onBack: () => void;
  onTripUpdated: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "add-type" | "add-owners";

export function AccountList({ trip, onBack, onTripUpdated }: AccountListProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>(AccountType.Credit);

  if (mode === "add-id") {
    return (
      <FormField
        label="Account ID (slug):"
        placeholder="e.g. alice-credit"
        onSubmit={(id) => {
          setNewId(id);
          setMode("add-name");
        }}
      />
    );
  }

  if (mode === "add-name") {
    return (
      <FormField
        label="Account display name:"
        placeholder="e.g. Alice's Visa"
        onSubmit={(name) => {
          setNewName(name);
          setMode("add-type");
        }}
      />
    );
  }

  if (mode === "add-type") {
    return (
      <Box flexDirection="column">
        <TextLabel text="Account type:" bold />
        <SelectInput
          options={[
            { label: "Credit", value: "Credit" },
            { label: "Debit", value: "Debit" },
          ]}
          onChange={(value) => {
            setNewType(value as AccountType);
            setMode("add-owners");
          }}
        />
      </Box>
    );
  }

  if (mode === "add-owners") {
    return (
      <FormField
        label="Owner IDs (comma-separated):"
        placeholder="e.g. alice,bob"
        onSubmit={(ownersStr) => {
          const owners = ownersStr.split(",").map((s) => s.trim());
          addAccount(trip, { id: newId, name: newName, type: newType, owners });
          onTripUpdated();
          setMode("list");
        }}
      />
    );
  }

  const rows = trip.accounts.map((a) => [
    a.id,
    a.name,
    a.type,
    a.owners.join(", "),
  ]);

  const menuOptions = [
    { label: "Add account", value: "add" },
    ...trip.accounts.map((a) => ({
      label: `Remove ${a.name}`,
      value: `remove:${a.id}`,
    })),
    { label: "Back", value: "__back__" },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text="Accounts" bold color="cyan" />
      {rows.length > 0 && (
        <DataTable headers={["ID", "Name", "Type", "Owners"]} rows={rows} />
      )}
      {rows.length === 0 && <TextLabel text="No accounts yet." dimColor />}
      <NavigationMenu
        title="Actions"
        options={menuOptions}
        onSelect={(value) => {
          if (value === "__back__") return onBack();
          if (value === "add") return setMode("add-id");
          if (value.startsWith("remove:")) {
            removeAccount(trip, value.replace("remove:", ""));
            onTripUpdated();
          }
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/owner-list.tsx src/tui/screens/account-list.tsx
git commit -m "feat: add owner list and account list TUI screens"
```

---

### Task 16: TUI Screens — Expense List and Expense Form

**Files:**
- Create: `src/tui/screens/expense-list.tsx`
- Create: `src/tui/screens/expense-form.tsx`

- [ ] **Step 1: Create `expense-list.tsx`**

```tsx
// src/tui/screens/expense-list.tsx
import { Box } from "ink";
import React, { useState } from "react";
import { removeExpense } from "../../core/services/expense";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip } from "../../core/models";

interface ExpenseListProps {
  trip: Trip;
  onBack: () => void;
  onTripUpdated: () => void;
  onAddExpense: () => void;
  onEditExpense: (expenseId: string) => void;
}

export function ExpenseList({
  trip,
  onBack,
  onTripUpdated,
  onAddExpense,
  onEditExpense,
}: ExpenseListProps) {
  const rows = trip.expenses.map((e) => {
    const account = trip.accounts.find((a) => a.id === e.accountId);
    return [
      e.date,
      account?.name ?? e.accountId,
      e.payee,
      e.category,
      `${e.amount} ${e.currency}`,
    ];
  });

  const menuOptions = [
    { label: "Add expense", value: "add" },
    ...trip.expenses.map((e) => ({
      label: `Edit: ${e.date} ${e.payee} (${e.amount} ${e.currency})`,
      value: `edit:${e.id}`,
    })),
    ...trip.expenses.map((e) => ({
      label: `Delete: ${e.date} ${e.payee}`,
      value: `delete:${e.id}`,
    })),
    { label: "Back", value: "__back__" },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text="Expenses" bold color="cyan" />
      {rows.length > 0 && (
        <DataTable
          headers={["Date", "Account", "Payee", "Category", "Amount"]}
          rows={rows}
        />
      )}
      {rows.length === 0 && <TextLabel text="No expenses yet." dimColor />}
      <NavigationMenu
        title="Actions"
        options={menuOptions}
        onSelect={(value) => {
          if (value === "__back__") return onBack();
          if (value === "add") return onAddExpense();
          if (value.startsWith("edit:"))
            return onEditExpense(value.replace("edit:", ""));
          if (value.startsWith("delete:")) {
            removeExpense(trip, value.replace("delete:", ""));
            onTripUpdated();
          }
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Create `expense-form.tsx`**

```tsx
// src/tui/screens/expense-form.tsx
import { Box } from "ink";
import React, { useState } from "react";
import { addExpense } from "../../core/services/expense";
import { FormField } from "../components/molecules/form-field";
import { SelectInput } from "../components/atoms/select-input";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip, Expense } from "../../core/models";

interface ExpenseFormProps {
  trip: Trip;
  existingExpense?: Expense;
  onDone: () => void;
}

type FormStep =
  | "account"
  | "date"
  | "payee"
  | "category"
  | "amount"
  | "currency"
  | "exchangeRate"
  | "owners"
  | "description"
  | "tags";

export function ExpenseForm({ trip, existingExpense, onDone }: ExpenseFormProps) {
  const [step, setStep] = useState<FormStep>("account");
  const [accountId, setAccountId] = useState(existingExpense?.accountId ?? "");
  const [date, setDate] = useState(existingExpense?.date ?? "");
  const [payee, setPayee] = useState(existingExpense?.payee ?? "");
  const [category, setCategory] = useState(existingExpense?.category ?? "");
  const [amount, setAmount] = useState(existingExpense?.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(existingExpense?.currency ?? "THB");
  const [exchangeRate, setExchangeRate] = useState(
    existingExpense?.exchangeRate?.toString() ?? ""
  );
  const [owners, setOwners] = useState("");
  const [description, setDescription] = useState(existingExpense?.description ?? "");

  const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

  switch (step) {
    case "account":
      return (
        <Box flexDirection="column">
          <TextLabel text="Select account:" bold />
          <SelectInput
            options={trip.accounts.map((a) => ({
              label: `${a.name} (${a.type})`,
              value: a.id,
            }))}
            onChange={(value) => {
              setAccountId(value);
              setStep("date");
            }}
          />
        </Box>
      );

    case "date":
      return (
        <FormField
          label="Date (YYYY-MM-DD):"
          defaultValue={date}
          onSubmit={(v) => {
            setDate(v);
            setStep("payee");
          }}
        />
      );

    case "payee":
      return (
        <FormField
          label="Payee:"
          defaultValue={payee}
          onSubmit={(v) => {
            setPayee(v);
            setStep("category");
          }}
        />
      );

    case "category":
      return (
        <Box flexDirection="column">
          <TextLabel text="Category:" bold />
          <SelectInput
            options={trip.settings.categories.map((c) => ({
              label: c,
              value: c,
            }))}
            onChange={(value) => {
              setCategory(value);
              setStep("amount");
            }}
          />
        </Box>
      );

    case "amount":
      return (
        <FormField
          label="Amount:"
          defaultValue={amount}
          onSubmit={(v) => {
            setAmount(v);
            setStep("currency");
          }}
        />
      );

    case "currency":
      return (
        <Box flexDirection="column">
          <TextLabel text="Currency:" bold />
          <SelectInput
            options={allCurrencies.map((c) => ({ label: c, value: c }))}
            onChange={(value) => {
              setCurrency(value);
              setStep(value === "THB" ? "owners" : "exchangeRate");
            }}
          />
        </Box>
      );

    case "exchangeRate": {
      const tripRate = trip.settings.currencies[currency]?.exchangeRate;
      return (
        <FormField
          label={`Exchange rate (1 ${currency} = ? THB)${tripRate ? ` [default: ${tripRate}]` : ""}:`}
          onSubmit={(v) => {
            setExchangeRate(v);
            setStep("owners");
          }}
        />
      );
    }

    case "owners":
      return (
        <FormField
          label="Expense owner IDs (comma-separated, empty for all):"
          placeholder={trip.owners.map((o) => o.id).join(",")}
          onSubmit={(v) => {
            setOwners(v);
            setStep("description");
          }}
        />
      );

    case "description":
      return (
        <FormField
          label="Description:"
          defaultValue={description}
          onSubmit={(v) => {
            setDescription(v);
            setStep("tags");
          }}
        />
      );

    case "tags":
      return (
        <FormField
          label="Tags (comma-separated):"
          onSubmit={(tagsStr) => {
            const tags = tagsStr
              ? tagsStr.split(",").map((s) => s.trim())
              : [];
            const ownerList =
              owners.trim() === ""
                ? undefined
                : owners.split(",").map((s) => s.trim());

            const id =
              existingExpense?.id ??
              `exp-${Date.now()}`;

            const expense: Expense = {
              id,
              accountId,
              date,
              payee,
              category,
              amount: Number.parseFloat(amount),
              currency,
              exchangeRate: exchangeRate
                ? Number.parseFloat(exchangeRate)
                : undefined,
              owners: ownerList,
              description,
              tags,
            };

            addExpense(trip, expense);
            onDone();
          }}
        />
      );
  }
}
```

- [ ] **Step 3: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/expense-list.tsx src/tui/screens/expense-form.tsx
git commit -m "feat: add expense list and expense form TUI screens"
```

---

### Task 17: TUI Screen — Export

**Files:**
- Create: `src/tui/screens/export.tsx`

- [ ] **Step 1: Create `export.tsx`**

```tsx
// src/tui/screens/export.tsx
import { Box, Text } from "ink";
import React, { useState } from "react";
import { writeFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { exportCSV } from "../../core/services/export";
import { FormField } from "../components/molecules/form-field";
import { ConfirmPrompt } from "../components/molecules/confirm-prompt";
import { TextLabel } from "../components/atoms/text-label";
import type { Trip } from "../../core/models";

interface ExportScreenProps {
  trip: Trip;
  onBack: () => void;
}

type Mode = "path" | "preview" | "done";

export function ExportScreen({ trip, onBack }: ExportScreenProps) {
  const [mode, setMode] = useState<Mode>("path");
  const [exportPath, setExportPath] = useState(trip.settings.exportPath);

  if (mode === "path") {
    return (
      <FormField
        label="Export path:"
        defaultValue={exportPath}
        onSubmit={(path) => {
          setExportPath(path);
          setMode("preview");
        }}
      />
    );
  }

  const csv = exportCSV(trip);

  if (mode === "preview") {
    const previewLines = csv.split("\n").slice(0, 6);
    return (
      <Box flexDirection="column" gap={1}>
        <TextLabel text="CSV Preview:" bold color="cyan" />
        <Box flexDirection="column">
          {previewLines.map((line, i) => (
            <Text key={`line-${i}`}>{line}</Text>
          ))}
          {csv.split("\n").length > 6 && (
            <Text dimColor>... and {csv.split("\n").length - 6} more rows</Text>
          )}
        </Box>
        <ConfirmPrompt
          message="Export this CSV?"
          onConfirm={(yes) => {
            if (yes) {
              const fullPath = isAbsolute(exportPath)
                ? exportPath
                : join(trip.dirPath, exportPath);
              writeFileSync(fullPath, csv);
              setMode("done");
            } else {
              onBack();
            }
          }}
        />
      </Box>
    );
  }

  // mode === "done"
  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text="CSV exported successfully!" bold color="green" />
      <TextLabel text={`Path: ${exportPath}`} dimColor />
      <ConfirmPrompt
        message="Go back?"
        onConfirm={() => onBack()}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/export.tsx
git commit -m "feat: add CSV export TUI screen with path editing and preview"
```

---

### Task 18: TUI App — Root Router

**Files:**
- Create: `src/tui/app.tsx`

- [ ] **Step 1: Create `app.tsx`**

```tsx
// src/tui/app.tsx
import { Box } from "ink";
import React, { useState, useCallback } from "react";
import { join } from "node:path";
import { loadTrip } from "../core/services/trip/load-trip";
import { createTrip } from "../core/services/trip/create-trip";
import type { AppArgs } from "../core/parse-args";
import type { Trip } from "../core/models";
import type { TripPage } from "./screens/trip-menu";
import { TripList } from "./screens/trip-list";
import { TripMenu } from "./screens/trip-menu";
import { OwnerList } from "./screens/owner-list";
import { AccountList } from "./screens/account-list";
import { ExpenseList } from "./screens/expense-list";
import { ExpenseForm } from "./screens/expense-form";
import { ExportScreen } from "./screens/export";

type Screen =
  | { type: "trip-list" }
  | { type: "trip-menu"; trip: Trip }
  | { type: "owners"; trip: Trip }
  | { type: "accounts"; trip: Trip }
  | { type: "expenses"; trip: Trip }
  | { type: "expense-form"; trip: Trip; expenseId?: string }
  | { type: "export"; trip: Trip };

function getInitialScreen(args: AppArgs): Screen {
  if (args.trip) {
    const tripPath = join(args.dataDir, args.trip);
    try {
      const trip = loadTrip(tripPath);
      if (args.page) {
        const pageMap: Record<string, Screen["type"]> = {
          owners: "owners",
          accounts: "accounts",
          expenses: "expenses",
          export: "export",
        };
        const screenType = pageMap[args.page];
        if (screenType) {
          return { type: screenType, trip } as Screen;
        }
      }
      return { type: "trip-menu", trip };
    } catch {
      return { type: "trip-list" };
    }
  }
  return { type: "trip-list" };
}

interface AppProps {
  args: AppArgs;
}

export function App({ args }: AppProps) {
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen(args));

  const reloadTrip = useCallback(
    (trip: Trip) => loadTrip(trip.dirPath),
    []
  );

  const defaultSettings = {
    name: "",
    startDate: "",
    endDate: "",
    countries: [],
    baseCurrency: "THB" as const,
    currencies: {},
    categories: [
      "Flight",
      "Hotels",
      "Transportation",
      "Shopping",
      "Eating",
      "Activities",
    ],
    tags: [],
    exportPath: "./expenses.csv",
  };

  switch (screen.type) {
    case "trip-list":
      return (
        <TripList
          dataDir={args.dataDir}
          onSelectTrip={(trip) => setScreen({ type: "trip-menu", trip })}
          onCreateTrip={(dirName) => {
            const trip = createTrip(args.dataDir, dirName, {
              ...defaultSettings,
              name: dirName,
            });
            setScreen({ type: "trip-menu", trip });
          }}
        />
      );

    case "trip-menu":
      return (
        <TripMenu
          trip={screen.trip}
          onNavigate={(page) =>
            setScreen({ type: page, trip: screen.trip } as Screen)
          }
          onBack={() => setScreen({ type: "trip-list" })}
        />
      );

    case "owners":
      return (
        <OwnerList
          trip={screen.trip}
          onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
          onTripUpdated={() => {
            const updated = reloadTrip(screen.trip);
            setScreen({ type: "owners", trip: updated });
          }}
        />
      );

    case "accounts":
      return (
        <AccountList
          trip={screen.trip}
          onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
          onTripUpdated={() => {
            const updated = reloadTrip(screen.trip);
            setScreen({ type: "accounts", trip: updated });
          }}
        />
      );

    case "expenses":
      return (
        <ExpenseList
          trip={screen.trip}
          onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
          onTripUpdated={() => {
            const updated = reloadTrip(screen.trip);
            setScreen({ type: "expenses", trip: updated });
          }}
          onAddExpense={() =>
            setScreen({ type: "expense-form", trip: screen.trip })
          }
          onEditExpense={(id) =>
            setScreen({ type: "expense-form", trip: screen.trip, expenseId: id })
          }
        />
      );

    case "expense-form": {
      const existing = screen.expenseId
        ? screen.trip.expenses.find((e) => e.id === screen.expenseId)
        : undefined;
      return (
        <ExpenseForm
          trip={screen.trip}
          existingExpense={existing}
          onDone={() => {
            const updated = reloadTrip(screen.trip);
            setScreen({ type: "expenses", trip: updated });
          }}
        />
      );
    }

    case "export":
      return (
        <ExportScreen
          trip={screen.trip}
          onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
        />
      );
  }
}
```

- [ ] **Step 2: Run type check**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 3: Run the app to verify it launches**

Run: `bun run start`
Expected: Ink app renders the trip list screen (likely empty since no trips exist)

- [ ] **Step 4: Commit**

```bash
git add src/tui/app.tsx
git commit -m "feat: add root app router with screen navigation and CLI arg support"
```

---

### Task 19: End-to-End Manual Smoke Test

**Files:** None — this is a manual integration test.

- [ ] **Step 1: Run all unit tests**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 2: Run type checker**

Run: `bun run check:type`
Expected: No type errors

- [ ] **Step 3: Run linter**

Run: `bun run check`
Expected: No lint errors (may need `bun run fix` first)

- [ ] **Step 4: Fix any lint issues**

Run: `bun run fix`
Then run: `bun run check`
Expected: Clean

- [ ] **Step 5: Manual smoke test — create trip**

Run: `bun run start`
- Select "Create new trip"
- Enter directory name: `test-trip`
- Verify the trip menu appears

- [ ] **Step 6: Manual smoke test — add owners, accounts, expenses, export**

- Navigate to Owners, add 2 owners
- Navigate to Accounts, add an account
- Navigate to Expenses, add an expense
- Navigate to Export CSV, verify preview and export

- [ ] **Step 7: Verify exported CSV format**

Run: `cat data/test-trip/expenses.csv`
Expected: All fields wrapped in double quotes, one row per owner, correct THB conversion

- [ ] **Step 8: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues from integration testing"
```

---

### Task 20: Test with CLI flags

**Files:** None — validation only.

- [ ] **Step 1: Test --trip flag**

Run: `bun run start -- --trip test-trip`
Expected: Skips trip list, goes directly to test-trip menu

- [ ] **Step 2: Test --trip and --page flags**

Run: `bun run start -- --trip test-trip --page expenses`
Expected: Skips to expenses screen for test-trip

- [ ] **Step 3: Test --data-dir flag**

```bash
mkdir -p /tmp/finmove-test
bun run start -- --data-dir /tmp/finmove-test
```
Expected: Shows empty trip list using the custom data directory

- [ ] **Step 4: Clean up test data**

```bash
rm -rf data/test-trip /tmp/finmove-test
```
