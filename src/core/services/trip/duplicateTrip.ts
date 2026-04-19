import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";
import { loadTrip } from "./loadTrip";

export function duplicateTrip(
	dataDir: string,
	sourcePath: string,
	newDirName: string,
	newName: string,
): Trip {
	const destPath = join(dataDir, newDirName);
	cpSync(sourcePath, destPath, { recursive: true });

	const settingsPath = join(destPath, "settings.yaml");
	const settings = parse(readFileSync(settingsPath, "utf-8"));
	settings.name = newName;
	writeFileSync(settingsPath, stringify(settings));

	return loadTrip(destPath);
}
