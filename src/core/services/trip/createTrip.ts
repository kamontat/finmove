import { join } from "node:path";
import { saveConfig } from "../../configs";
import { tripConfig } from "../../configs/trip";
import type { Settings, Trip } from "../../models";

export function createTrip(
	dataDir: string,
	dirName: string,
	settings: Settings,
): Trip {
	const tripPath = join(dataDir, dirName);
	const data = { settings, owners: [], accounts: [], expenses: [] };
	saveConfig(tripConfig, tripPath, data);
	return { dirPath: tripPath, ...data };
}
