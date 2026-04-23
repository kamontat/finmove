import type { Trip } from "../../models";
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

export function getTripStatus(trip: Trip, today: string): TripStatus {
	const { settings } = trip;
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

	return {
		phase,
		startDate: settings.startDate,
		endDate: settings.endDate,
		countries: settings.countries,
		totalDays,
		elapsedDays,
		remainingDays,
		totalSpendThb: 0,
		avgPerDayThb: 0,
		expenseCount: 0,
		byCurrency: [],
		topCategories: [],
		categoryCount: { used: 0, total: settings.categories.length },
		tagCount: { used: 0, total: settings.tags.length },
		ownerBalances: [],
		accountCount: trip.accounts.length,
		warnings: [],
	};
}
