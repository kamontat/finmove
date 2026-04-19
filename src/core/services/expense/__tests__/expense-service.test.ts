import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Expense, Settings } from "../../../models";
import { loadTrip } from "../../trip/load-trip";
import { addExpense } from "../add-expense";
import { getExpenses } from "../get-expenses";
import { removeExpense } from "../remove-expense";
import { updateExpense } from "../update-expense";

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
			addExpense(trip, { ...sampleExpense, accountId: "bad" }),
		).toThrow('Account "bad" not found');
	});

	test("throws when adding duplicate expense ID", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		addExpense(trip, sampleExpense);
		expect(() => addExpense(trip, sampleExpense)).toThrow(
			'Expense with id "e1" already exists',
		);
	});
});

describe("updateExpense", () => {
	test("updates an expense and persists to YAML", () => {
		const tripDir = setupTrip();
		let trip = loadTrip(tripDir);
		addExpense(trip, sampleExpense);

		const updated = { ...sampleExpense, payee: "Updated Ramen" };
		updateExpense(trip, updated);

		trip = loadTrip(tripDir);
		expect(trip.expenses).toHaveLength(1);
		expect(trip.expenses[0].payee).toBe("Updated Ramen");
	});

	test("throws when expense ID does not exist", () => {
		const tripDir = setupTrip();
		const trip = loadTrip(tripDir);
		expect(() => updateExpense(trip, sampleExpense)).toThrow(
			'Expense with id "e1" not found',
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
