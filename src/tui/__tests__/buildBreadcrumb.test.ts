import { describe, expect, test } from "bun:test";
import type { Trip } from "../../core/models";
import { buildBreadcrumb } from "../buildBreadcrumb";
import type { RouteEntry } from "../models";

const TRIP: Trip = {
	dirPath: "/data/japan-2026",
	settings: {
		name: "Japan 2026",
		startDate: "2026-04-01",
		endDate: "2026-04-15",
		countries: [],
		owners: [],
		accounts: [],
		categories: [],
		tags: [],
		currencies: [],
		defaultCurrency: "THB",
		version: 1,
	} as Trip["settings"],
	owners: [],
	accounts: [],
	expenses: [],
};

function route<P extends RouteEntry["path"]>(
	path: P,
	props: Extract<RouteEntry, { path: P }>["props"],
): RouteEntry {
	return { path, props } as RouteEntry;
}

describe("buildBreadcrumb", () => {
	test("/trips → 'Trips'", () => {
		expect(buildBreadcrumb(route("/trips", {}), null)).toBe("Trips");
	});

	test("/trips/new (no duplicate) → 'Trips > New'", () => {
		expect(buildBreadcrumb(route("/trips/new", {}), null)).toBe("Trips > New");
	});

	test("/trips/new (with duplicateFromDirPath) → 'Trips > Duplicate'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/new", { duplicateFromDirPath: "/data/old" }),
				null,
			),
		).toBe("Trips > Duplicate");
	});

	test("/trips/delete → 'Trips > Delete'", () => {
		expect(buildBreadcrumb(route("/trips/delete", {}), null)).toBe(
			"Trips > Delete",
		);
	});

	test("/trips/duplicate → 'Trips > Duplicate'", () => {
		expect(buildBreadcrumb(route("/trips/duplicate", {}), null)).toBe(
			"Trips > Duplicate",
		);
	});

	test("/trips/owners with trip → 'Trips > Japan 2026 > Owners'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/owners", { tripDirPath: "/data/japan-2026" }),
				TRIP,
			),
		).toBe("Trips > Japan 2026 > Owners");
	});

	test("/trips/owners/new → 'Trips > Japan 2026 > Owners > New'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/owners/new", { tripDirPath: "/data/japan-2026" }),
				TRIP,
			),
		).toBe("Trips > Japan 2026 > Owners > New");
	});

	test("/trips/expenses/form with expenseId → '... > Expenses > Edit'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/expenses/form", {
					tripDirPath: "/data/japan-2026",
					expenseId: "exp-1",
				}),
				TRIP,
			),
		).toBe("Trips > Japan 2026 > Expenses > Edit");
	});

	test("/trips/expenses/form with duplicateFromId → '... > Expenses > Duplicate'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/expenses/form", {
					tripDirPath: "/data/japan-2026",
					duplicateFromId: "exp-1",
				}),
				TRIP,
			),
		).toBe("Trips > Japan 2026 > Expenses > Duplicate");
	});

	test("/trips/expenses/form with no ids → '... > Expenses > New'", () => {
		expect(
			buildBreadcrumb(
				route("/trips/expenses/form", {
					tripDirPath: "/data/japan-2026",
				}),
				TRIP,
			),
		).toBe("Trips > Japan 2026 > Expenses > New");
	});

	test("/notifications → 'Notifications'", () => {
		expect(buildBreadcrumb(route("/notifications", {}), null)).toBe(
			"Notifications",
		);
	});

	test("trip-scoped route without trip loaded omits the trip name", () => {
		expect(
			buildBreadcrumb(
				route("/trips/owners", { tripDirPath: "/data/japan-2026" }),
				null,
			),
		).toBe("Trips > Owners");
	});
});
