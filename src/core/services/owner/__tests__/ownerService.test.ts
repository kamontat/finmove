import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Account, Expense, Settings } from "../../../models";
import { AccountType } from "../../../models";
import { loadTrip } from "../../trip/loadTrip";
import { addOwner } from "../addOwner";
import { findOwnerReferences } from "../findOwnerReferences";
import { getOwners } from "../getOwners";
import { removeOwner } from "../removeOwner";

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

interface SetupOptions {
	accounts?: Account[];
	expenses?: Expense[];
}

function setupTrip(opts: SetupOptions = {}) {
	const tripDir = join(TEST_DIR, "test-trip");
	mkdirSync(tripDir, { recursive: true });
	writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
	writeFileSync(
		join(tripDir, "owners.yaml"),
		stringify({ owners: [{ id: "alice", name: "Alice" }] }),
	);
	writeFileSync(
		join(tripDir, "accounts.yaml"),
		stringify({ accounts: opts.accounts ?? [] }),
	);
	writeFileSync(
		join(tripDir, "expenses.yaml"),
		stringify({ expenses: opts.expenses ?? [] }),
	);
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
			'Owner with id "alice" already exists',
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
			'Owner with id "bob" not found',
		);
	});

	test("throws when an account references the owner", () => {
		const tripDir = setupTrip({
			accounts: [
				{ id: "a1", name: "Visa", type: AccountType.Credit, owners: ["alice"] },
			],
		});
		const trip = loadTrip(tripDir);
		expect(() => removeOwner(trip, "alice")).toThrow(
			'Owner "alice" is referenced by 1 account(s) and 0 expense(s)',
		);

		const reloaded = loadTrip(tripDir);
		expect(reloaded.owners).toHaveLength(1);
	});

	test("throws when an expense references the owner", () => {
		const tripDir = setupTrip({
			expenses: [
				{
					id: "e1",
					accountId: "a1",
					date: "2026-01-01",
					payee: "Cafe",
					category: "Food",
					amount: 100,
					currency: "THB",
					owners: ["alice"],
					description: "",
					tags: [],
				},
			],
		});
		const trip = loadTrip(tripDir);
		expect(() => removeOwner(trip, "alice")).toThrow(
			'Owner "alice" is referenced by 0 account(s) and 1 expense(s)',
		);

		const reloaded = loadTrip(tripDir);
		expect(reloaded.owners).toHaveLength(1);
	});

	test("throws with correct counts when both accounts and expenses reference the owner", () => {
		const tripDir = setupTrip({
			accounts: [
				{ id: "a1", name: "Visa", type: AccountType.Credit, owners: ["alice"] },
			],
			expenses: [
				{
					id: "e1",
					accountId: "a1",
					date: "2026-01-01",
					payee: "Cafe",
					category: "Food",
					amount: 100,
					currency: "THB",
					owners: ["alice"],
					description: "",
					tags: [],
				},
			],
		});
		const trip = loadTrip(tripDir);
		expect(() => removeOwner(trip, "alice")).toThrow(
			'Owner "alice" is referenced by 1 account(s) and 1 expense(s)',
		);
		const reloaded = loadTrip(tripDir);
		expect(reloaded.owners).toHaveLength(1);
	});
});

describe("findOwnerReferences", () => {
	test("returns empty arrays when owner is unreferenced", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		expect(findOwnerReferences(trip, "alice")).toEqual({
			accounts: [],
			expenses: [],
		});
	});

	test("finds owner referenced by an account", () => {
		const tripDir = setupTrip({
			accounts: [
				{ id: "a1", name: "Visa", type: AccountType.Credit, owners: ["alice"] },
			],
		});
		const trip = loadTrip(tripDir);
		const refs = findOwnerReferences(trip, "alice");
		expect(refs.accounts).toHaveLength(1);
		expect(refs.accounts[0]?.id).toBe("a1");
		expect(refs.expenses).toEqual([]);
	});

	test("finds owner referenced by an expense with string owners", () => {
		const tripDir = setupTrip({
			expenses: [
				{
					id: "e1",
					accountId: "x",
					date: "2026-01-01",
					payee: "Cafe",
					category: "Food",
					amount: 100,
					currency: "THB",
					owners: ["alice"],
					description: "",
					tags: [],
				},
			],
		});
		const trip = loadTrip(tripDir);
		const refs = findOwnerReferences(trip, "alice");
		expect(refs.accounts).toEqual([]);
		expect(refs.expenses).toHaveLength(1);
		expect(refs.expenses[0]?.id).toBe("e1");
	});

	test("finds owner referenced by an expense with split owners", () => {
		const tripDir = setupTrip({
			expenses: [
				{
					id: "e2",
					accountId: "x",
					date: "2026-01-01",
					payee: "Cafe",
					category: "Food",
					amount: 100,
					currency: "THB",
					owners: [{ id: "alice", split: "50%" }],
					description: "",
					tags: [],
				},
			],
		});
		const trip = loadTrip(tripDir);
		const refs = findOwnerReferences(trip, "alice");
		expect(refs.expenses).toHaveLength(1);
		expect(refs.expenses[0]?.id).toBe("e2");
	});

	test("returns both accounts and expenses when both reference the owner", () => {
		const tripDir = setupTrip({
			accounts: [
				{ id: "a1", name: "Visa", type: AccountType.Credit, owners: ["alice"] },
			],
			expenses: [
				{
					id: "e1",
					accountId: "a1",
					date: "2026-01-01",
					payee: "Cafe",
					category: "Food",
					amount: 100,
					currency: "THB",
					owners: ["alice"],
					description: "",
					tags: [],
				},
			],
		});
		const trip = loadTrip(tripDir);
		const refs = findOwnerReferences(trip, "alice");
		expect(refs.accounts).toHaveLength(1);
		expect(refs.expenses).toHaveLength(1);
	});

	test("returns empty when owner does not exist", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		expect(findOwnerReferences(trip, "nobody")).toEqual({
			accounts: [],
			expenses: [],
		});
	});
});
