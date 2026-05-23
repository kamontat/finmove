import type { AccountType, Expense, Settings, Trip } from "../../models";
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
	totalSpendExcludedThb: number;
	avgPerDayThb: number;
	avgPerDayExcludedThb: number;
	avgPerDayPerPersonThb: number;
	avgPerDayPerPersonExcludedThb: number;
	hasExcludedCategories: boolean;
	expenseCount: number;
	byCurrency: { currency: string; amount: number }[];

	topCategories: { category: string; amountThb: number }[];
	categoryCount: { used: number; total: number };
	tagCount: { used: number; total: number };

	ownerBalances: {
		ownerId: string;
		name: string;
		shareThb: number;
		balanceThb: number;
	}[];
	accountCount: number;
	byAccount: {
		accountId: string;
		name: string;
		type: AccountType;
		totalThb: number;
		expenseCount: number;
	}[];

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
	const excludedCategorySet = new Set(
		settings.categories.filter((c) => c.excluded).map((c) => c.value),
	);
	let totalSpendExcludedThb = 0;
	let totalSpendThb = 0;
	let missingRateCount = 0;
	const currencyTotals = new Map<string, number>();
	const categoryTotals = new Map<string, number>();
	const usedCategories = new Set<string>();
	const usedTags = new Set<string>();
	const paid = new Map<string, number>();
	const share = new Map<string, number>();
	// Key orphan accounts by id so two accounts sharing a name stay distinct.
	const orphanAccounts = new Map<string, string>();
	const knownOwnerIds = new Set(trip.owners.map((o) => o.id));
	const unknownOwnerIds = new Set<string>();
	const accountAggregates = new Map<
		string,
		{ name: string; type: AccountType; totalThb: number; expenseCount: number }
	>();

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
			if (!excludedCategorySet.has(expense.category)) {
				totalSpendExcludedThb += thb;
			}
			categoryTotals.set(
				expense.category,
				(categoryTotals.get(expense.category) ?? 0) + thb,
			);

			const account = trip.accounts.find((a) => a.id === expense.accountId);
			if (account) {
				const existing = accountAggregates.get(account.id);
				if (existing) {
					existing.totalThb += thb;
					existing.expenseCount += 1;
				} else {
					accountAggregates.set(account.id, {
						name: account.name,
						type: account.type,
						totalThb: thb,
						expenseCount: 1,
					});
				}
				if (account.owners.length === 0) {
					orphanAccounts.set(account.id, account.name);
				} else {
					const paidShare = thb / account.owners.length;
					for (const ownerId of account.owners) {
						if (knownOwnerIds.has(ownerId)) {
							paid.set(ownerId, (paid.get(ownerId) ?? 0) + paidShare);
						} else {
							unknownOwnerIds.add(ownerId);
						}
					}
				}
			}

			if (trip.owners.length > 0) {
				for (const { ownerId, amount } of calculateSplits(
					thb,
					expense.owners,
					trip.owners,
				)) {
					if (knownOwnerIds.has(ownerId)) {
						share.set(ownerId, (share.get(ownerId) ?? 0) + amount);
					} else {
						unknownOwnerIds.add(ownerId);
					}
				}
			}
		}
	}
	totalSpendThb = round2(totalSpendThb);
	totalSpendExcludedThb = round2(totalSpendExcludedThb);

	const ownerCount = trip.owners.length;
	const avgPerDayThb =
		elapsedDays > 0 ? round2(totalSpendThb / elapsedDays) : 0;
	const avgPerDayExcludedThb =
		elapsedDays > 0 ? round2(totalSpendExcludedThb / elapsedDays) : 0;
	const avgPerDayPerPersonThb =
		elapsedDays > 0 && ownerCount > 0
			? round2(totalSpendThb / elapsedDays / ownerCount)
			: 0;
	const avgPerDayPerPersonExcludedThb =
		elapsedDays > 0 && ownerCount > 0
			? round2(totalSpendExcludedThb / elapsedDays / ownerCount)
			: 0;
	const hasExcludedCategories = excludedCategorySet.size > 0;

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
		shareThb: round2(share.get(o.id) ?? 0),
		balanceThb: round2((paid.get(o.id) ?? 0) - (share.get(o.id) ?? 0)),
	}));

	const byAccount = trip.accounts
		.map((account) => {
			const agg = accountAggregates.get(account.id);
			return {
				accountId: account.id,
				name: account.name,
				type: account.type,
				totalThb: agg ? round2(agg.totalThb) : 0,
				expenseCount: agg?.expenseCount ?? 0,
			};
		})
		.sort((a, b) => {
			if (b.totalThb !== a.totalThb) return b.totalThb - a.totalThb;
			return a.name.localeCompare(b.name);
		});

	for (const name of orphanAccounts.values()) {
		warnings.push(`Account '${name}' has no owners — expenses not attributed`);
	}

	if (trip.accounts.length === 0 && trip.owners.length > 0) {
		warnings.push("No accounts configured — per-owner balances unavailable");
	}

	if (unknownOwnerIds.size > 0) {
		const ids = [...unknownOwnerIds].sort().join(", ");
		warnings.push(
			`Unknown owner id${unknownOwnerIds.size === 1 ? "" : "s"}: ${ids} — excluded from balance calculations`,
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
		totalSpendExcludedThb,
		avgPerDayThb,
		avgPerDayExcludedThb,
		avgPerDayPerPersonThb,
		avgPerDayPerPersonExcludedThb,
		hasExcludedCategories,
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
		byAccount,
		warnings,
	};
}
