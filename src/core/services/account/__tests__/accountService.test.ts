import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { AccountType } from "../../../models";
import { loadTrip } from "../../trip/loadTrip";
import { addAccount } from "../addAccount";
import { getAccounts } from "../getAccounts";
import { removeAccount } from "../removeAccount";
import { updateAccount } from "../updateAccount";

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
		stringify({ owners: [{ id: "alice", name: "Alice" }] }),
	);
	writeFileSync(
		join(tripDir, "accounts.yaml"),
		stringify({
			accounts: [{ id: "a1", name: "Visa", type: "Credit", owners: ["alice"] }],
		}),
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
			}),
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
			}),
		).toThrow('Owner "nobody" not found');
	});
});

describe("updateAccount", () => {
	test("throws when updated owners include unknown ID", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		expect(() =>
			updateAccount(trip, "a1", { owners: ["alice", "nobody"] }),
		).toThrow('Owner "nobody" not found');
	});

	test("allows update when all owner IDs are known", () => {
		const tripDir = setupTrip();
		let trip = loadTrip(tripDir);
		updateAccount(trip, "a1", { name: "Renamed", owners: ["alice"] });
		trip = loadTrip(tripDir);
		expect(trip.accounts[0].name).toBe("Renamed");
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
