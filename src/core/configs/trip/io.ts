import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { ConfigFileMissingError, ConfigParseError } from "../errors";
import type { ConfigRaw } from "../types";

const FILES = {
	settings: "settings.yaml",
	owners: "owners.yaml",
	accounts: "accounts.yaml",
	expenses: "expenses.yaml",
} as const;

export function readTripConfig(location: string): ConfigRaw {
	const out: ConfigRaw = {};
	for (const [key, filename] of Object.entries(FILES)) {
		const path = join(location, filename);
		if (!existsSync(path)) {
			throw new ConfigFileMissingError("trip", location, filename);
		}
		let raw: unknown;
		try {
			raw = parse(readFileSync(path, "utf-8"));
		} catch (cause) {
			throw new ConfigParseError("trip", location, filename, cause);
		}
		if (key === "settings") {
			out[key] = raw ?? {};
		} else {
			const obj = raw as Record<string, unknown> | null;
			out[key] = obj?.[key] ?? [];
		}
	}
	return out;
}

export function readTripConfigVersion(raw: ConfigRaw): number {
	const settings = raw["settings"] as { version?: number } | undefined;
	return typeof settings?.version === "number" ? settings.version : 0;
}

export function writeTripConfig(location: string, data: ConfigRaw): void {
	mkdirSync(location, { recursive: true });
	writeFileSync(join(location, FILES.settings), stringify(data["settings"]));
	writeFileSync(
		join(location, FILES.owners),
		stringify({ owners: data["owners"] }),
	);
	writeFileSync(
		join(location, FILES.accounts),
		stringify({ accounts: data["accounts"] }),
	);
	writeFileSync(
		join(location, FILES.expenses),
		stringify({ expenses: data["expenses"] }),
	);
}
