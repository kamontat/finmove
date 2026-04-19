import { describe, expect, test } from "bun:test";
import { parseArgs } from "../parseArgs";

describe("parseArgs", () => {
	test("returns defaults when no args", () => {
		const result = parseArgs([]);
		expect(result).toEqual({
			dataDir: "./data",
			trip: undefined,
			page: undefined,
		});
	});

	test("parses --data-dir", () => {
		const result = parseArgs(["--data-dir", "/custom/path"]);
		expect(result.dataDir).toBe("/custom/path");
	});

	test("parses --trip", () => {
		const result = parseArgs(["--trip", "japan-2026"]);
		expect(result.trip).toBe("japan-2026");
	});

	test("parses --page", () => {
		const result = parseArgs(["--trip", "japan", "--page", "expenses"]);
		expect(result.page).toBe("expenses");
	});

	test("parses all flags together", () => {
		const result = parseArgs([
			"--data-dir",
			"/data",
			"--trip",
			"korea",
			"--page",
			"accounts",
		]);
		expect(result).toEqual({
			dataDir: "/data",
			trip: "korea",
			page: "accounts",
		});
	});
});
