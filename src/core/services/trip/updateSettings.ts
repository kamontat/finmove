import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Settings } from "../../models";

export function updateSettings(
	tripPath: string,
	updates: Partial<Settings>,
): void {
	const filePath = join(tripPath, "settings.yaml");
	const current: Settings = parse(readFileSync(filePath, "utf-8"));
	const { baseCurrency: _, ...safeUpdates } = updates;
	const merged: Settings = { ...current, ...safeUpdates };
	writeFileSync(filePath, stringify(merged));
}
