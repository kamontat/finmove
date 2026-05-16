import { describe, expect, test } from "bun:test";
import type { Account, Expense, Owner, Trip } from "../../../models";
import { AccountType } from "../../../models";
import { type SortLevel, sortExpenses } from "../sortExpenses";

const owners: Owner[] = [
	{ id: "alice", name: "Alice" },
	{ id: "bob", name: "Bob" },
	{ id: "carol", name: "Carol" },
];

const accounts: Account[] = [
	{ id: "acc-k", name: "Kasikorn", type: AccountType.Debit, owners: ["alice"] },
	{
		id: "acc-b",
		name: "Bangkok Bank",
		type: AccountType.Debit,
		owners: ["alice"],
	},
];

function makeTrip(expenses: Expense[]): Trip {
	return {
		dirPath: "/test",
		settings: {
			version: 1,
			name: "Test",
			startDate: "2026-01-01",
			endDate: "2026-01-31",
			countries: ["TH"],
			baseCurrency: "THB",
			currencies: { USD: { exchangeRate: 35 }, EUR: { exchangeRate: 38 } },
			categories: ["Food", "Transport"],
			tags: [],
			exportPath: "/tmp/test.csv",
		},
		owners,
		accounts,
		expenses,
	};
}

function makeExpense(overrides: Partial<Expense>): Expense {
	return {
		id: overrides.id ?? "e1",
		accountId: overrides.accountId ?? "acc-k",
		date: overrides.date ?? "2026-01-15",
		payee: overrides.payee ?? "Generic",
		category: overrides.category ?? "Food",
		amount: overrides.amount ?? 100,
		currency: overrides.currency ?? "THB",
		description: overrides.description ?? "",
		tags: overrides.tags ?? [],
		...(overrides.exchangeRate !== undefined
			? { exchangeRate: overrides.exchangeRate }
			: {}),
		...(overrides.owners !== undefined ? { owners: overrides.owners } : {}),
	};
}

describe("sortExpenses", () => {
	test("empty levels → preserves insertion order (new array)", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-20" }),
			makeExpense({ id: "b", date: "2026-01-10" }),
		];
		const trip = makeTrip(expenses);
		const result = sortExpenses(expenses, trip, []);
		expect(result.map((e) => e.id)).toEqual(["a", "b"]);
		expect(result).not.toBe(expenses);
	});

	test("empty expenses → empty array", () => {
		const trip = makeTrip([]);
		expect(sortExpenses([], trip, [{ key: "date", dir: "asc" }])).toEqual([]);
	});

	test("date asc and desc", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-20" }),
			makeExpense({ id: "b", date: "2026-01-10" }),
			makeExpense({ id: "c", date: "2026-01-15" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "c", "b"]);
	});

	test("stable: equal-key rows preserve insertion order", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-15" }),
			makeExpense({ id: "b", date: "2026-01-15" }),
			makeExpense({ id: "c", date: "2026-01-15" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "date", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "b", "c"]);
	});

	test("multi-level: date desc, then account asc within same date", () => {
		const expenses = [
			makeExpense({ id: "a", date: "2026-01-10", accountId: "acc-k" }),
			makeExpense({ id: "b", date: "2026-01-20", accountId: "acc-b" }),
			makeExpense({ id: "c", date: "2026-01-10", accountId: "acc-b" }),
		];
		const trip = makeTrip(expenses);
		const levels: SortLevel[] = [
			{ key: "date", dir: "desc" },
			{ key: "account", dir: "asc" },
		];
		expect(sortExpenses(expenses, trip, levels).map((e) => e.id)).toEqual([
			"b",
			"c",
			"a",
		]);
	});

	test("thb sort uses converted value; missing rate sinks last (asc and desc)", () => {
		const expenses = [
			makeExpense({ id: "a", amount: 200, currency: "THB" }),
			makeExpense({ id: "b", amount: 10, currency: "USD" }),
			makeExpense({ id: "c", amount: 5, currency: "XXX" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "thb", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["a", "b", "c"]);
		expect(
			sortExpenses(expenses, trip, [{ key: "thb", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "a", "c"]);
	});

	test("account sort by account name, case-insensitive; falls back to id", () => {
		const expenses = [
			makeExpense({ id: "a", accountId: "acc-k" }),
			makeExpense({ id: "b", accountId: "acc-b" }),
			makeExpense({ id: "c", accountId: "ghost" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "account", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
	});

	test("category sort, case-insensitive", () => {
		const expenses = [
			makeExpense({ id: "a", category: "transport" }),
			makeExpense({ id: "b", category: "Food" }),
			makeExpense({ id: "c", category: "food" }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "category", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "c", "a"]);
	});

	test("owner sort: count first, then first-owner initials", () => {
		const expenses = [
			makeExpense({ id: "a", owners: ["alice", "bob"] }),
			makeExpense({ id: "b", owners: ["carol"] }),
			makeExpense({ id: "c", owners: [] }),
			makeExpense({ id: "d", owners: ["bob", "carol"] }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["c", "b", "a", "d"]);
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "desc" }]).map(
				(e) => e.id,
			),
		).toEqual(["d", "a", "b", "c"]);
	});

	test("owner sort accepts ExpenseOwnerSplit entries", () => {
		const expenses = [
			makeExpense({ id: "a", owners: [{ id: "bob" }, { id: "alice" }] }),
			makeExpense({ id: "b", owners: [{ id: "alice" }, { id: "bob" }] }),
		];
		const trip = makeTrip(expenses);
		expect(
			sortExpenses(expenses, trip, [{ key: "owner", dir: "asc" }]).map(
				(e) => e.id,
			),
		).toEqual(["b", "a"]);
	});
});
