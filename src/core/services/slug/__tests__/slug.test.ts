import { describe, expect, test } from "bun:test";
import { toSlug, uniqueSlug } from "..";

describe("toSlug", () => {
	test("lowercases letters", () => {
		expect(toSlug("Alice")).toBe("alice");
	});

	test("replaces non-alphanumeric runs with a single hyphen", () => {
		expect(toSlug("Alice's Visa")).toBe("alice-s-visa");
	});

	test("strips leading and trailing hyphens", () => {
		expect(toSlug("  Hello World  ")).toBe("hello-world");
		expect(toSlug("--abc--")).toBe("abc");
	});

	test("keeps digits", () => {
		expect(toSlug("Card 2024")).toBe("card-2024");
	});

	test("returns empty string for empty input", () => {
		expect(toSlug("")).toBe("");
	});
});

describe("uniqueSlug", () => {
	test("returns base slug when not taken", () => {
		expect(uniqueSlug("Alice", [])).toBe("alice");
	});

	test("appends -2 on first collision", () => {
		expect(uniqueSlug("Alice", ["alice"])).toBe("alice-2");
	});

	test("skips taken suffixes and finds next free", () => {
		expect(uniqueSlug("Alice", ["alice", "alice-2", "alice-3"])).toBe(
			"alice-4",
		);
	});

	test("accepts any Iterable for takenIds", () => {
		const set = new Set(["alice"]);
		expect(uniqueSlug("Alice", set)).toBe("alice-2");
	});
});
