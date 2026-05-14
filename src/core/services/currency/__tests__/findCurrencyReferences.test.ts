import { describe, expect, test } from "bun:test";
import type { Trip } from "../../../models";
import { findCurrencyReferences } from "../findCurrencyReferences";

function makeTrip(expenses: Trip["expenses"]): Trip {
	return {
		dirPath: "/tmp/trip",
		settings: {
			name: "T",
			startDate: "2026-05-01",
			endDate: "2026-05-07",
			countries: ["Japan"],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "./expenses.csv",
		},
		owners: [],
		accounts: [],
		expenses,
	};
}

function expense(id: string, currency: string): Trip["expenses"][number] {
	return {
		id,
		accountId: "a",
		date: "2026-05-02",
		payee: "X",
		category: "Food",
		amount: 100,
		currency,
		description: "",
		tags: [],
	};
}

describe("findCurrencyReferences", () => {
	test("returns empty when no expenses use the code", () => {
		const trip = makeTrip([expense("e1", "THB"), expense("e2", "USD")]);
		expect(findCurrencyReferences(trip, "JPY")).toEqual({ expenses: [] });
	});

	test("returns expenses that use the code", () => {
		const e1 = expense("e1", "JPY");
		const e2 = expense("e2", "THB");
		const e3 = expense("e3", "JPY");
		const trip = makeTrip([e1, e2, e3]);
		expect(findCurrencyReferences(trip, "JPY")).toEqual({
			expenses: [e1, e3],
		});
	});
});
