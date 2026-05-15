import { z } from "zod";

const tagOrStringSchema = z.union([
	z.string(),
	z.object({ value: z.string(), default: z.boolean() }),
]);

const settingsSchemaV0 = z
	.object({
		name: z.string(),
		startDate: z.string(),
		endDate: z.string(),
		countries: z.array(z.string()),
		baseCurrency: z.literal("THB"),
		currencies: z.record(
			z.string(),
			z.object({ exchangeRate: z.number().optional() }),
		),
		categories: z.array(z.string()),
		tags: z.array(tagOrStringSchema).optional(),
		exportPath: z.string(),
	})
	.passthrough();

export interface TripV0 {
	settings: {
		name: string;
		startDate: string;
		endDate: string;
		countries: string[];
		baseCurrency: "THB";
		currencies: Record<string, { exchangeRate?: number }>;
		categories: string[];
		tags?: Array<string | { value: string; default: boolean }>;
		exportPath: string;
		[k: string]: unknown;
	};
	owners: unknown[];
	accounts: unknown[];
	expenses: unknown[];
}

export const tripV0Schema: z.ZodTypeAny = z.object({
	settings: settingsSchemaV0,
	owners: z.array(z.unknown()),
	accounts: z.array(z.unknown()),
	expenses: z.array(z.unknown()),
});
