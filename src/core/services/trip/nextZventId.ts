import { ZVENT_DEFAULT_ID } from "../../constants";
import { listTrips } from "./listTrips";
import { parseZventId } from "./parseZventId";

const MAX_ZVENT_ID = 999;

export function nextZventId(dataDir: string): string {
	const trips = listTrips(dataDir);
	let max = 0;
	for (const trip of trips) {
		for (const tag of trip.settings.tags) {
			const parsed = parseZventId(tag);
			if (parsed === null) continue;
			const n = Number.parseInt(parsed, 10);
			if (n > max) max = n;
		}
	}
	if (max === 0) return ZVENT_DEFAULT_ID;
	const next = Math.min(max + 1, MAX_ZVENT_ID);
	return String(next).padStart(3, "0");
}
