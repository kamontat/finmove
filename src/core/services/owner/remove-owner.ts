import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeOwner(trip: Trip, ownerId: string): void {
  const index = trip.owners.findIndex((o) => o.id === ownerId);
  if (index === -1) {
    throw new Error(`Owner with id "${ownerId}" not found`);
  }

  const filePath = join(trip.dirPath, "owners.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.owners.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.owners.splice(index, 1);
}
