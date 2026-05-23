import type { Category } from "./category";
import type { Tag } from "./tag";

export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	version: 2;
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: Category[];
	tags: Tag[];
	exportPath: string;
}
