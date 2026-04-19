import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function updateOwner(
	trip: Trip,
	ownerId: string,
	newName: string,
): void {
	const index = trip.owners.findIndex((o) => o.id === ownerId);
	if (index === -1) {
		throw new Error(`Owner with id "${ownerId}" not found`);
	}

	const filePath = join(trip.dirPath, "owners.yaml");
	const data = parse(readFileSync(filePath, "utf-8"));
	data.owners[index].name = newName;
	writeFileSync(filePath, stringify(data));
	// biome-ignore lint/style/noNonNullAssertion: index validated above
	trip.owners[index]!.name = newName;
}
