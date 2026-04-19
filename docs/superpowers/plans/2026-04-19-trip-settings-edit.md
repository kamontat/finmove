# Trip Settings Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit all trip settings (name, dates, countries, currencies, categories, tags, export path) after trip creation.

**Architecture:** One new core service (`updateSettings`) for writing settings back to YAML. Five new TUI screens: a settings hub with a Form for simple fields plus navigation to four list-management sub-screens (countries, categories, tags, currencies). Routes and TripMenu updated to wire it all together.

**Tech Stack:** Bun, TypeScript, React + Ink, yaml (parse/stringify)

---

### Task 1: Core service — `updateSettings`

**Files:**
- Create: `src/core/services/trip/updateSettings.ts`
- Create: `src/core/services/trip/__tests__/updateSettings.test.ts`
- Modify: `src/core/services/trip/index.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/core/services/trip/__tests__/updateSettings.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Settings } from "../../../models";
import { loadTrip } from "../loadTrip";
import { updateSettings } from "../updateSettings";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

const sampleSettings: Settings = {
	name: "Test Trip",
	startDate: "2026-05-01",
	endDate: "2026-05-07",
	countries: ["Japan"],
	baseCurrency: "THB",
	currencies: { JPY: { exchangeRate: 0.23 } },
	categories: ["Flight", "Hotels"],
	tags: ["test"],
	exportPath: "./expenses.csv",
};

function createFixture(): string {
	const tripDir = join(TEST_DIR, "test-trip");
	mkdirSync(tripDir, { recursive: true });
	writeFileSync(join(tripDir, "settings.yaml"), stringify(sampleSettings));
	writeFileSync(join(tripDir, "owners.yaml"), stringify({ owners: [] }));
	writeFileSync(join(tripDir, "accounts.yaml"), stringify({ accounts: [] }));
	writeFileSync(join(tripDir, "expenses.yaml"), stringify({ expenses: [] }));
	return tripDir;
}

beforeEach(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("updateSettings", () => {
	test("updates simple fields", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { name: "Updated Trip" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.name).toBe("Updated Trip");
		expect(trip.settings.startDate).toBe("2026-05-01"); // unchanged
	});

	test("updates array fields", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { countries: ["Japan", "Korea"] });

		const trip = loadTrip(tripDir);
		expect(trip.settings.countries).toEqual(["Japan", "Korea"]);
	});

	test("updates currencies map", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, {
			currencies: {
				JPY: { exchangeRate: 0.25 },
				USD: { exchangeRate: 35.0 },
			},
		});

		const trip = loadTrip(tripDir);
		expect(trip.settings.currencies).toEqual({
			JPY: { exchangeRate: 0.25 },
			USD: { exchangeRate: 35.0 },
		});
	});

	test("does not modify baseCurrency", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { baseCurrency: "THB" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.baseCurrency).toBe("THB");
	});

	test("preserves fields not included in updates", () => {
		const tripDir = createFixture();
		updateSettings(tripDir, { name: "New Name" });

		const trip = loadTrip(tripDir);
		expect(trip.settings.tags).toEqual(["test"]);
		expect(trip.settings.categories).toEqual(["Flight", "Hotels"]);
		expect(trip.settings.currencies).toEqual({
			JPY: { exchangeRate: 0.23 },
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/services/trip/__tests__/updateSettings.test.ts`
Expected: FAIL — `updateSettings` not found.

- [ ] **Step 3: Implement updateSettings**

```typescript
// src/core/services/trip/updateSettings.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Settings } from "../../models";

export function updateSettings(
	tripPath: string,
	updates: Partial<Settings>,
): void {
	const filePath = join(tripPath, "settings.yaml");
	const current: Settings = parse(readFileSync(filePath, "utf-8"));
	const { baseCurrency: _, ...safeUpdates } = updates;
	const merged: Settings = { ...current, ...safeUpdates };
	writeFileSync(filePath, stringify(merged));
}
```

- [ ] **Step 4: Export from barrel**

Add to `src/core/services/trip/index.ts`:

```typescript
export { updateSettings } from "./updateSettings";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/core/services/trip/__tests__/updateSettings.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `bun test`
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/services/trip/updateSettings.ts src/core/services/trip/__tests__/updateSettings.test.ts src/core/services/trip/index.ts
git commit -m "feat: add updateSettings service for trip settings editing"
```

---

