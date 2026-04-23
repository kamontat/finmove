import type { Expense, Settings, Trip } from "../../models";
import { convertToTHB } from "../currency";
import { daysBetween } from "../date";

export interface TripStatus {
	phase: "upcoming" | "ongoing" | "ended";
	startDate: string;
	endDate: string;
	countries: string[];
	totalDays: number;
	elapsedDays: number;
	remainingDays: number;

	totalSpendThb: number;
	avgPerDayThb: number;
	expenseCount: number;
	byCurrency: { currency: string; amount: number }[];

	topCategories: { category: string; amountThb: number }[];
	categoryCount: { used: number; total: number };
	tagCount: { used: number; total: number };

	ownerBalances: { ownerId: string; name: string; balanceThb: number }[];
	accountCount: number;

	warnings: string[];
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function tryConvertToTHB(expense: Expense, settings: Settings): number | null {
	try {
		const tripRate = settings.currencies[expense.currency]?.exchangeRate;
		return convertToTHB(
			expense.amount,
			expense.currency,
			expense.exchangeRate,
			tripRate,
		);
	} catch {
		return null;
	}
}

export function getTripStatus(trip: Trip, today: string): TripStatus {
	const { settings } = trip;
	const warnings: string[] = [];

	// --- Timeline ---
	const totalDays = daysBetween(settings.startDate, settings.endDate) + 1;
	let phase: TripStatus["phase"];
	let elapsedDays: number;
	if (today < settings.startDate) {
		phase = "upcoming";
		elapsedDays = 0;
	} else if (today > settings.endDate) {
		phase = "ended";
		elapsedDays = totalDays;
	} else {
		phase = "ongoing";
		elapsedDays = daysBetween(settings.startDate, today) + 1;
	}
	const remainingDays = totalDays - elapsedDays;

	// --- Spend ---
	let totalSpendThb = 0;
	let missingRateCount = 0;
	const currencyTotals = new Map<string, number>();

	for (const expense of trip.expenses) {
		currencyTotals.set(
			expense.currency,
			(currencyTotals.get(expense.currency) ?? 0) + expense.amount,
		);
		const thb = tryConvertToTHB(expense, settings);
		if (thb === null) {
			missingRateCount += 1;
		} else {
			totalSpendThb += thb;
		}
	}
	totalSpendThb = round2(totalSpendThb);

	const avgPerDayThb =
		elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;

	const byCurrency = [...currencyTotals.entries()]
		.map(([currency, amount]) => ({ currency, amount: round2(amount) }))
		.sort((a, b) => b.amount - a.amount);

	if (missingRateCount > 0) {
		warnings.push(
			`${missingRateCount} ${missingRateCount === 1 ? "expense" : "expenses"} missing THB rate (excluded from totals)`,
		);
	}

	return {
		phase,
		startDate: settings.startDate,
		endDate: settings.endDate,
		countries: settings.countries,
		totalDays,
		elapsedDays,
		remainingDays,
		totalSpendThb,
		avgPerDayThb,
		expenseCount: trip.expenses.length,
		byCurrency,
		topCategories: [],
		categoryCount: { used: 0, total: settings.categories.length },
		tagCount: { used: 0, total: settings.tags.length },
		ownerBalances: [],
		accountCount: trip.accounts.length,
		warnings,
	};
}
