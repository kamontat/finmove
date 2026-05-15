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

// Hand-written interface that mirrors `tripV0Schema`. Kept in sync manually
// because `tripV0Schema` is typed as `z.ZodTypeAny` (see definition.ts for the
// rationale), so `z.infer<typeof tripV0Schema>` resolves to `any` and can't be
// used as the migration's input type. When the v0 schema changes, update this
// interface in lockstep — the compiler will not catch drift on its own.
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