### Task 2: Add route paths to TUI models

**Files:**
- Modify: `src/tui/models/index.ts`

- [ ] **Step 1: Add new route paths to the RoutePath union**

In `src/tui/models/index.ts`, update the `RoutePath` type to include the 5 new routes:

```typescript
export type RoutePath =
	| "/trips"
	| "/trips/menu"
	| "/trips/owners"
	| "/trips/accounts"
	| "/trips/expenses"
	| "/trips/expenses/form"
	| "/trips/export"
	| "/trips/settings"
	| "/trips/settings/countries"
	| "/trips/settings/categories"
	| "/trips/settings/tags"
	| "/trips/settings/currencies";
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS (no type errors — new paths are additive).

- [ ] **Step 3: Commit**

```bash
git add src/tui/models/index.ts
git commit -m "feat: add settings route paths to RoutePath union"
```

---

### Task 3: TripSettings screen

**Files:**
- Create: `src/tui/screens/TripSettings.tsx`

- [ ] **Step 1: Create the TripSettings screen**

```tsx
// src/tui/screens/TripSettings.tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "view" | "edit";

export function TripSettings(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goTo, goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("view");

	useEffect(() => {
		setTitleSuffix("Settings");

		if (!trip) return;

		if (mode === "edit") {
			setMenu([], () => {});
			setHints([
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Edit field" },
				{ key: "s", label: "Submit" },
				{ key: "q", label: "Back" },
				{ key: "esc", label: "Exit" },
			]);
			return;
		}

		setMenu(
			[
				{ label: "Edit", value: "edit", key: "e" },
				{ label: "Countries", value: "countries", key: "c" },
				{ label: "Categories", value: "categories", key: "g" },
				{ label: "Tags", value: "tags", key: "t" },
				{ label: "Currencies", value: "currencies", key: "r" },
			],
			(value) => {
				const tripDirPath = trip.dirPath;
				if (value === "edit") {
					setMode("edit");
					setFocus("main");
				} else if (value === "countries") {
					goTo("/trips/settings/countries", { props: { tripDirPath } });
				} else if (value === "categories") {
					goTo("/trips/settings/categories", { props: { tripDirPath } });
				} else if (value === "tags") {
					goTo("/trips/settings/tags", { props: { tripDirPath } });
				} else if (value === "currencies") {
					goTo("/trips/settings/currencies", { props: { tripDirPath } });
				}
			},
		);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [trip, mode, setMenu, setHints, setFocus, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { settings } = trip;

	if (mode === "edit") {
		const fields: FormFieldConfig[] = [
			{
				key: "name",
				label: "Name",
				type: "text",
				required: true,
				defaultValue: settings.name,
			},
			{
				key: "startDate",
				label: "Start Date",
				type: "date",
				required: true,
				defaultValue: settings.startDate,
			},
			{
				key: "endDate",
				label: "End Date",
				type: "date",
				required: true,
				defaultValue: settings.endDate,
			},
			{
				key: "exportPath",
				label: "Export Path",
				type: "text",
				defaultValue: settings.exportPath,
			},
		];

		return (
			<Form
				fields={fields}
				onSubmit={(values) => {
					updateSettings(trip.dirPath, {
						name: values["name"] ?? settings.name,
						startDate: values["startDate"] ?? settings.startDate,
						endDate: values["endDate"] ?? settings.endDate,
						exportPath: values["exportPath"] ?? settings.exportPath,
					});
					reloadTrip();
					setMode("view");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("view");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Box flexDirection="column">
				<Text>
					<Text bold>Name: </Text>
					<Text>{settings.name}</Text>
				</Text>
				<Text>
					<Text bold>Dates: </Text>
					<Text>
						{settings.startDate} — {settings.endDate}
					</Text>
				</Text>
				<Text>
					<Text bold>Export: </Text>
					<Text>{settings.exportPath}</Text>
				</Text>
			</Box>
			<Box flexDirection="column">
				<Text>
					<Text bold>Countries: </Text>
					<Text>{settings.countries.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Categories: </Text>
					<Text>{settings.categories.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Tags: </Text>
					<Text>{settings.tags.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Currencies: </Text>
					<Text>
						{Object.entries(settings.currencies)
							.map(([code, config]) => `${code} (${config.exchangeRate})`)
							.join(", ") || "—"}
					</Text>
				</Text>
			</Box>
		</Box>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripSettings.tsx
git commit -m "feat: add TripSettings screen with view and edit modes"
```

---

### Task 4: String list management screen — TripSettingsCountries

**Files:**
- Create: `src/tui/screens/TripSettingsCountries.tsx`

- [ ] **Step 1: Create the TripSettingsCountries screen**

```tsx
// src/tui/screens/TripSettingsCountries.tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Country",
		type: "text",
		required: true,
		placeholder: "e.g. Japan",
	},
];

export function TripSettingsCountries(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		setTitleSuffix("Settings > Countries");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q", label: "Back" },
					{ key: "esc", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q", label: "Back to list" },
					{ key: "esc", label: "Exit" },
				]);
			}
			return;
		}

		const hasItems = trip.settings.countries.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "delete" && hasItems) {
					setMode("select-for-remove");
					setFocus("input");
				}
			},
		);
		setBorderColor(null);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [
		trip,
		mode,
		setMenu,
		setHints,
		setFocus,
		setBorderColor,
		setTitleSuffix,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { countries } = trip.settings;

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const value = values["value"]?.trim();
					if (value) {
						updateSettings(trip.dirPath, {
							countries: [...countries, value],
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("list");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	if (mode === "select-for-remove") {
		if (countries.length === 0) {
			return <Text dimColor>No countries.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a country to remove:
				</Text>
				<VerticalSelect
					options={countries.map((c) => ({ label: c, value: c }))}
					onChange={(value) => {
						updateSettings(trip.dirPath, {
							countries: countries.filter((c) => c !== value),
						});
						reloadTrip();
						const remaining = countries.filter((c) => c !== value);
						if (remaining.length === 0) {
							setMode("list");
							setBorderColor(null);
							setFocus("menu");
						}
					}}
					onCancel={() => {
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					}}
					onEscape={goExit}
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{countries.map((c) => (
				<Text key={c}>• {c}</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripSettingsCountries.tsx
git commit -m "feat: add TripSettingsCountries list management screen"
```

---

### Task 5: String list management screen — TripSettingsCategories

**Files:**
- Create: `src/tui/screens/TripSettingsCategories.tsx`

- [ ] **Step 1: Create the TripSettingsCategories screen**

```tsx
// src/tui/screens/TripSettingsCategories.tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Category",
		type: "text",
		required: true,
		placeholder: "e.g. Flight",
	},
];

export function TripSettingsCategories(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		setTitleSuffix("Settings > Categories");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q", label: "Back" },
					{ key: "esc", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q", label: "Back to list" },
					{ key: "esc", label: "Exit" },
				]);
			}
			return;
		}

		const hasItems = trip.settings.categories.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "delete" && hasItems) {
					setMode("select-for-remove");
					setFocus("input");
				}
			},
		);
		setBorderColor(null);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [
		trip,
		mode,
		setMenu,
		setHints,
		setFocus,
		setBorderColor,
		setTitleSuffix,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const value = values["value"]?.trim();
					if (value) {
						updateSettings(trip.dirPath, {
							categories: [...categories, value],
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("list");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	if (mode === "select-for-remove") {
		if (categories.length === 0) {
			return <Text dimColor>No categories.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a category to remove:
				</Text>
				<VerticalSelect
					options={categories.map((c) => ({ label: c, value: c }))}
					onChange={(value) => {
						updateSettings(trip.dirPath, {
							categories: categories.filter((c) => c !== value),
						});
						reloadTrip();
						const remaining = categories.filter((c) => c !== value);
						if (remaining.length === 0) {
							setMode("list");
							setBorderColor(null);
							setFocus("menu");
						}
					}}
					onCancel={() => {
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					}}
					onEscape={goExit}
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (categories.length === 0) {
		return <Text dimColor>No categories yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{categories.map((c) => (
				<Text key={c}>• {c}</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripSettingsCategories.tsx
git commit -m "feat: add TripSettingsCategories list management screen"
```

---

### Task 6: String list management screen — TripSettingsTags

**Files:**
- Create: `src/tui/screens/TripSettingsTags.tsx`

- [ ] **Step 1: Create the TripSettingsTags screen**

```tsx
// src/tui/screens/TripSettingsTags.tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Tag",
		type: "text",
		required: true,
		placeholder: "e.g. business",
	},
];

export function TripSettingsTags(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		setTitleSuffix("Settings > Tags");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q", label: "Back" },
					{ key: "esc", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q", label: "Back to list" },
					{ key: "esc", label: "Exit" },
				]);
			}
			return;
		}

		const hasItems = trip.settings.tags.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "delete" && hasItems) {
					setMode("select-for-remove");
					setFocus("input");
				}
			},
		);
		setBorderColor(null);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [
		trip,
		mode,
		setMenu,
		setHints,
		setFocus,
		setBorderColor,
		setTitleSuffix,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const value = values["value"]?.trim();
					if (value) {
						updateSettings(trip.dirPath, {
							tags: [...tags, value],
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("list");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	if (mode === "select-for-remove") {
		if (tags.length === 0) {
			return <Text dimColor>No tags.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a tag to remove:
				</Text>
				<VerticalSelect
					options={tags.map((t) => ({ label: t, value: t }))}
					onChange={(value) => {
						updateSettings(trip.dirPath, {
							tags: tags.filter((t) => t !== value),
						});
						reloadTrip();
						const remaining = tags.filter((t) => t !== value);
						if (remaining.length === 0) {
							setMode("list");
							setBorderColor(null);
							setFocus("menu");
						}
					}}
					onCancel={() => {
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					}}
					onEscape={goExit}
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{tags.map((t) => (
				<Text key={t}>• {t}</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripSettingsTags.tsx
git commit -m "feat: add TripSettingsTags list management screen"
```

---

### Task 7: Currencies management screen — TripSettingsCurrencies

**Files:**
- Create: `src/tui/screens/TripSettingsCurrencies.tsx`

- [ ] **Step 1: Create the TripSettingsCurrencies screen**

```tsx
// src/tui/screens/TripSettingsCurrencies.tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "edit" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "code",
		label: "Currency Code",
		type: "text",
		required: true,
		placeholder: "e.g. JPY",
	},
	{
		key: "exchangeRate",
		label: "Exchange Rate (to THB)",
		type: "text",
		required: true,
		placeholder: "e.g. 0.23",
	},
];

export function TripSettingsCurrencies(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [editTarget, setEditTarget] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add" || mode === "edit") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q", label: "Back" },
					{ key: "esc", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q", label: "Back to list" },
					{ key: "esc", label: "Exit" },
				]);
			}
			return;
		}

		const entries = Object.entries(trip.settings.currencies);
		const hasItems = entries.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [
							{ label: "Edit", value: "edit", key: "e" },
							{ label: "Delete", value: "delete", key: "d" },
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "edit" && hasItems) {
					setMode("edit");
					setFocus("input");
				} else if (value === "delete" && hasItems) {
					setMode("select-for-remove");
					setFocus("input");
				}
			},
		);
		setBorderColor(null);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [
		trip,
		mode,
		setMenu,
		setHints,
		setFocus,
		setBorderColor,
		setTitleSuffix,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const code = values["code"]?.trim().toUpperCase();
					const rate = Number.parseFloat(values["exchangeRate"] ?? "");
					if (code && !Number.isNaN(rate)) {
						const updated: Record<string, CurrencyConfig> = {
							...currencies,
							[code]: { exchangeRate: rate },
						};
						updateSettings(trip.dirPath, { currencies: updated });
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("list");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	if (mode === "edit") {
		if (editTarget) {
			const currentRate = currencies[editTarget]?.exchangeRate ?? 0;
			const editFields: FormFieldConfig[] = [
				{
					key: "exchangeRate",
					label: `Exchange Rate for ${editTarget}`,
					type: "text",
					required: true,
					defaultValue: String(currentRate),
				},
			];
			return (
				<Form
					fields={editFields}
					onSubmit={(values) => {
						const rate = Number.parseFloat(
							values["exchangeRate"] ?? "",
						);
						if (!Number.isNaN(rate)) {
							const updated: Record<string, CurrencyConfig> = {
								...currencies,
								[editTarget]: { exchangeRate: rate },
							};
							updateSettings(trip.dirPath, {
								currencies: updated,
							});
							reloadTrip();
						}
						setEditTarget(null);
						setMode("list");
						setFocus("menu");
					}}
					onCancel={() => {
						setEditTarget(null);
						setMode("list");
						setFocus("menu");
					}}
					onEscape={goExit}
				/>
			);
		}

		// Select which currency to edit
		return (
			<Box flexDirection="column">
				<Text bold>Select a currency to edit:</Text>
				<VerticalSelect
					options={entries.map(([code, config]) => ({
						label: code,
						value: code,
						detail: `rate: ${config.exchangeRate}`,
					}))}
					onChange={(value) => {
						setEditTarget(value);
						setFocus("main");
					}}
					onCancel={() => {
						setMode("list");
						setFocus("menu");
					}}
					onEscape={goExit}
					isActive
				/>
			</Box>
		);
	}

	if (mode === "select-for-remove") {
		if (entries.length === 0) {
			return <Text dimColor>No currencies.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a currency to remove:
				</Text>
				<VerticalSelect
					options={entries.map(([code, config]) => ({
						label: code,
						value: code,
						detail: `rate: ${config.exchangeRate}`,
					}))}
					onChange={(value) => {
						const { [value]: _, ...rest } = currencies;
						updateSettings(trip.dirPath, { currencies: rest });
						reloadTrip();
						if (Object.keys(rest).length === 0) {
							setMode("list");
							setBorderColor(null);
							setFocus("menu");
						}
					}}
					onCancel={() => {
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					}}
					onEscape={goExit}
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (entries.length === 0) {
		return <Text dimColor>No currencies yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{entries.map(([code, config]) => (
				<Text key={code}>
					• {code} — {config.exchangeRate}
				</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 2: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tui/screens/TripSettingsCurrencies.tsx
git commit -m "feat: add TripSettingsCurrencies management screen"
```

---

### Task 8: Wire up routes and TripMenu

**Files:**
- Modify: `src/tui/router.ts`
- Modify: `src/tui/screens/TripMenu.tsx`

- [ ] **Step 1: Update router.ts with new routes**

Add imports and route entries to `src/tui/router.ts`:

```typescript
// Add these imports alongside existing screen imports:
import { TripSettings } from "./screens/TripSettings";
import { TripSettingsCategories } from "./screens/TripSettingsCategories";
import { TripSettingsCountries } from "./screens/TripSettingsCountries";
import { TripSettingsCurrencies } from "./screens/TripSettingsCurrencies";
import { TripSettingsTags } from "./screens/TripSettingsTags";
```

Add these entries inside the `routes` record:

```typescript
	"/trips/settings": {
		component: TripSettings as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Settings",
		defaultFocus: "menu",
	},
	"/trips/settings/countries": {
		component: TripSettingsCountries as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Countries",
		defaultFocus: "menu",
	},
	"/trips/settings/categories": {
		component: TripSettingsCategories as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Categories",
		defaultFocus: "menu",
	},
	"/trips/settings/tags": {
		component: TripSettingsTags as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Tags",
		defaultFocus: "menu",
	},
	"/trips/settings/currencies": {
		component: TripSettingsCurrencies as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Currencies",
		defaultFocus: "menu",
	},
```

- [ ] **Step 2: Update TripMenu.tsx — add Settings menu item**

In `src/tui/screens/TripMenu.tsx`, add the Settings entry to the menu array and its handler:

Add to the menu options array (after the Export CSV entry):
```typescript
{ label: "Settings", value: "settings", key: "s" },
```

Add to the handler chain (after the export handler):
```typescript
} else if (value === "settings") {
	goTo("/trips/settings", { props: { tripDirPath } });
}
```

- [ ] **Step 3: Type check**

Run: `bun run check:type`
Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 5: Lint check**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/router.ts src/tui/screens/TripMenu.tsx
git commit -m "feat: wire up settings routes and add Settings to TripMenu"
```

---

### Task 9: Manual testing and fix-up

- [ ] **Step 1: Start the app**

Run: `bun run start`

- [ ] **Step 2: Test the settings flow**

1. Select or create a trip
2. From TripMenu, press `[s]` to navigate to Settings
3. Verify the view mode shows current settings values
4. Press `[e]` to enter edit mode — change the trip name and a date
5. Submit with `[s]` — verify changes persist (press `[q]` back to menu, then `[s]` again to see updated values)
6. Navigate to Countries — add a country, delete a country
7. Navigate to Categories — add and delete
8. Navigate to Tags — add and delete
9. Navigate to Currencies — add a new currency with rate, edit a rate, delete a currency
10. Verify `[q]` returns correctly at each level

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final lint and type check**

Run: `bun run check:type && bun run check`
Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish trip settings screens after manual testing"
```
