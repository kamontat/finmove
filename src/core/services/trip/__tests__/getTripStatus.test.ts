import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
import { AccountType } from "../../../models";
import { getTripStatus } from "../getTripStatus";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
	return {
		dirPath: "/tmp/trip",
		settings: {
			name: "Test Trip",
			startDate: "2026-04-15",
			endDate: "2026-04-30",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "./expenses.csv",
		},
		owners: [],
		accounts: [],
		expenses: [],
		...overrides,
	};
}

describe("getTripStatus — timeline", () => {
	test("upcoming when today is before start", () => {
		const s = getTripStatus(makeTrip(), "2026-04-10");
		expect(s.phase).toBe("upcoming");
		expect(s.totalDays).toBe(16);
		expect(s.elapsedDays).toBe(0);
		expect(s.remainingDays).toBe(16);
	});

	test("ongoing when today equals start", () => {
		const s = getTripStatus(makeTrip(), "2026-04-15");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(1);
		expect(s.remainingDays).toBe(15);
	});

	test("ongoing when today is between start and end", () => {
		const s = getTripStatus(makeTrip(), "2026-04-23");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(9);
		expect(s.remainingDays).toBe(7);
	});

	test("ongoing when today equals end", () => {
		const s = getTripStatus(makeTrip(), "2026-04-30");
		expect(s.phase).toBe("ongoing");
		expect(s.elapsedDays).toBe(16);
		expect(s.remainingDays).toBe(0);
	});

	test("ended when today is after end", () => {
		const s = getTripStatus(makeTrip(), "2026-05-01");
		expect(s.phase).toBe("ended");
		expect(s.elapsedDays).toBe(16);
		expect(s.remainingDays).toBe(0);
	});

	test("single-day trip", () => {
		const s = getTripStatus(
			makeTrip({
				settings: {
					...makeTrip().settings,
					startDate: "2026-04-15",
					endDate: "2026-04-15",
				},
			}),
			"2026-04-15",
		);
		expect(s.phase).toBe("ongoing");
		expect(s.totalDays).toBe(1);
		expect(s.elapsedDays).toBe(1);
		expect(s.remainingDays).toBe(0);
	});

	test("propagates startDate, endDate, and countries", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				countries: ["Japan", "Korea"],
			},
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.startDate).toBe("2026-04-15");
		expect(s.endDate).toBe("2026-04-30");
		expect(s.countries).toEqual(["Japan", "Korea"]);
	});
});

