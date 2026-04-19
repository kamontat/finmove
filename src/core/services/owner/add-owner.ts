import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Owner, Trip } from "../../models";

export function addOwner(trip: Trip, owner: Owner): void {
	const existing = trip.owners.find((o) => o.id === owner.id);
	if (existing) {
		throw new Error(`Owner with id "${owner.id}" already exists`);
	}

	const filePath = join(trip.dirPath, "owners.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { owners: [] };
	data.owners.push(owner);
	writeFileSync(filePath, stringify(data));
	trip.owners.push(owner);
}
