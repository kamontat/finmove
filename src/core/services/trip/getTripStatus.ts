import type { Expense, Settings, Trip } from "../../models";
import { convertToTHB } from "../currency";
import { daysBetween } from "../date";
import { calculateSplits } from "../expense";

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

	// --- Spend + Categories + Tags ---
	let totalSpendThb = 0;
	let missingRateCount = 0;
	const currencyTotals = new Map<string, number>();
	const categoryTotals = new Map<string, number>();
	const usedCategories = new Set<string>();
	const usedTags = new Set<string>();
	const paid = new Map<string, number>();
	const share = new Map<string, number>();
	const orphanAccounts = new Set<string>();

	for (const expense of trip.expenses) {
		currencyTotals.set(
			expense.currency,
			(currencyTotals.get(expense.currency) ?? 0) + expense.amount,
		);
		usedCategories.add(expense.category);
		for (const tag of expense.tags) {
			usedTags.add(tag);
		}

		const thb = tryConvertToTHB(expense, settings);
		if (thb === null) {
			missingRateCount += 1;
		} else {
			totalSpendThb += thb;
			categoryTotals.set(
				expense.category,
				(categoryTotals.get(expense.category) ?? 0) + thb,
			);

			const account = trip.accounts.find((a) => a.id === expense.accountId);
			if (account) {
				if (account.owners.length === 0) {
					orphanAccounts.add(account.name);
				} else {
					const paidShare = thb / account.owners.length;
					for (const ownerId of account.owners) {
						paid.set(ownerId, (paid.get(ownerId) ?? 0) + paidShare);
					}
				}
			}

			for (const { ownerId, amount } of calculateSplits(
				thb,
				expense.owners,
				trip.owners,
			)) {
				share.set(ownerId, (share.get(ownerId) ?? 0) + amount);
			}
		}
	}
	totalSpendThb = round2(totalSpendThb);

	const avgPerDayThb =
		elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;

	const byCurrency = [...currencyTotals.entries()]
		.map(([currency, amount]) => ({ currency, amount: round2(amount) }))
		.sort((a, b) => b.amount - a.amount);

	const sortedCategories = [...categoryTotals.entries()]
		.map(([category, amountThb]) => ({
			category,
			amountThb: round2(amountThb),
		}))
		.sort((a, b) => b.amountThb - a.amountThb);

	const topCategories =
		sortedCategories.length <= 5
			? sortedCategories
			: [
					...sortedCategories.slice(0, 5),
					{
						category: "Other",
						amountThb: round2(
							sortedCategories
								.slice(5)
								.reduce((sum, c) => sum + c.amountThb, 0),
						),
					},
				];

	if (missingRateCount > 0) {
		warnings.push(
			`${missingRateCount} ${missingRateCount === 1 ? "expense" : "expenses"} missing THB rate (excluded from totals)`,
		);
	}

	const ownerBalances = trip.owners.map((o) => ({
		ownerId: o.id,
		name: o.name,
		balanceThb: round2((paid.get(o.id) ?? 0) - (share.get(o.id) ?? 0)),
	}));

	for (const name of orphanAccounts) {
		warnings.push(`Account '${name}' has no owners — expenses not attributed`);
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
		topCategories,
		categoryCount: {
			used: usedCategories.size,
			total: settings.categories.length,
		},
		tagCount: { used: usedTags.size, total: settings.tags.length },
		ownerBalances,
		accountCount: trip.accounts.length,
		warnings,
	};
}