describe("getTripStatus — spend", () => {
	test("sums THB expenses for total", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a",
						date: "2026-04-17",
						payee: "Y",
						category: "Food",
						amount: 750,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.totalSpendThb).toBe(1250);
		expect(s.expenseCount).toBe(2);
	});

	test("converts non-THB using expense exchangeRate", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 1000,
						currency: "JPY",
						exchangeRate: 0.23,
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.totalSpendThb).toBe(230);
	});

	test("falls back to trip-level exchange rate", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				currencies: { JPY: { exchangeRate: 0.25 } },
			},
			expenses: [
				{
					id: "e1",
					accountId: "a",
					date: "2026-04-16",
					payee: "X",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.totalSpendThb).toBe(250);
	});

	test("pluralizes missing-rate warning", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "JPY",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a",
						date: "2026-04-17",
						payee: "Y",
						category: "Food",
						amount: 200,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.warnings).toContain(
			"2 expenses missing THB rate (excluded from totals)",
		);
	});

	test("computes avgPerDayThb on elapsed days, not total", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 900,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-23", // 9 elapsed days
		);
		expect(s.avgPerDayThb).toBe(100);
	});

	test("avgPerDayThb is 0 when upcoming", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-10",
		);
		expect(s.avgPerDayThb).toBe(0);
	});

	test("byCurrency aggregates original amounts, sorted desc", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				currencies: {
					JPY: { exchangeRate: 0.25 },
					KRW: { exchangeRate: 0.027 },
				},
			},
			expenses: [
				{
					id: "e1",
					accountId: "a",
					date: "2026-04-16",
					payee: "X",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
				{
					id: "e2",
					accountId: "a",
					date: "2026-04-16",
					payee: "Y",
					category: "Food",
					amount: 500,
					currency: "JPY",
					description: "",
					tags: [],
				},
				{
					id: "e3",
					accountId: "a",
					date: "2026-04-16",
					payee: "Z",
					category: "Food",
					amount: 10000,
					currency: "KRW",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.byCurrency).toEqual([
			{ currency: "KRW", amount: 10000 },
			{ currency: "JPY", amount: 1500 },
		]);
	});

	test("byCurrency still includes expenses with missing rate", () => {
		const s = getTripStatus(
			makeTrip({
				expenses: [
					{
						id: "e1",
						accountId: "a",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 1000,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byCurrency).toEqual([{ currency: "JPY", amount: 1000 }]);
	});

	test("currency entry present without rate falls through to missing-rate warning", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				currencies: { JPY: {} },
			},
			expenses: [
				{
					id: "e1",
					accountId: "a",
					date: "2026-04-16",
					payee: "X",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.totalSpendThb).toBe(0);
		expect(s.warnings).toContain(
			"1 expense missing THB rate (excluded from totals)",
		);
	});
});

describe("getTripStatus — categories and tags", () => {
	test("top categories sorted desc by THB amount", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: ["Food", "Transport", "Lodging"],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Transport",
					amount: 800,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "3",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Lodging",
					amount: 200,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.topCategories).toEqual([
			{ category: "Transport", amountThb: 800 },
			{ category: "Food", amountThb: 500 },
			{ category: "Lodging", amountThb: 200 },
		]);
	});

	test("collapses overflow into Other row", () => {
		const expenses = ["A", "B", "C", "D", "E", "F", "G"].map((cat, i) => ({
			id: `${i}`,
			accountId: "a",
			date: "2026-04-16",
			payee: "",
			category: cat,
			amount: 100 - i, // A=100, B=99, ... G=94
			currency: "THB" as const,
			description: "",
			tags: [] as string[],
		}));
		const s = getTripStatus(makeTrip({ expenses }), "2026-04-20");
		expect(s.topCategories).toHaveLength(6); // top 5 + Other
		expect(s.topCategories.at(-1)).toEqual({
			category: "Other",
			amountThb: 94 + 95, // F + G
		});
	});

	test("no Other row when five or fewer categories", () => {
		const expenses = ["A", "B", "C"].map((cat, i) => ({
			id: `${i}`,
			accountId: "a",
			date: "2026-04-16",
			payee: "",
			category: cat,
			amount: 100,
			currency: "THB" as const,
			description: "",
			tags: [] as string[],
		}));
		const s = getTripStatus(makeTrip({ expenses }), "2026-04-20");
		expect(s.topCategories.map((c) => c.category)).not.toContain("Other");
	});

	test("topCategories skips expenses with missing rate", () => {
		const trip = makeTrip({
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Mystery",
					amount: 9999,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.topCategories).toEqual([{ category: "Food", amountThb: 500 }]);
	});

	test("categoryCount tracks used vs total", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				categories: ["Food", "Transport", "Lodging"],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 200,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.categoryCount).toEqual({ used: 1, total: 3 });
	});

	test("tagCount tracks distinct tags on expenses", () => {
		const trip = makeTrip({
			settings: {
				...makeTrip().settings,
				tags: [
					{ value: "biz", default: false },
					{ value: "fun", default: false },
					{ value: "family", default: false },
				],
			},
			expenses: [
				{
					id: "1",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: ["biz", "fun"],
				},
				{
					id: "2",
					accountId: "a",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 200,
					currency: "THB",
					description: "",
					tags: ["fun"],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.tagCount).toEqual({ used: 2, total: 3 });
	});
});

describe("getTripStatus — owner balances", () => {
	test("single owner account + equal split", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "Alice's card",
					type: AccountType.Credit,
					owners: ["alice"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					// no owners → equal split among all
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		const bob = s.ownerBalances.find((o) => o.ownerId === "bob");
		expect(alice?.shareThb).toBe(500);
		expect(alice?.balanceThb).toBe(500); // paid 1000, share 500
		expect(bob?.shareThb).toBe(500);
		expect(bob?.balanceThb).toBe(-500); // paid 0, share 500
	});

	test("multi-owner account splits paid equally", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "Shared",
					type: AccountType.Credit,
					owners: ["alice", "bob"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["alice"], // full share to alice
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		const bob = s.ownerBalances.find((o) => o.ownerId === "bob");
		expect(alice?.balanceThb).toBe(-500); // paid 500, share 1000
		expect(bob?.balanceThb).toBe(500); // paid 500, share 0
	});

	test("balances preserved in owners list order", () => {
		const trip = makeTrip({
			owners: [
				{ id: "carol", name: "Carol" },
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "acc1",
					name: "X",
					type: AccountType.Credit,
					owners: ["carol"],
				},
			],
			expenses: [],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.ownerBalances.map((o) => o.ownerId)).toEqual([
			"carol",
			"alice",
			"bob",
		]);
	});

	test("zero-owner account emits warning and excludes expense from paid", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [
				{
					id: "bad",
					name: "Orphan",
					type: AccountType.Credit,
					owners: [],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "bad",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"Account 'Orphan' has no owners — expenses not attributed",
		);
		// paid = 0 for both; share = 500 each
		const alice = s.ownerBalances.find((o) => o.ownerId === "alice");
		expect(alice?.balanceThb).toBe(-500);
	});

	test("expenses with missing rate are excluded from balance", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "acc1",
					name: "X",
					type: AccountType.Credit,
					owners: ["alice"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "JPY",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.ownerBalances[0]?.balanceThb).toBe(0);
	});

	test("empty owners list produces no balances", () => {
		const s = getTripStatus(makeTrip(), "2026-04-20");
		expect(s.ownerBalances).toEqual([]);
	});

	test("missing account reference is ignored for paid", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [],
			expenses: [
				{
					id: "e1",
					accountId: "ghost",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		// share still computed; paid is 0
		expect(s.ownerBalances[0]?.balanceThb).toBe(-1000);
	});

	test("no accounts + owners emits no-accounts warning", () => {
		const trip = makeTrip({
			owners: [
				{ id: "alice", name: "Alice" },
				{ id: "bob", name: "Bob" },
			],
			accounts: [],
			expenses: [
				{
					id: "e1",
					accountId: "x",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"No accounts configured — per-owner balances unavailable",
		);
	});

	test("no accounts + no owners skips the no-accounts warning", () => {
		const s = getTripStatus(
			makeTrip({ accounts: [], owners: [] }),
			"2026-04-20",
		);
		expect(s.warnings.some((w) => w.startsWith("No accounts configured"))).toBe(
			false,
		);
	});

	test("trip with expenses but no owners does not divide by zero", () => {
		const trip = makeTrip({
			owners: [],
			accounts: [],
			expenses: [
				{
					id: "e1",
					accountId: "x",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.ownerBalances).toEqual([]);
		expect(Number.isFinite(s.totalSpendThb)).toBe(true);
		expect(s.totalSpendThb).toBe(1000);
	});

	test("unknown owner id in expense.owners emits warning and is dropped from share", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "acc1",
					name: "Alice's card",
					type: AccountType.Credit,
					owners: ["alice"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["alice", "ghost"],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"Unknown owner id: ghost — excluded from balance calculations",
		);
		// Alice's share = equal split across 2 listed owners = 500
		// Alice's paid = 1000 (single-owner account)
		// Balance = 1000 - 500 = 500
		expect(s.ownerBalances[0]?.balanceThb).toBe(500);
	});

	test("unknown owner id in account.owners emits warning", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "acc1",
					name: "Shared",
					type: AccountType.Credit,
					owners: ["alice", "ghost"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["alice"],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"Unknown owner id: ghost — excluded from balance calculations",
		);
	});

	test("collapses multiple unknown owner ids into one sorted warning", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "acc1",
					name: "X",
					type: AccountType.Credit,
					owners: ["alice", "zombie"],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "acc1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 1000,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["alice", "ghost", "phantom"],
				},
				{
					id: "e2",
					accountId: "acc1",
					date: "2026-04-17",
					payee: "",
					category: "Food",
					amount: 500,
					currency: "THB",
					description: "",
					tags: [],
					owners: ["ghost"], // duplicate reference
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		expect(s.warnings).toContain(
			"Unknown owner ids: ghost, phantom, zombie — excluded from balance calculations",
		);
	});

	test("two orphan accounts sharing a name emit two warnings", () => {
		const trip = makeTrip({
			owners: [{ id: "alice", name: "Alice" }],
			accounts: [
				{
					id: "a1",
					name: "Cash",
					type: AccountType.Credit,
					owners: [],
				},
				{
					id: "a2",
					name: "Cash",
					type: AccountType.Debit,
					owners: [],
				},
			],
			expenses: [
				{
					id: "e1",
					accountId: "a1",
					date: "2026-04-16",
					payee: "",
					category: "Food",
					amount: 100,
					currency: "THB",
					description: "",
					tags: [],
				},
				{
					id: "e2",
					accountId: "a2",
					date: "2026-04-17",
					payee: "",
					category: "Food",
					amount: 200,
					currency: "THB",
					description: "",
					tags: [],
				},
			],
		});
		const s = getTripStatus(trip, "2026-04-20");
		const orphanWarnings = s.warnings.filter((w) =>
			w.startsWith("Account 'Cash'"),
		);
		expect(orphanWarnings).toHaveLength(2);
	});
});

describe("getTripStatus — byAccount", () => {
	test("sums totalThb and expenseCount per account, sorted desc by totalThb", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{
						id: "acc-hsbc",
						name: "HSBC Credit",
						type: AccountType.Credit,
						owners: [],
					},
					{
						id: "acc-bkk",
						name: "Bangkok Bank",
						type: AccountType.Debit,
						owners: [],
					},
				],
				expenses: [
					{
						id: "e1",
						accountId: "acc-bkk",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 200,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "acc-hsbc",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 500,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e3",
						accountId: "acc-hsbc",
						date: "2026-04-17",
						payee: "Z",
						category: "Food",
						amount: 300,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "acc-hsbc",
				name: "HSBC Credit",
				type: AccountType.Credit,
				totalThb: 800,
				expenseCount: 2,
			},
			{
				accountId: "acc-bkk",
				name: "Bangkok Bank",
				type: AccountType.Debit,
				totalThb: 200,
				expenseCount: 1,
			},
		]);
	});

	test("breaks ties by name ascending", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Zeta", type: AccountType.Debit, owners: [] },
					{ id: "a2", name: "Alpha", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a2",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount.map((a) => a.name)).toEqual(["Alpha", "Zeta"]);
	});

	test("includes configured accounts with zero spend, sorted after spent ones", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Used", type: AccountType.Debit, owners: [] },
					{ id: "a2", name: "Unused", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Used",
				type: AccountType.Debit,
				totalThb: 100,
				expenseCount: 1,
			},
			{
				accountId: "a2",
				name: "Unused",
				type: AccountType.Debit,
				totalThb: 0,
				expenseCount: 0,
			},
		]);
	});

	test("excludes expenses referencing an unknown accountId", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Known", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "ghost",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 999,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Known",
				type: AccountType.Debit,
				totalThb: 100,
				expenseCount: 1,
			},
		]);
	});

	test("excludes expenses missing a usable THB rate", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Acc", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a1",
						date: "2026-04-16",
						payee: "Y",
						category: "Food",
						amount: 1000,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Acc",
				type: AccountType.Debit,
				totalThb: 100,
				expenseCount: 1,
			},
		]);
	});

	test("byAccount lists configured accounts with zero totals when no qualifying expenses", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Acc", type: AccountType.Debit, owners: [] },
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Acc",
				type: AccountType.Debit,
				totalThb: 0,
				expenseCount: 0,
			},
		]);
	});

	test("byAccount is empty when no accounts are configured", () => {
		const s = getTripStatus(makeTrip(), "2026-04-20");
		expect(s.byAccount).toEqual([]);
	});

	test("expenseCount matches reality — three expenses on the same account", () => {
		const s = getTripStatus(
			makeTrip({
				accounts: [
					{ id: "a1", name: "Acc", type: AccountType.Debit, owners: [] },
				],
				expenses: [
					{
						id: "e1",
						accountId: "a1",
						date: "2026-04-16",
						payee: "X",
						category: "Food",
						amount: 100,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e2",
						accountId: "a1",
						date: "2026-04-17",
						payee: "Y",
						category: "Food",
						amount: 200,
						currency: "THB",
						description: "",
						tags: [],
					},
					{
						id: "e3",
						accountId: "a1",
						date: "2026-04-18",
						payee: "Z",
						category: "Food",
						amount: 300,
						currency: "THB",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.byAccount).toEqual([
			{
				accountId: "a1",
				name: "Acc",
				type: AccountType.Debit,
				totalThb: 600,
				expenseCount: 3,
			},
		]);
	});
});
