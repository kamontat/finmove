import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Account, Trip } from "../../models";

export function addAccount(trip: Trip, account: Account): void {
  const existing = trip.accounts.find((a) => a.id === account.id);
  if (existing) {
    throw new Error(`Account with id "${account.id}" already exists`);
  }

  for (const ownerId of account.owners) {
    if (!trip.owners.some((o) => o.id === ownerId)) {
      throw new Error(`Owner "${ownerId}" not found`);
    }
  }

  const filePath = join(trip.dirPath, "accounts.yaml");
  const data = parse(readFileSync(filePath, "utf-8")) ?? { accounts: [] };
  data.accounts.push(account);
  writeFileSync(filePath, stringify(data));
  trip.accounts.push(account);
}
