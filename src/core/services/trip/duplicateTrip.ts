import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export interface DuplicateTripOverrides {
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
}

export function duplicateTrip(
	dataDir: string,
	sourcePath: string,
	newDirName: string,
	overrides: DuplicateTripOverrides,
): Trip {
	const destPath = join(dataDir, newDirName);
	cpSync(sourcePath, destPath, { recursive: true });

	const settingsPath = join(destPath, "settings.yaml");
	const settings = parse(readFileSync(settingsPath, "utf-8"));
	settings.name = overrides.name;
	settings.startDate = overrides.startDate;
	settings.endDate = overrides.endDate;
	settings.countries = overrides.countries;
	writeFileSync(settingsPath, stringify(settings));

	return loadTrip(destPath);
}
