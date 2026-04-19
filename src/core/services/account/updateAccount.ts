import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { AccountType, Trip } from "../../models";

export function updateAccount(
	trip: Trip,
	accountId: string,
	updates: { name?: string; type?: AccountType; owners?: string[] },
): void {
	const index = trip.accounts.findIndex((a) => a.id === accountId);
	if (index === -1) {
		throw new Error(`Account with id "${accountId}" not found`);
	}

	const filePath = join(trip.dirPath, "accounts.yaml");
	const data = parse(readFileSync(filePath, "utf-8"));
	// biome-ignore lint/style/noNonNullAssertion: index validated above
	const account = trip.accounts[index]!;

	if (updates.name !== undefined) {
		data.accounts[index].name = updates.name;
		account.name = updates.name;
	}
	if (updates.type !== undefined) {
		data.accounts[index].type = updates.type;
		account.type = updates.type;
	}
	if (updates.owners !== undefined) {
		data.accounts[index].owners = updates.owners;
		account.owners = updates.owners;
	}

	writeFileSync(filePath, stringify(data));
}
