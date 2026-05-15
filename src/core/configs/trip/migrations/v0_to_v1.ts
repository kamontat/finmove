import type { TripV0 } from "../schemas/v0";
import type { TripV1 } from "../schemas/v1";

export function tripV0ToV1(input: TripV0): TripV1 {
	return {
		settings: {
			...input.settings,
			version: 1,
			tags: (input.settings.tags ?? []).map((t) =>
				typeof t === "string" ? { value: t, default: false } : t,
			),
		},
		owners: input.owners as TripV1["owners"],
		accounts: input.accounts as TripV1["accounts"],
		expenses: input.expenses as TripV1["expenses"],
	};
}
