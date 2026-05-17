import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Trip } from "../../models";
import { duplicateTrip } from "./duplicateTrip";
import { loadTrip } from "./loadTrip";
import { toDirName } from "./toDirName";

const BACKUP_SUFFIX_PATTERN = /\s*\(Backup v\d+\)$/;

export function backupTrip(dataDir: string, sourcePath: string): Trip {
	const source = loadTrip(sourcePath);
	const { startDate, endDate, countries } = source.settings;
	const baseName = source.settings.name.replace(BACKUP_SUFFIX_PATTERN, "");

	let n = 1;
	let newName = `${baseName} (Backup v${n})`;
	let newDirName = toDirName(newName, startDate);
	while (existsSync(join(dataDir, newDirName))) {
		n += 1;
		newName = `${baseName} (Backup v${n})`;
		newDirName = toDirName(newName, startDate);
	}

	return duplicateTrip(dataDir, sourcePath, newDirName, {
		name: newName,
		startDate,
		endDate,
		countries,
	});
}
