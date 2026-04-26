import type { Settings } from "../models";

export const DEFAULT_BASE_CURRENCY = "THB" as const;

export const DEFAULT_EXPORT_PATH = "./expenses.csv";

export const DEFAULT_CATEGORIES: readonly string[] = [
	"Flight",
	"Hotels",
	"Transportation",
	"Shopping",
	"Eating",
	"Activities",
];

export const DEFAULT_TRIP_SETTINGS: Omit<
	Settings,
	"name" | "startDate" | "endDate"
> = {
	countries: [],
	baseCurrency: DEFAULT_BASE_CURRENCY,
	currencies: {},
	categories: [...DEFAULT_CATEGORIES],
	tags: [],
	exportPath: DEFAULT_EXPORT_PATH,
};
