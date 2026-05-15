import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ConfigError } from "../../configs";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export type TripEntry =
	| { kind: "ok"; trip: Trip }
	| {
			kind: "broken";
			dirPath: string;
			dirName: string;
			error: ConfigError;
	  };

export function listTrips(dataDir: string): TripEntry[] {
	if (!existsSync(dataDir)) return [];

	const entries = readdirSync(dataDir, { withFileTypes: true });
	const out: TripEntry[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const tripDir = join(dataDir, entry.name);
		try {
			out.push({ kind: "ok", trip: loadTrip(tripDir) });
		} catch (error) {
			if (error instanceof ConfigError) {
				out.push({
					kind: "broken",
					dirPath: tripDir,
					dirName: entry.name,
					error,
				});
			} else {
				throw error;
			}
		}
	}

	return out;
}
