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
