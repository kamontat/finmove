import { describe, expect, test } from "bun:test";
import { FormBufferStore } from "../formBufferStore";

describe("FormBufferStore", () => {
	test("get returns undefined for unknown form id", () => {
		const store = new FormBufferStore();
		expect(store.get("missing")).toBeUndefined();
	});

	test("setField creates a buffer when the form id is new", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		expect(store.get("trip-new")).toEqual({ name: "Japan" });
	});

	test("setField updates an existing field without dropping siblings", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("trip-new", "countries", ["Japan", "Korea"]);
		expect(store.get("trip-new")).toEqual({
			name: "Japan",
			countries: ["Japan", "Korea"],
		});
	});

	test("setValues replaces the entire buffer", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setValues("trip-new", { name: "Korea", countries: ["Korea"] });
		expect(store.get("trip-new")).toEqual({
			name: "Korea",
			countries: ["Korea"],
		});
	});

	test("clear removes only the named buffer", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("expense-new", "payee", "Ramen");
		store.clear("trip-new");
		expect(store.get("trip-new")).toBeUndefined();
		expect(store.get("expense-new")).toEqual({ payee: "Ramen" });
	});

	test("clearByPrefix removes matching ids and leaves others", () => {
		const store = new FormBufferStore();
		store.setField("trip-new", "name", "Japan");
		store.setField("expense-new", "payee", "Ramen");
		store.setField("expense-edit-e1", "payee", "Sushi");
		store.clearByPrefix("expense-");
		expect(store.get("trip-new")).toEqual({ name: "Japan" });
		expect(store.get("expense-new")).toBeUndefined();
		expect(store.get("expense-edit-e1")).toBeUndefined();
	});

	test("subscribe fires on every mutation", () => {
		const store = new FormBufferStore();
		let calls = 0;
		const unsub = store.subscribe(() => {
			calls += 1;
		});
		store.setField("a", "k", "v");
		store.setField("a", "k", "v2");
		store.setValues("b", { x: "y" });
		store.clear("a");
		store.clearByPrefix("b");
		expect(calls).toBe(5);
		unsub();
		store.setField("c", "k", "v");
		expect(calls).toBe(5);
	});
});
