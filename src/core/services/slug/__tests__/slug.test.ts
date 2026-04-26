import { describe, expect, test } from "bun:test";
import { toSlug, uniqueSlug, isValidSlug } from "..";

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

describe("isValidSlug", () => {
	test("accepts lowercase letters, digits, and hyphens", () => {
		expect(isValidSlug("alice")).toBe(true);
		expect(isValidSlug("alice-2")).toBe(true);
		expect(isValidSlug("japan-trip-2026")).toBe(true);
		expect(isValidSlug("a1b2-c3")).toBe(true);
	});

	test("rejects uppercase letters", () => {
		expect(isValidSlug("Alice")).toBe(false);
	});

	test("rejects spaces and other punctuation", () => {
		expect(isValidSlug("alice 2")).toBe(false);
		expect(isValidSlug("alice_2")).toBe(false);
		expect(isValidSlug("alice/bob")).toBe(false);
		expect(isValidSlug("alice.")).toBe(false);
	});

	test("rejects empty string", () => {
		expect(isValidSlug("")).toBe(false);
	});

	test("rejects unicode", () => {
		expect(isValidSlug("αlice")).toBe(false);
	});
});
