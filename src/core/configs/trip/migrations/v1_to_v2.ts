import type { TripV1 } from "../schemas/v1";
import type { TripV2 } from "../schemas/v2";

export function tripV1ToV2(input: TripV1): TripV2 {
	return {
		settings: {
			...input.settings,
			version: 2,
			categories: input.settings.categories.map((c) =>
				typeof c === "string" ? { value: c, excluded: false } : c,
			),
		},
		owners: input.owners,
		accounts: input.accounts,
		expenses: input.expenses,
	};
}
