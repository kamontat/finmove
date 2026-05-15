import type { Trip } from "../../models";
import type { TripEntry } from "./listTrips";

export function sortTrips(entries: TripEntry[], today: string): TripEntry[] {
	const compareName = (a: Trip, b: Trip): number =>
		a.settings.name.localeCompare(b.settings.name, undefined, {
			sensitivity: "base",
		});

	const okEntries: Extract<TripEntry, { kind: "ok" }>[] = [];
	const broken: Extract<TripEntry, { kind: "broken" }>[] = [];
	for (const e of entries) {
		if (e.kind === "ok") okEntries.push(e);
		else broken.push(e);
	}

	const active: Trip[] = [];
	const ended: Trip[] = [];
	for (const { trip } of okEntries) {
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

	return [
		...active.map((trip): TripEntry => ({ kind: "ok", trip })),
		...ended.map((trip): TripEntry => ({ kind: "ok", trip })),
		...broken,
	];
}
