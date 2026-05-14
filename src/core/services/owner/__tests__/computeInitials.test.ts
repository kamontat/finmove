import { describe, expect, test } from "bun:test";
import { computeInitials } from "../computeInitials";

describe("computeInitials", () => {
	test("returns empty map for empty input", () => {
		expect(computeInitials([])).toEqual({});
	});

	test("single name maps to first character", () => {
		expect(computeInitials(["Alice"])).toEqual({ Alice: "A" });
	});

	test("two distinct first letters disambiguate at length 1", () => {
		expect(computeInitials(["Alice", "Bob"])).toEqual({
			Alice: "A",
			Bob: "B",
		});
	});

	test("shared first letter disambiguates at length 2", () => {
		expect(computeInitials(["Net", "Nid"])).toEqual({
			Net: "Ne",
			Nid: "Ni",
		});
	});

	test("three names with mixed disambiguation lengths", () => {
		expect(computeInitials(["Alice", "Aaron", "Bob"])).toEqual({
			Alice: "Al",
			Aaron: "Aa",
			Bob: "B",
		});
	});

	test("three names all sharing first letter disambiguate at length 2", () => {
		expect(computeInitials(["Net", "Nid", "Nan"])).toEqual({
			Net: "Ne",
			Nid: "Ni",
			Nan: "Na",
		});
	});

	test("identical names fall back to the full name", () => {
		expect(computeInitials(["Sam", "Sam"])).toEqual({ Sam: "Sam" });
	});

	test("one name is a prefix of another", () => {
		expect(computeInitials(["Sam", "Sammy"])).toEqual({
			Sam: "Sam",
			Sammy: "Samm",
		});
	});
});
