import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
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

	test("excludes expenses with missing rate and emits warning", () => {
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
						amount: 1000,
						currency: "JPY",
						description: "",
						tags: [],
					},
				],
			}),
			"2026-04-20",
		);
		expect(s.totalSpendThb).toBe(500);
		expect(s.expenseCount).toBe(2);
		expect(s.warnings).toContain(
			"1 expense missing THB rate (excluded from totals)",
		);
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
				tags: ["biz", "fun", "family"],
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
