import type { Category, Settings } from "../models";

export const DEFAULT_BASE_CURRENCY = "THB" as const;

export const DEFAULT_EXPORT_PATH = "./expenses.csv";

export const DEFAULT_CATEGORIES: readonly Category[] = [
	{ value: "Flight", excluded: false },
	{ value: "Hotels", excluded: false },
	{ value: "Transportation", excluded: false },
	{ value: "Shopping", excluded: false },
	{ value: "Food", excluded: false },
	{ value: "Beverages", excluded: false },
	{ value: "Activities", excluded: false },
];

export const DEFAULT_TRIP_SETTINGS: Omit<
	Settings,
	"name" | "startDate" | "endDate"
> = {
	version: 2,
	countries: [],
	baseCurrency: DEFAULT_BASE_CURRENCY,
	currencies: {},
	categories: [...DEFAULT_CATEGORIES],
	tags: [],
	exportPath: DEFAULT_EXPORT_PATH,
};
