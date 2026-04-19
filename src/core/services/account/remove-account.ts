import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeAccount(trip: Trip, accountId: string): void {
  const index = trip.accounts.findIndex((a) => a.id === accountId);
  if (index === -1) {
    throw new Error(`Account with id "${accountId}" not found`);
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8"));
  data.accounts.splice(index, 1);
  writeFileSync(filePath, stringify(data));
  trip.accounts.splice(index, 1);
}
