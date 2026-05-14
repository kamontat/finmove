import type { Trip } from "../../models";

export function sortTrips(trips: Trip[], today: string): Trip[] {
	const compareName = (a: Trip, b: Trip): number =>
		a.settings.name.localeCompare(b.settings.name, undefined, {
			sensitivity: "base",
		});

	const active: Trip[] = [];
	const ended: Trip[] = [];
	for (const trip of trips) {
		if (today <= trip.settings.endDate) {
			active.push(trip);
		} else {
			ended.push(trip);
		}
	}

	active.sort((a, b) => {
		const cmp = a.settings.endDate.localeCompare(b.settings.endDate);
		return cmp !== 0 ? cmp : compareName(a, b);
	});

	ended.sort((a, b) => {
		const cmp = b.settings.endDate.localeCompare(a.settings.endDate);
		return cmp !== 0 ? cmp : compareName(a, b);
	});

	return [...active, ...ended];
}
