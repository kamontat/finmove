import { describe, expect, test } from "bun:test";
import type { Settings } from "../../../models";
import type { TripEntry } from "../listTrips";
import { sortTrips } from "../sortTrips";

function makeTrip(name: string, endDate: string): TripEntry {
	const settings: Settings = {
		version: 1,
		name,
		startDate: "2026-01-01",
		endDate,
		countries: [],
		baseCurrency: "THB",
		currencies: {},
		categories: [],
		tags: [],
		exportPath: "./out.csv",
	};
	return {
		kind: "ok",
		trip: {
			dirPath: `/data/${name}`,
			settings,
			owners: [],
			accounts: [],
			expenses: [],
		},
	};
}

function names(entries: TripEntry[]): string[] {
	return entries.map((e) =>
		e.kind === "ok" ? e.trip.settings.name : e.dirName,
	);
}

describe("sortTrips", () => {
	test("returns empty array when given empty input", () => {
		expect(sortTrips([], "2026-05-14")).toEqual([]);
	});

	test("sorts active trips by endDate ascending (soonest end first)", () => {
		const today = "2026-05-14";
		const a = makeTrip("Alpha", "2026-12-01");
		const b = makeTrip("Bravo", "2026-06-01");
		const c = makeTrip("Charlie", "2026-08-15");

		const sorted = sortTrips([a, b, c], today);

		expect(names(sorted)).toEqual(["Bravo", "Charlie", "Alpha"]);
	});

	test("sorts ended trips by endDate descending (most recently ended first)", () => {
		const today = "2026-05-14";
		const a = makeTrip("Alpha", "2025-01-15");
		const b = makeTrip("Bravo", "2026-03-20");
		const c = makeTrip("Charlie", "2025-12-31");

		const sorted = sortTrips([a, b, c], today);

		expect(names(sorted)).toEqual(["Bravo", "Charlie", "Alpha"]);
	});

	test("places active trips before ended trips", () => {
		const today = "2026-05-14";
		const endedRecent = makeTrip("EndedRecent", "2026-05-10");
		const endedOld = makeTrip("EndedOld", "2025-01-01");
		const activeSoon = makeTrip("ActiveSoon", "2026-05-20");
		const activeLater = makeTrip("ActiveLater", "2027-01-01");

		const sorted = sortTrips(
			[endedOld, activeLater, endedRecent, activeSoon],
			today,
		);

		expect(names(sorted)).toEqual([
			"ActiveSoon",
			"ActiveLater",
			"EndedRecent",
			"EndedOld",
		]);
	});

	test("breaks endDate ties with alphabetical trip name (case-insensitive)", () => {
		const today = "2026-05-14";
		const charlie = makeTrip("charlie", "2026-06-01");
		const alpha = makeTrip("Alpha", "2026-06-01");
		const bravo = makeTrip("bravo", "2026-06-01");

		const sorted = sortTrips([charlie, alpha, bravo], today);

		expect(names(sorted)).toEqual(["Alpha", "bravo", "charlie"]);
	});

	test("treats today equal to endDate as active (still ongoing)", () => {
		const today = "2026-05-14";
		const endsToday = makeTrip("EndsToday", "2026-05-14");
		const endedYesterday = makeTrip("EndedYesterday", "2026-05-13");

		const sorted = sortTrips([endedYesterday, endsToday], today);

		expect(names(sorted)).toEqual(["EndsToday", "EndedYesterday"]);
	});

	test("breaks ties alphabetically within ended group as well", () => {
		const today = "2026-05-14";
		const zeta = makeTrip("Zeta", "2025-12-01");
		const apple = makeTrip("Apple", "2025-12-01");

		const sorted = sortTrips([zeta, apple], today);

		expect(names(sorted)).toEqual(["Apple", "Zeta"]);
	});
});
