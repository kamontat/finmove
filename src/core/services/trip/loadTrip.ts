import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type {
	Account,
	Expense,
	Owner,
	Settings,
	Tag,
	Trip,
} from "../../models";

export function loadTrip(tripPath: string): Trip {
	const settingsPath = join(tripPath, "settings.yaml");
	const settingsRaw = readFileSync(settingsPath, "utf-8");
	const ownersRaw = readFileSync(join(tripPath, "owners.yaml"), "utf-8");
	const accountsRaw = readFileSync(join(tripPath, "accounts.yaml"), "utf-8");
	const expensesRaw = readFileSync(join(tripPath, "expenses.yaml"), "utf-8");

	const parsedSettings = parse(settingsRaw) as Omit<Settings, "tags"> & {
		tags?: Array<string | Tag>;
	};

	const { tags: normalizedTags, didNormalize } = normalizeTags(
		Array.isArray(parsedSettings.tags) ? parsedSettings.tags : [],
	);

	const settings: Settings = { ...parsedSettings, tags: normalizedTags };

	if (didNormalize) {
		writeFileSync(settingsPath, stringify(settings));
	}

	const owners: Owner[] = parse(ownersRaw)?.owners ?? [];
	const accounts: Account[] = parse(accountsRaw)?.accounts ?? [];
	const expenses: Expense[] = parse(expensesRaw)?.expenses ?? [];

	return { dirPath: tripPath, settings, owners, accounts, expenses };
}

function normalizeTags(raw: Array<string | Tag>): {
	tags: Tag[];
	didNormalize: boolean;
} {
	let didNormalize = false;
	const tags: Tag[] = raw.map((entry) => {
		if (typeof entry === "string") {
			didNormalize = true;
			return { value: entry, default: false };
		}
		return entry;
	});
	return { tags, didNormalize };
}
