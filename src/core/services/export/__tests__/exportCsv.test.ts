import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
import { exportCSV } from "../exportCsv";

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
			{
				id: "a1",
				name: "Alice's Visa",
				type: "Credit" as const,
				owners: ["alice"],
			},
		],
		expenses: [],
	};
}

describe("exportCSV", () => {
	test("produces header row when no expenses", () => {
		const trip = makeTripFixture();
		const csv = exportCSV(trip);
		expect(csv).toBe(
			'"Account","Owner","Date","Payee","Category","Amount","Description","Tags"\n',
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
			'"Alice\'s Visa","Alice","2026-05-02","7-Eleven","Eating","100.00","Snacks","food"',
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
			'"Alice\'s Visa","Alice","2026-05-02","Ichiran","Eating","331.20","Ramen","food;ramen"',
		);
		expect(lines[2]).toBe(
			'"Alice\'s Visa","Bob","2026-05-02","Ichiran","Eating","220.80","Ramen","food;ramen"',
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
			'"Alice\'s Visa","Alice","2026-05-02","Taxi","Eating","100.00","Taxi ride",""',
		);
		expect(lines[2]).toBe(
			'"Alice\'s Visa","Bob","2026-05-02","Taxi","Eating","100.00","Taxi ride",""',
		);
	});

	test("escapes double quotes in field values", () => {
		const trip = makeTripFixture();
		trip.expenses = [
			{
				id: "e1",
				accountId: "a1",
				date: "2026-05-02",
				payee: 'Bob\'s "Best" Ramen',
				category: "Eating",
				amount: 100,
				currency: "THB",
				description: 'Has "quotes"',
				tags: [],
				owners: ["alice"],
			},
		];
		const csv = exportCSV(trip);
		const lines = csv.trim().split("\n");
		expect(lines[1]).toContain('"Bob\'s ""Best"" Ramen"');
		expect(lines[1]).toContain('"Has ""quotes"""');
	});

	test("throws when expense has no rate and trip rate is absent", () => {
		const trip = makeTripFixture();
		trip.settings.currencies = { JPY: {} };
		trip.expenses = [
			{
				id: "e1",
				accountId: "a1",
				date: "2026-05-02",
				payee: "Shop",
				category: "Eating",
				amount: 1000,
				currency: "JPY",
				description: "",
				tags: [],
				owners: ["alice"],
			},
		];
		expect(() => exportCSV(trip)).toThrow("No exchange rate available for JPY");
	});
});
