import { loadConfig } from "../../configs";
import { tripConfig } from "../../configs/trip";
import type { Trip } from "../../models";

export function loadTrip(tripPath: string): Trip {
	const { data } = loadConfig(tripConfig, tripPath);
	return { dirPath: tripPath, ...data };
}
