import type { Settings } from "./settings";
import type { Owner } from "./owner";
import type { Account } from "./account";
import type { Expense } from "./expense";

export interface Trip {
  dirPath: string;
  settings: Settings;
  owners: Owner[];
  accounts: Account[];
  expenses: Expense[];
}
