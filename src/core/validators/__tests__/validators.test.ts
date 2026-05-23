import { describe, expect, test } from "bun:test";
import type { Account, Expense, Owner, Settings } from "../../models";
import { validateAccounts } from "../validateAccounts";
import { validateExpenses } from "../validateExpenses";
import { validateOwners } from "../validateOwners";
import { validateSettings } from "../validateSettings";

const validSettings: Settings = {
	version: 2,
	name: "Test",
	startDate: "2026-01-01",
	endDate: "2026-01-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: { JPY: { exchangeRate: 0.23 } },
	categories: [{ value: "Eating", excluded: false }],
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
