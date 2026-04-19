import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings, Trip } from "../../models";

export function createTrip(
	dataDir: string,
	dirName: string,
	settings: Settings,
): Trip {
	const tripPath = join(dataDir, dirName);
	mkdirSync(tripPath, { recursive: true });

	writeFileSync(join(tripPath, "settings.yaml"), stringify(settings));
	writeFileSync(join(tripPath, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripPath, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripPath, "expenses.yaml"), stringify({ expenses: [] }));

	return {
		dirPath: tripPath,
		settings,
		owners: [],
		accounts: [],
		expenses: [],
	};
}
