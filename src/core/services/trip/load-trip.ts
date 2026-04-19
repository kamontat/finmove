import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Trip, Settings, Owner, Account, Expense } from "../../models";

export function loadTrip(tripPath: string): Trip {
  const settingsRaw = readFileSync(join(tripPath, "settings.yaml"), "utf-8");
  const ownersRaw = readFileSync(join(tripPath, "owners.yaml"), "utf-8");
  const accountsRaw = readFileSync(join(tripPath, "accounts.yaml"), "utf-8");
  const expensesRaw = readFileSync(join(tripPath, "expenses.yaml"), "utf-8");

  const settings: Settings = parse(settingsRaw);
  const owners: Owner[] = parse(ownersRaw)?.owners ?? [];
  const accounts: Account[] = parse(accountsRaw)?.accounts ?? [];
  const expenses: Expense[] = parse(expensesRaw)?.expenses ?? [];

  return { dirPath: tripPath, settings, owners, accounts, expenses };
}
