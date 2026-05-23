import { z } from "zod";
import type { Account, Expense, Owner, Settings } from "../../../models";

const tagSchema = z.object({
	value: z.string(),
	default: z.boolean(),
});

const categorySchema = z.object({
	value: z.string(),
	excluded: z.boolean(),
});

const currencyConfigSchema = z.object({
	exchangeRate: z.number().optional(),
});

const settingsSchemaV2 = z.object({
	version: z.literal(2),
	name: z.string().min(1),
	startDate: z.string(),
	endDate: z.string(),
	countries: z.array(z.string()),
	baseCurrency: z.literal("THB"),
	currencies: z.record(z.string(), currencyConfigSchema),
	categories: z.array(categorySchema),
	tags: z.array(tagSchema),
	exportPath: z.string(),
});

const ownerSchema = z.object({
	id: z.string(),
	name: z.string(),
});

const accountSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(["Credit", "Debit"]),
	owners: z.array(z.string()),
});

const expenseOwnerSplitSchema = z.object({
	id: z.string(),
	split: z.union([z.string(), z.number()]).optional(),
});

const expenseSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	date: z.string(),
	payee: z.string(),
	category: z.string(),
	amount: z.number(),
	currency: z.string(),
	exchangeRate: z.number().optional(),
	owners: z
		.union([z.array(z.string()), z.array(expenseOwnerSplitSchema)])
		.optional(),
	description: z.string(),
	tags: z.array(z.string()),
});

export interface TripV2 {
	settings: Settings;
	owners: Owner[];
	accounts: Account[];
	expenses: Expense[];
}

export const tripV2Schema: z.ZodTypeAny = z.object({
	settings: settingsSchemaV2,
	owners: z.array(ownerSchema),
	accounts: z.array(accountSchema),
	expenses: z.array(expenseSchema),
});
