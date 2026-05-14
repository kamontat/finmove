import { describe, expect, test } from "bun:test";
import type { Tag } from "../../models";
import { validateTag } from "../tag";

const existing: Tag[] = [
	{ value: "business", default: false },
	{ value: "personal", default: true },
];

describe("validateTag", () => {
	test("passes for a new unique value", () => {
		expect(validateTag("travel", existing)).toEqual([]);
	});

	test("fails when value is empty", () => {
		expect(validateTag("", existing)).toContain("Tag is required");
	});

	test("fails when value is whitespace only", () => {
		expect(validateTag("   ", existing)).toContain("Tag is required");
	});

	test("fails when value duplicates another tag", () => {
		expect(validateTag("business", existing)).toContain(
			'Tag "business" already exists',
		);
	});

	test("allows the same value when editing that tag (originalValue match)", () => {
		expect(validateTag("business", existing, "business")).toEqual([]);
	});

	test("still rejects renaming onto another tag", () => {
		expect(validateTag("personal", existing, "business")).toContain(
			'Tag "personal" already exists',
		);
	});
});
