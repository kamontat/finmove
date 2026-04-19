import type { Account } from "./account";
import type { Expense } from "./expense";
import type { Owner } from "./owner";
import type { Settings } from "./settings";

export interface Trip {
	dirPath: string;
	settings: Settings;
	owners: Owner[];
	accounts: Account[];
	expenses: Expense[];
}
