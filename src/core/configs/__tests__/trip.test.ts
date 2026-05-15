import { describe, expect, test } from "bun:test";
import { tripV0ToV1 } from "../trip/migrations/v0_to_v1";
import { tripV0Schema } from "../trip/schemas/v0";
import { tripV1Schema } from "../trip/schemas/v1";

const baseV0Settings = {
	name: "Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB" as const,
	currencies: {},
	categories: ["Food"],
	exportPath: "./expenses.csv",
};

describe("tripV0ToV1 migration", () => {
	test("stamps version: 1 and normalizes string tags", () => {
		const input = tripV0Schema.parse({
			settings: { ...baseV0Settings, tags: ["work", "fun"] },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.version).toBe(1);
		expect(out.settings.tags).toEqual([
			{ value: "work", default: false },
			{ value: "fun", default: false },
		]);
		expect(() => tripV1Schema.parse(out)).not.toThrow();
	});

	test("passes through already-normalized Tag objects", () => {
		const input = tripV0Schema.parse({
			settings: {
				...baseV0Settings,
				tags: [{ value: "biz", default: true }],
			},
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.tags).toEqual([{ value: "biz", default: true }]);
	});

	test("handles missing tags as empty array", () => {
		const input = tripV0Schema.parse({
			settings: { ...baseV0Settings },
			owners: [],
			accounts: [],
			expenses: [],
		});

		const out = tripV0ToV1(input);

		expect(out.settings.tags).toEqual([]);
		expect(out.settings.version).toBe(1);
	});
});
