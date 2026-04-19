import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Trip } from "../../models";
import { loadTrip } from "./load-trip";

export function listTrips(dataDir: string): Trip[] {
	if (!existsSync(dataDir)) {
		return [];
	}

	const entries = readdirSync(dataDir, { withFileTypes: true });
	const trips: Trip[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const tripDir = join(dataDir, entry.name);
		const settingsPath = join(tripDir, "settings.yaml");
		if (!existsSync(settingsPath)) continue;
		trips.push(loadTrip(tripDir));
	}

	return trips;
}
