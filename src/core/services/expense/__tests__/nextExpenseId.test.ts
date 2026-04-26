import { describe, expect, test } from "bun:test";
import type { Expense, Trip } from "../../../models";
import { nextExpenseId } from "../nextExpenseId";

function makeTrip(expenseIds: string[]): Trip {
	const expenses: Expense[] = expenseIds.map((id) => ({
		id,
		accountId: "a1",
		date: "2026-04-26",
		payee: "x",
		category: "x",
		amount: 0,
		currency: "THB",
		description: "",
		tags: [],
	}));
	return {
		dirPath: "/tmp",
		settings: {
			name: "t",
			startDate: "2026-04-26",
			endDate: "2026-04-26",
			countries: [],
			baseCurrency: "THB",
			currencies: {},
			categories: [],
			tags: [],
			exportPath: "",
		},
		owners: [],
		accounts: [],
		expenses,
	};
}

describe("nextExpenseId", () => {
	test("returns id0 when no expenses exist", () => {
		const trip = makeTrip([]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("returns id0 when no expenses for that date", () => {
		const trip = makeTrip(["exp-20260425-id0", "exp-20260427-id5"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("returns highest+1 for the date", () => {
		const trip = makeTrip([
			"exp-20260426-id0",
			"exp-20260426-id1",
			"exp-20260426-id2",
		]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id3");
	});

	test("uses highest+1, not count, when ids have gaps", () => {
		const trip = makeTrip(["exp-20260426-id0", "exp-20260426-id2"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id3");
	});

	test("ignores legacy timestamp ids", () => {
		const trip = makeTrip(["exp-1714080000000", "exp-1714166400000"]);
		expect(nextExpenseId(trip, "2026-04-26")).toBe("exp-20260426-id0");
	});

	test("strips hyphens from input date", () => {
		const trip = makeTrip([]);
		expect(nextExpenseId(trip, "2026-12-31")).toBe("exp-20261231-id0");
	});

	test("counter is independent per date", () => {
		const trip = makeTrip([
			"exp-20260426-id0",
			"exp-20260426-id1",
			"exp-20260427-id0",
		]);
		expect(nextExpenseId(trip, "2026-04-27")).toBe("exp-20260427-id1");
	});
});
