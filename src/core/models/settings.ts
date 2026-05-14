export interface CurrencyConfig {
	exchangeRate?: number;
}

export interface Settings {
	name: string;
	startDate: string;
	endDate: string;
	countries: string[];
	baseCurrency: "THB";
	currencies: Record<string, CurrencyConfig>;
	categories: string[];
	tags: string[];
	exportPath: string;
}
