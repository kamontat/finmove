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
