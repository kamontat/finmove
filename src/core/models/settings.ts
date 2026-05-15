import type { Tag } from "./tag";

export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	version: 1;
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: string[];
	tags: Tag[];
	exportPath: string;
}
