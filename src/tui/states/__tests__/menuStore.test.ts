import { describe, expect, test } from "bun:test";
import { MenuStore } from "../menuStore";

describe("MenuStore", () => {
	test("initial state is empty", () => {
		const store = new MenuStore();
		expect(store.getOptions()).toEqual([]);
		expect(store.getArmed()).toBeNull();
		expect(store.getActiveIndex()).toBeNull();
		expect(store.getArmedHint()).toBeNull();
	});

	test("setMenu stores options and onSelect callback", () => {
		const store = new MenuStore();
		const onSelect = (_value: string) => {};
		store.setMenu([{ label: "Add", value: "add", key: "a" }], onSelect);
		expect(store.getOptions()).toEqual([
			{ label: "Add", value: "add", key: "a" },
		]);
		expect(store.getOnSelect()).toBe(onSelect);
	});

	test("setMenu preserves activeIndex (selector mount may set it before parent setMenu)", () => {
		const store = new MenuStore();
		store.setActiveIndex(3);
		store.setMenu([], () => {});
		expect(store.getActiveIndex()).toBe(3);
	});

	test("setMenu clears any prior armed state", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main");
		expect(store.getArmed()).not.toBeNull();
		store.setMenu([], () => {});
		expect(store.getArmed()).toBeNull();
	});

	test("trigger calls onSelect when focus is menu", () => {
		const store = new MenuStore();
		const calls: string[] = [];
		store.setMenu([{ label: "Add", value: "add", key: "a" }], (value) =>
			calls.push(value),
		);
		store.trigger("add", "menu");
		expect(calls).toEqual(["add"]);
	});

	test("trigger ignores unknown values", () => {
		const store = new MenuStore();
		const calls: string[] = [];
		store.setMenu([{ label: "Add", value: "add", key: "a" }], (value) =>
			calls.push(value),
		);
		store.trigger("missing", "menu");
		expect(calls).toEqual([]);
	});

	test("trigger calls onSelect from main focus when option has no mainAction", () => {
		const store = new MenuStore();
		const calls: string[] = [];
		store.setMenu([{ label: "Add", value: "add", key: "a" }], (value) =>
			calls.push(value),
		);
		store.setActiveIndex(2);
		store.trigger("add", "main");
		expect(calls).toEqual(["add"]);
	});

	test("trigger calls onSelect from main focus when activeIndex is null", () => {
		const store = new MenuStore();
		const calls: string[] = [];
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
			],
			(value) => calls.push(value),
		);
		// activeIndex stays null (no list rendered)
		store.trigger("delete", "main");
		expect(calls).toEqual(["delete"]);
	});

	test("trigger fires onConfirm immediately when confirmCount is 1 (default)", () => {
		const store = new MenuStore();
		const confirmed: number[] = [];
		store.setMenu(
			[
				{
					label: "Duplicate",
					value: "duplicate",
					key: "d",
					mainAction: { onConfirm: (i) => confirmed.push(i) },
				},
			],
			() => {},
		);
		store.setActiveIndex(2);
		store.trigger("duplicate", "main");
		expect(confirmed).toEqual([2]);
		expect(store.getArmed()).toBeNull();
	});

	test("trigger arms on first press when confirmCount is 2", () => {
		const store = new MenuStore();
		const confirmed: number[] = [];
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: (i) => confirmed.push(i) },
				},
			],
			() => {},
		);
		store.setActiveIndex(1);
		store.trigger("delete", "main");
		expect(confirmed).toEqual([]);
		expect(store.getArmed()).toEqual({ value: "delete", index: 1, count: 1 });
	});

	test("trigger fires onConfirm on second press for confirmCount: 2", () => {
		const store = new MenuStore();
		const confirmed: number[] = [];
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: (i) => confirmed.push(i) },
				},
			],
			() => {},
		);
		store.setActiveIndex(1);
		store.trigger("delete", "main"); // arm
		store.trigger("delete", "main"); // confirm
		expect(confirmed).toEqual([1]);
		expect(store.getArmed()).toBeNull();
	});

	test("trigger does not arm when check returns false", () => {
		const store = new MenuStore();
		const confirmed: number[] = [];
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: {
						confirmCount: 2,
						check: () => false,
						onConfirm: (i) => confirmed.push(i),
					},
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main");
		expect(confirmed).toEqual([]);
		expect(store.getArmed()).toBeNull();
	});

	test("trigger arms when check returns true", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: {
						confirmCount: 2,
						check: () => true,
						onConfirm: () => {},
					},
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main");
		expect(store.getArmed()).toEqual({ value: "delete", index: 0, count: 1 });
	});

	test("setActiveIndex clears armed when index changes", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main"); // arm at 0
		expect(store.getArmed()).not.toBeNull();
		store.setActiveIndex(1);
		expect(store.getArmed()).toBeNull();
	});

	test("setActiveIndex keeps armed when same index re-sets", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main"); // arm at 0
		store.setActiveIndex(0); // same index
		expect(store.getArmed()).toEqual({ value: "delete", index: 0, count: 1 });
	});

	test("trigger clears armed when falling through to onSelect", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
				{ label: "Add", value: "add", key: "a" },
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main"); // arm
		expect(store.getArmed()).not.toBeNull();
		store.trigger("add", "main"); // different value, no mainAction → fall through
		expect(store.getArmed()).toBeNull();
	});

	test("armedHint formats from armed option label and key", () => {
		const store = new MenuStore();
		store.setMenu(
			[
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: { confirmCount: 2, onConfirm: () => {} },
				},
			],
			() => {},
		);
		store.setActiveIndex(0);
		store.trigger("delete", "main");
		expect(store.getArmedHint()).toBe("Press [x] again to confirm delete");
	});

	test("armedHint is null when not armed", () => {
		const store = new MenuStore();
		expect(store.getArmedHint()).toBeNull();
	});
});
