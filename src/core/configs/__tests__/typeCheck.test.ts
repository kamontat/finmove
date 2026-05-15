import { describe, test } from "bun:test";
import type { Account, Expense, Owner, Settings } from "../../models";
import type { TripV1 } from "../trip";

describe("TripV1 inferred types align with hand-written models", () => {
	test("compile-time only: assignability holds in both directions", () => {
		// These declarations exist solely so the TypeScript compiler exercises
		// structural assignability. If `Settings`, `Owner`, `Account`, or
		// `Expense` ever drifts from the schema, `bun run check:type` will fail.
		const _settings: Settings = {} as TripV1["settings"];
		const _owner: Owner = {} as TripV1["owners"][number];
		const _account: Account = {} as TripV1["accounts"][number];
		const _expense: Expense = {} as TripV1["expenses"][number];

		const _settingsBack: TripV1["settings"] = {} as Settings;
		const _ownerBack: TripV1["owners"][number] = {} as Owner;
		const _accountBack: TripV1["accounts"][number] = {} as Account;
		const _expenseBack: TripV1["expenses"][number] = {} as Expense;

		void _settings;
		void _owner;
		void _account;
		void _expense;
		void _settingsBack;
		void _ownerBack;
		void _accountBack;
		void _expenseBack;
	});
});
