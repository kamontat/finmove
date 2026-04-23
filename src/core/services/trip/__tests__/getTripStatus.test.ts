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
