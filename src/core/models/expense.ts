export enum SplitType {
	Equal = "Equal",
	Percentage = "Percentage",
	Amount = "Amount",
}

export interface ExpenseOwnerSplit {
	id: string;
	split?: string | number; // "50%" or 500
}

export interface Expense {
	id: string;
	accountId: string;
	date: string;
	payee: string;
	category: string;
	amount: number;
	currency: string;
	exchangeRate?: number;
	owners?: string[] | ExpenseOwnerSplit[];
	description: string;
	tags: string[];
}
