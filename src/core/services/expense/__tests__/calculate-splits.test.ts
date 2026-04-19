import { describe, expect, test } from "bun:test";
import type { ExpenseOwnerSplit, Owner } from "../../../models";
import { calculateSplits } from "../calculate-splits";

const allOwners: Owner[] = [
	{ id: "alice", name: "Alice" },
	{ id: "bob", name: "Bob" },
	{ id: "carol", name: "Carol" },
];

describe("calculateSplits", () => {
	test("omitted owners: equal split among all trip owners", () => {
		const result = calculateSplits(900, undefined, allOwners);
		expect(result).toEqual([
			{ ownerId: "alice", amount: 300 },
			{ ownerId: "bob", amount: 300 },
			{ ownerId: "carol", amount: 300 },
		]);
	});

	test("list of IDs: equal split among listed owners only", () => {
		const result = calculateSplits(600, ["alice", "bob"], allOwners);
		expect(result).toEqual([
			{ ownerId: "alice", amount: 300 },
			{ ownerId: "bob", amount: 300 },
		]);
	});

	test("percentage split", () => {
		const splits: ExpenseOwnerSplit[] = [
			{ id: "alice", split: "60%" },
			{ id: "bob", split: "40%" },
		];
		const result = calculateSplits(1000, splits, allOwners);
		expect(result).toEqual([
			{ ownerId: "alice", amount: 600 },
			{ ownerId: "bob", amount: 400 },
		]);
	});

	test("fixed amount split", () => {
		const splits: ExpenseOwnerSplit[] = [
			{ id: "alice", split: 700 },
			{ id: "bob", split: 300 },
		];
		const result = calculateSplits(1000, splits, allOwners);
		expect(result).toEqual([
			{ ownerId: "alice", amount: 700 },
			{ ownerId: "bob", amount: 300 },
		]);
	});

	test("split with object entries but no split field: equal among listed", () => {
		const splits: ExpenseOwnerSplit[] = [{ id: "alice" }, { id: "bob" }];
		const result = calculateSplits(400, splits, allOwners);
		expect(result).toEqual([
			{ ownerId: "alice", amount: 200 },
			{ ownerId: "bob", amount: 200 },
		]);
	});

	test("rounds to 2 decimal places", () => {
		const result = calculateSplits(100, undefined, allOwners);
		expect(result[0].amount).toBe(33.33);
		expect(result[1].amount).toBe(33.33);
		expect(result[2].amount).toBe(33.33);
	});
});
