import { describe, expect, test } from "bun:test";
import { parseZventId } from "../parseZventId";

describe("parseZventId", () => {
	test("returns id for well-formed Zvent tag", () => {
		expect(parseZventId("Zvent: 042 Foo (Jan 2026)")).toBe("042");
	});

	test("returns null for 1-digit id", () => {
		expect(parseZventId("Zvent: 5 Foo")).toBeNull();
	});

	test("returns null for 4-digit id", () => {
		expect(parseZventId("Zvent: 0001 Foo")).toBeNull();
	});

	test("returns null for non-Zvent tag", () => {
		expect(parseZventId("food")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(parseZventId("")).toBeNull();
	});
});
