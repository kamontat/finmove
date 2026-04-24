# Screen-per-Mode Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split seven list screens' local `Mode` state machines into per-route screens with props. Keep select-for-X (remove/delete/duplicate) on the list page itself, driven by a `selectMode` route prop. Extract duplicated UI into `RemoveSelector`, `constants/hints`, and `core/services/slug`.

**Architecture:** Each old list screen becomes 3 files — `XList.tsx` (browse + select modes), `XCreate.tsx` (add form route), `XEdit.tsx` (edit form route). Navigation replaces local `setMode` calls. Shared UI is extracted first; router infra is updated next; then screens are refactored one family at a time.

**Tech Stack:** TypeScript, Bun, React, Ink. Test runner: `bun:test`. Lint/format: Biome. No TUI unit tests — manual smoke test via `bun run start --data-dir <tmp>`.

**Reference spec:** `docs/superpowers/specs/2026-04-24-screen-per-mode-refactor-design.md`

---

## Pre-flight

- [ ] **Step P.1: Verify baseline is green**

Run from repo root:
```bash
bun run check:type && bun run check && bun test
```
Expected: typecheck passes, Biome reports no issues, all tests pass.

---

## Task 1: `slug` service (TDD)

Extracts `toSlug` / `uniqueSlug` from `OwnerList.tsx` and `AccountList.tsx` into a shared pure-function core service.

**Files:**
- Create: `src/core/services/slug/toSlug.ts`
- Create: `src/core/services/slug/uniqueSlug.ts`
- Create: `src/core/services/slug/index.ts`
- Create: `src/core/services/slug/__tests__/slug.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `src/core/services/slug/__tests__/slug.test.ts`:

```ts
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
```

- [ ] **Step 1.2: Run tests — expect failure**

```bash
bun test src/core/services/slug/
```
Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement `toSlug`**

Create `src/core/services/slug/toSlug.ts`:

```ts
export function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
```

- [ ] **Step 1.4: Implement `uniqueSlug`**

Create `src/core/services/slug/uniqueSlug.ts`:

```ts
import { toSlug } from "./toSlug";

export function uniqueSlug(name: string, takenIds: Iterable<string>): string {
	const taken = new Set(takenIds);
	const base = toSlug(name);
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}-${i}`)) i++;
	return `${base}-${i}`;
}
```

- [ ] **Step 1.5: Create the barrel**

Create `src/core/services/slug/index.ts`:

```ts
export { toSlug } from "./toSlug";
export { uniqueSlug } from "./uniqueSlug";
```

- [ ] **Step 1.6: Run tests — expect pass**

```bash
bun test src/core/services/slug/
```
Expected: all tests pass.

- [ ] **Step 1.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 1.8: Commit**

```bash
git add src/core/services/slug
git commit -m "feat(core): add shared slug service"
```

---

## Task 2: Hint preset constants

Extracts the three repeated `HelpHint[]` arrays into a constants module so screens can import them instead of inlining.

**Files:**
- Create: `src/tui/constants/hints.ts`

- [ ] **Step 2.1: Create the constants file**

Create `src/tui/constants/hints.ts`:

```ts
import type { HelpHint } from "../models";

export const LIST_HINTS: HelpHint[] = [
	{ key: "tab", label: "Switch focus" },
	{ key: "←→", label: "Navigate menu" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Back" },
	{ key: "e", label: "Exit" },
];

export const FORM_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Edit field" },
	{ key: "q/esc", label: "Back" },
	{ key: "e", label: "Exit" },
];

export const SELECT_REMOVE_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Remove selected" },
	{ key: "q/esc", label: "Back to list" },
	{ key: "e", label: "Exit" },
];
```

- [ ] **Step 2.2: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 2.3: Commit**

```bash
git add src/tui/constants
git commit -m "feat(tui): add shared hint preset constants"
```

---

## Task 3: `RemoveSelector` molecule

Reusable red-bordered "select item to remove" component. Replaces 7 near-identical inline copies across the list screens (applied in later tasks).

**Files:**
- Create: `src/tui/components/molecules/RemoveSelector.tsx`

- [ ] **Step 3.1: Create the molecule**

Create `src/tui/components/molecules/RemoveSelector.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface RemoveSelectorProps {
	header: string;
	options: VerticalOption[];
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function RemoveSelector({
	header,
	options,
	onConfirm,
	onCancel,
}: RemoveSelectorProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<Text bold color="red">
				{header}
			</Text>
			<VerticalSelect
				options={options}
				onChange={onConfirm}
				onCancel={onCancel}
				color="red"
				isActive
			/>
		</Box>
	);
}
```

- [ ] **Step 3.2: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 3.3: Commit**

```bash
git add src/tui/components/molecules/RemoveSelector.tsx
git commit -m "feat(tui): add RemoveSelector molecule"
```

---

## Task 4: Router infra — rename `/trips/menu` → `/trips/overview` and extend `RoutePath`

Renames the existing menu route/screen. Adds all new routes to `RoutePath` up-front so subsequent tasks only need to wire them into `routes` when the screens exist.

**Files:**
- Rename: `src/tui/screens/TripMenu.tsx` → `src/tui/screens/TripOverview.tsx`
- Modify: `src/tui/models/index.ts`
- Modify: `src/tui/router.ts`
- Modify: `src/tui/App.tsx`
- Modify: `src/tui/screens/TripSettings.tsx` (no callers reference `/trips/menu` except it's the initial route; verify)

- [ ] **Step 4.1: Rename the screen file and update its export name**

Move `src/tui/screens/TripMenu.tsx` to `src/tui/screens/TripOverview.tsx` and rename the function:

```bash
git mv src/tui/screens/TripMenu.tsx src/tui/screens/TripOverview.tsx
```

Then edit `src/tui/screens/TripOverview.tsx`. Change the exported function name from `TripMenu` to `TripOverview`:

```tsx
export function TripOverview(): JSX.Element {
```

Leave everything else in the file unchanged.

- [ ] **Step 4.2: Update `RoutePath` union — rename `/trips/menu` → `/trips/overview`**

In `src/tui/models/index.ts`, locate the `RoutePath` union. Replace only the `/trips/menu` entry with `/trips/overview`. Leave all other entries unchanged.

Subsequent tasks (5–11) add their own `/new` and `/edit` entries to the union as they create those screens, so the union and the `routes` record stay in lockstep.

- [ ] **Step 4.3: Update the router — rename entry and register the placeholder for new routes**

Open `src/tui/router.ts`. Replace the import line for `TripMenu` with one for `TripOverview`:

```ts
import { TripOverview } from "./screens/TripOverview";
```

Remove the old `import { TripMenu } from "./screens/TripMenu";` line.

Rename the `/trips/menu` entry to `/trips/overview` and update the component reference:

```ts
"/trips/overview": {
	component: TripOverview as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Trip Overview",
	defaultFocus: "menu",
},
```

(We do **not** register the other new routes in this task — they'd reference screen files that don't yet exist. Later tasks register them as they create the screens.)

- [ ] **Step 4.4: Update initial-route resolution in App.tsx**

In `src/tui/App.tsx`, change the fallback return in `resolveInitialRoute` from `/trips/menu` to `/trips/overview`:

```ts
return { path: "/trips/overview", props };
```

- [ ] **Step 4.5: Update breadcrumb logic in App.tsx for new paths**

In `src/tui/App.tsx`, extend the `Router` component's breadcrumb `if/else` chain to handle the new paths. Replace the existing breadcrumb block with:

```ts
if (path === "/trips") {
	breadcrumbs.push("Trips");
} else if (path === "/trips/new") {
	breadcrumbs.push("Trips", "New");
} else if (path === "/trips/duplicate") {
	breadcrumbs.push("Trips", "Duplicate");
} else {
	breadcrumbs.push("Trips");
	if (trip) {
		breadcrumbs.push(trip.settings.name);
	}
	if (path === "/trips/owners") breadcrumbs.push("Owners");
	else if (path === "/trips/owners/new") breadcrumbs.push("Owners", "New");
	else if (path === "/trips/owners/edit") breadcrumbs.push("Owners", "Edit");
	else if (path === "/trips/accounts") breadcrumbs.push("Accounts");
	else if (path === "/trips/accounts/new")
		breadcrumbs.push("Accounts", "New");
	else if (path === "/trips/accounts/edit")
		breadcrumbs.push("Accounts", "Edit");
	else if (path === "/trips/expenses") breadcrumbs.push("Expenses");
	else if (path === "/trips/expenses/form")
		breadcrumbs.push("Expenses", expenseFormLabel(currentRoute.props));
}
```

(Settings sub-page breadcrumbs continue to come from each screen's `setTitleSuffix` — we leave that pattern in place.)

- [ ] **Step 4.6: Check no dangling references to `/trips/menu`**

```bash
grep -rn "/trips/menu\|TripMenu" src/
```
Expected: no matches.

- [ ] **Step 4.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean. Because `RoutePath` only changed from `/trips/menu` → `/trips/overview` and the `routes` record was updated in lockstep, the strict `Record<RoutePath, RouteConfig>` type still holds.

- [ ] **Step 4.8: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t4
```
Create a trip, open it — verify the Trip Overview page (formerly "Trip Menu") renders, title reads "Trips > <name>". Exit with `[e]`.

- [ ] **Step 4.9: Commit**

```bash
git add src/tui src/tui/App.tsx src/tui/router.ts src/tui/models/index.ts
git commit -m "refactor(tui): rename /trips/menu route and screen to /trips/overview"
```

---

## Task 5: Split Tags settings screen

`TripSettingsTags.tsx` (153 lines, 3 modes) becomes `TagList.tsx` + `TagCreate.tsx` + `TagEdit.tsx`, with three routes.

**Files:**
- Create: `src/tui/screens/TagList.tsx`
- Create: `src/tui/screens/TagCreate.tsx`
- Create: `src/tui/screens/TagEdit.tsx`
- Delete: `src/tui/screens/TripSettingsTags.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 5.1: Create `TagList.tsx`**

Create `src/tui/screens/TagList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function TagList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Tags");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.tags.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/tags/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/tags", {
						props: { tripDirPath, tripName, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (selectMode === "remove") {
		if (tags.length === 0) {
			return <Text dimColor>No tags.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a tag to remove:"
				options={tags.map((t) => ({ label: t, value: t }))}
				onConfirm={(value) => {
					const remaining = tags.filter((t) => t !== value);
					updateSettings(trip.dirPath, { tags: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<VerticalSelect
			options={tags.map((t) => ({ label: t, value: t }))}
			onChange={(value) => {
				goTo("/trips/settings/tags/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 5.2: Create `TagCreate.tsx`**

Create `src/tui/screens/TagCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Tag",
		type: "text",
		required: true,
		placeholder: "e.g. business",
	},
];

export function TagCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = values["value"]?.trim();
				if (value) {
					updateSettings(trip.dirPath, {
						tags: [...trip.settings.tags, value],
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 5.3: Create `TagEdit.tsx`**

Create `src/tui/screens/TagEdit.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TagEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const originalValue = currentRoute.props["value"] as string;

	useEffect(() => {
		setTitleSuffix(`Settings > Tags > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Tag",
			type: "text",
			required: true,
			defaultValue: originalValue,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = values["value"]?.trim();
				if (next) {
					updateSettings(trip.dirPath, {
						tags: trip.settings.tags.map((t) =>
							t === originalValue ? next : t,
						),
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 5.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries to the `RoutePath` union next to `"/trips/settings/tags"`:

```ts
| "/trips/settings/tags/new"
| "/trips/settings/tags/edit"
```

- [ ] **Step 5.5: Wire routes in `src/tui/router.ts`**

Add imports near the top:
```ts
import { TagCreate } from "./screens/TagCreate";
import { TagEdit } from "./screens/TagEdit";
import { TagList } from "./screens/TagList";
```

Remove the old import: `import { TripSettingsTags } from "./screens/TripSettingsTags";`

Replace the existing `"/trips/settings/tags"` entry and add two new entries:
```ts
"/trips/settings/tags": {
	component: TagList as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Tags",
	defaultFocus: "menu",
},
"/trips/settings/tags/new": {
	component: TagCreate as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Tag",
	defaultFocus: "main",
},
"/trips/settings/tags/edit": {
	component: TagEdit as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Tag",
	defaultFocus: "main",
},
```

- [ ] **Step 5.6: Delete the old file**

```bash
git rm src/tui/screens/TripSettingsTags.tsx
```

- [ ] **Step 5.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 5.8: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t5
```
- Create a trip → open → Settings → Tags
- Press `[a]` → enter "business" → `[s]` submit → returns to list; "business" visible.
- Click "business" row → edit form appears with value prefilled; type new "biz" → `[s]` → returns to list; "biz" visible.
- Press `[d]` → list shows in red border → pick "biz" → removed; list now empty → auto-back to Settings.
- Press `[q]` repeatedly to exit.

- [ ] **Step 5.9: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split tags settings screen into list/create/edit routes"
```

---

## Task 6: Split Countries settings screen

Same shape as Task 5. `TripSettingsCountries.tsx` → `CountryList.tsx` + `CountryCreate.tsx` + `CountryEdit.tsx`.

**Files:**
- Create: `src/tui/screens/CountryList.tsx`
- Create: `src/tui/screens/CountryCreate.tsx`
- Create: `src/tui/screens/CountryEdit.tsx`
- Delete: `src/tui/screens/TripSettingsCountries.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 6.1: Create `CountryList.tsx`**

Create `src/tui/screens/CountryList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function CountryList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Countries");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.countries.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/countries/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/countries", {
						props: { tripDirPath, tripName, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { countries } = trip.settings;

	if (selectMode === "remove") {
		if (countries.length === 0) {
			return <Text dimColor>No countries.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a country to remove:"
				options={countries.map((c) => ({ label: c, value: c }))}
				onConfirm={(value) => {
					const remaining = countries.filter((c) => c !== value);
					updateSettings(trip.dirPath, { countries: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet.</Text>;
	}

	return (
		<VerticalSelect
			options={countries.map((c) => ({ label: c, value: c }))}
			onChange={(value) => {
				goTo("/trips/settings/countries/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 6.2: Create `CountryCreate.tsx`**

Create `src/tui/screens/CountryCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Country",
		type: "text",
		required: true,
		placeholder: "e.g. Japan",
	},
];

export function CountryCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Countries > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = values["value"]?.trim();
				if (value) {
					updateSettings(trip.dirPath, {
						countries: [...trip.settings.countries, value],
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 6.3: Create `CountryEdit.tsx`**

Create `src/tui/screens/CountryEdit.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CountryEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const originalValue = currentRoute.props["value"] as string;

	useEffect(() => {
		setTitleSuffix(`Settings > Countries > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Country",
			type: "text",
			required: true,
			defaultValue: originalValue,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = values["value"]?.trim();
				if (next) {
					updateSettings(trip.dirPath, {
						countries: trip.settings.countries.map((c) =>
							c === originalValue ? next : c,
						),
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 6.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips/settings/countries"`:

```ts
| "/trips/settings/countries/new"
| "/trips/settings/countries/edit"
```

- [ ] **Step 6.5: Wire routes in `src/tui/router.ts`**

Remove: `import { TripSettingsCountries } from "./screens/TripSettingsCountries";`

Add:
```ts
import { CountryCreate } from "./screens/CountryCreate";
import { CountryEdit } from "./screens/CountryEdit";
import { CountryList } from "./screens/CountryList";
```

Replace `"/trips/settings/countries"` and add two new entries:
```ts
"/trips/settings/countries": {
	component: CountryList as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Countries",
	defaultFocus: "menu",
},
"/trips/settings/countries/new": {
	component: CountryCreate as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Country",
	defaultFocus: "main",
},
"/trips/settings/countries/edit": {
	component: CountryEdit as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Country",
	defaultFocus: "main",
},
```

- [ ] **Step 6.6: Delete the old file**

```bash
git rm src/tui/screens/TripSettingsCountries.tsx
```

- [ ] **Step 6.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 6.8: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t6
```
Verify the same flows as Task 5 but for Countries: add, click-to-edit, delete-until-empty.

- [ ] **Step 6.9: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split countries settings screen into list/create/edit routes"
```

---

## Task 7: Split Categories settings screen

Same shape as Task 5 and 6. `TripSettingsCategories.tsx` → `CategoryList.tsx` + `CategoryCreate.tsx` + `CategoryEdit.tsx`.

**Files:**
- Create: `src/tui/screens/CategoryList.tsx`
- Create: `src/tui/screens/CategoryCreate.tsx`
- Create: `src/tui/screens/CategoryEdit.tsx`
- Delete: `src/tui/screens/TripSettingsCategories.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 7.1: Create `CategoryList.tsx`**

Create `src/tui/screens/CategoryList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function CategoryList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Categories");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.categories.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/categories/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/categories", {
						props: { tripDirPath, tripName, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (selectMode === "remove") {
		if (categories.length === 0) {
			return <Text dimColor>No categories.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a category to remove:"
				options={categories.map((c) => ({ label: c, value: c }))}
				onConfirm={(value) => {
					const remaining = categories.filter((c) => c !== value);
					updateSettings(trip.dirPath, { categories: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (categories.length === 0) {
		return <Text dimColor>No categories yet.</Text>;
	}

	return (
		<VerticalSelect
			options={categories.map((c) => ({ label: c, value: c }))}
			onChange={(value) => {
				goTo("/trips/settings/categories/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 7.2: Create `CategoryCreate.tsx`**

Create `src/tui/screens/CategoryCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Category",
		type: "text",
		required: true,
		placeholder: "e.g. Flight",
	},
];

export function CategoryCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Categories > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = values["value"]?.trim();
				if (value) {
					updateSettings(trip.dirPath, {
						categories: [...trip.settings.categories, value],
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 7.3: Create `CategoryEdit.tsx`**

Create `src/tui/screens/CategoryEdit.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CategoryEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const originalValue = currentRoute.props["value"] as string;

	useEffect(() => {
		setTitleSuffix(`Settings > Categories > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Category",
			type: "text",
			required: true,
			defaultValue: originalValue,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = values["value"]?.trim();
				if (next) {
					updateSettings(trip.dirPath, {
						categories: trip.settings.categories.map((c) =>
							c === originalValue ? next : c,
						),
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 7.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips/settings/categories"`:

```ts
| "/trips/settings/categories/new"
| "/trips/settings/categories/edit"
```

- [ ] **Step 7.5: Wire routes in `src/tui/router.ts`**

Remove: `import { TripSettingsCategories } from "./screens/TripSettingsCategories";`

Add:
```ts
import { CategoryCreate } from "./screens/CategoryCreate";
import { CategoryEdit } from "./screens/CategoryEdit";
import { CategoryList } from "./screens/CategoryList";
```

Replace `"/trips/settings/categories"` and add two new entries:
```ts
"/trips/settings/categories": {
	component: CategoryList as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Categories",
	defaultFocus: "menu",
},
"/trips/settings/categories/new": {
	component: CategoryCreate as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Category",
	defaultFocus: "main",
},
"/trips/settings/categories/edit": {
	component: CategoryEdit as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Category",
	defaultFocus: "main",
},
```

- [ ] **Step 7.6: Delete the old file**

```bash
git rm src/tui/screens/TripSettingsCategories.tsx
```

- [ ] **Step 7.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 7.8: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t7
```
Verify Categories: add, click-to-edit, delete-until-empty. The Trip `createTrip` default includes 6 categories — delete them one-by-one to test the red-border selector path.

- [ ] **Step 7.9: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split categories settings screen into list/create/edit routes"
```

---

## Task 8: Split Currencies settings screen

`TripSettingsCurrencies.tsx` (244 lines, 4 modes) → `CurrencyList.tsx` + `CurrencyCreate.tsx` + `CurrencyEdit.tsx`. Slightly more complex than Tags/Countries/Categories because currencies are a record keyed by code, not an array of strings.

**Files:**
- Create: `src/tui/screens/CurrencyList.tsx`
- Create: `src/tui/screens/CurrencyCreate.tsx`
- Create: `src/tui/screens/CurrencyEdit.tsx`
- Delete: `src/tui/screens/TripSettingsCurrencies.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 8.1: Create `CurrencyList.tsx`**

Create `src/tui/screens/CurrencyList.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function CurrencyList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = Object.keys(trip.settings.currencies).length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [{ label: "Delete", value: "delete", key: "d" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/currencies/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/currencies", {
						props: { tripDirPath, tripName, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (selectMode === "remove") {
		if (entries.length === 0) {
			return <Text dimColor>No currencies.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a currency to remove:"
				options={entries.map(([code, config]) => ({
					label: code,
					value: code,
					detail: `rate: ${config.exchangeRate}`,
				}))}
				onConfirm={(value) => {
					const { [value]: _, ...rest } = currencies;
					updateSettings(trip.dirPath, { currencies: rest });
					reloadTrip();
					if (Object.keys(rest).length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (entries.length === 0) {
		return <Text dimColor>No currencies yet.</Text>;
	}

	return (
		<VerticalSelect
			options={entries.map(([code, config]) => ({
				label: code,
				value: code,
				detail: `rate: ${config.exchangeRate}`,
			}))}
			onChange={(code) => {
				goTo("/trips/settings/currencies/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						currencyCode: code,
					},
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 8.2: Create `CurrencyCreate.tsx`**

Create `src/tui/screens/CurrencyCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
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

export function CurrencyCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Currencies > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const code = values["code"]?.trim().toUpperCase();
				const rate = Number.parseFloat(values["exchangeRate"] ?? "");
				if (code && !Number.isNaN(rate)) {
					const updated: Record<string, CurrencyConfig> = {
						...trip.settings.currencies,
						[code]: { exchangeRate: rate },
					};
					updateSettings(trip.dirPath, { currencies: updated });
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 8.3: Create `CurrencyEdit.tsx`**

Create `src/tui/screens/CurrencyEdit.tsx`:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CurrencyEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const code = currentRoute.props["currencyCode"] as string;

	useEffect(() => {
		setTitleSuffix(`Settings > Currencies > ${code}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, code]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const existing = trip.settings.currencies[code];
	if (!existing) {
		return <Text dimColor>Currency "{code}" not found.</Text>;
	}

	const fields: FormFieldConfig[] = [
		{
			key: "exchangeRate",
			label: `Exchange Rate for ${code}`,
			type: "text",
			required: true,
			defaultValue: String(existing.exchangeRate),
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const rate = Number.parseFloat(values["exchangeRate"] ?? "");
				if (!Number.isNaN(rate)) {
					const updated: Record<string, CurrencyConfig> = {
						...trip.settings.currencies,
						[code]: { exchangeRate: rate },
					};
					updateSettings(trip.dirPath, { currencies: updated });
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 8.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips/settings/currencies"`:

```ts
| "/trips/settings/currencies/new"
| "/trips/settings/currencies/edit"
```

- [ ] **Step 8.5: Wire routes in `src/tui/router.ts`**

Remove: `import { TripSettingsCurrencies } from "./screens/TripSettingsCurrencies";`

Add:
```ts
import { CurrencyCreate } from "./screens/CurrencyCreate";
import { CurrencyEdit } from "./screens/CurrencyEdit";
import { CurrencyList } from "./screens/CurrencyList";
```

Replace `"/trips/settings/currencies"` and add two entries:
```ts
"/trips/settings/currencies": {
	component: CurrencyList as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Currencies",
	defaultFocus: "menu",
},
"/trips/settings/currencies/new": {
	component: CurrencyCreate as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Currency",
	defaultFocus: "main",
},
"/trips/settings/currencies/edit": {
	component: CurrencyEdit as unknown as ComponentType,
	title: (props) => (props["tripName"] as string) ?? "Currency",
	defaultFocus: "main",
},
```

- [ ] **Step 8.6: Delete the old file**

```bash
git rm src/tui/screens/TripSettingsCurrencies.tsx
```

- [ ] **Step 8.7: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 8.8: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t8
```
- Settings → Currencies → `[a]` add → code `JPY`, rate `0.23` → submit → list shows `JPY — 0.23`.
- Click `JPY` row → edit form with rate prefilled → change to `0.25` → submit → list shows `0.25`.
- `[d]` → pick `JPY` → removed → list empty → auto-back.

- [ ] **Step 8.9: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split currencies settings screen into list/create/edit routes"
```

---

## Task 9: Split Owners screen

`OwnerList.tsx` (221 lines, 4 modes) → `OwnerList.tsx` (rewritten) + `OwnerCreate.tsx` + `OwnerEdit.tsx`. Uses the new `core/services/slug` module instead of inline helpers.

**Files:**
- Rewrite: `src/tui/screens/OwnerList.tsx`
- Create: `src/tui/screens/OwnerCreate.tsx`
- Create: `src/tui/screens/OwnerEdit.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 9.1: Rewrite `OwnerList.tsx`**

Replace the entire contents of `src/tui/screens/OwnerList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeOwner } from "../../core/services/owner";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function OwnerList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasOwners = trip.owners.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasOwners
					? [{ label: "Remove", value: "remove", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/owners/new", { props: { tripDirPath } });
				} else if (value === "remove" && hasOwners) {
					goTo("/trips/owners", {
						props: { tripDirPath, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (selectMode === "remove") {
		if (trip.owners.length === 0) {
			return <Text dimColor>No owners.</Text>;
		}
		return (
			<RemoveSelector
				header="Select an owner to remove:"
				options={trip.owners.map((o) => ({
					label: o.name,
					value: o.id,
					detail: `(${o.id})`,
				}))}
				onConfirm={(value) => {
					removeOwner(trip, value);
					reloadTrip();
					if (trip.owners.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners yet.</Text>;
	}

	return (
		<VerticalSelect
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onChange={(ownerId) => {
				goTo("/trips/owners/edit", {
					props: { tripDirPath: trip.dirPath, ownerId },
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 9.2: Create `OwnerCreate.tsx`**

Create `src/tui/screens/OwnerCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import { addOwner } from "../../core/services/owner";
import { uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Display name",
		type: "text",
		required: true,
		placeholder: "e.g. Alice",
	},
];

export function OwnerCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				addOwner(trip, {
					id: uniqueSlug(
						name,
						trip.owners.map((o) => o.id),
					),
					name,
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 9.3: Create `OwnerEdit.tsx`**

Create `src/tui/screens/OwnerEdit.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateOwner } from "../../core/services/owner";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const ownerId = currentRoute.props["ownerId"] as string;
	const owner = trip?.owners.find((o) => o.id === ownerId);

	useEffect(() => {
		setTitleSuffix(owner?.name ?? ownerId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, owner, ownerId]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!owner) return <Text dimColor>Owner "{ownerId}" not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice",
			defaultValue: owner.name,
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {owner.id}</Text>
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = values["name"] ?? owner.name;
					updateOwner(trip, owner.id, name);
					reloadTrip();
					goBack();
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 9.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips/owners"`:

```ts
| "/trips/owners/new"
| "/trips/owners/edit"
```

- [ ] **Step 9.5: Wire routes in `src/tui/router.ts`**

Add imports:
```ts
import { OwnerCreate } from "./screens/OwnerCreate";
import { OwnerEdit } from "./screens/OwnerEdit";
```

(`OwnerList` import is unchanged since we rewrote that file in place.)

Add two new entries next to the existing `"/trips/owners"` entry:
```ts
"/trips/owners/new": {
	component: OwnerCreate as unknown as ComponentType,
	title: "Owner",
	defaultFocus: "main",
},
"/trips/owners/edit": {
	component: OwnerEdit as unknown as ComponentType,
	title: "Owner",
	defaultFocus: "main",
},
```

- [ ] **Step 9.6: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 9.7: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t9
```
- Create a trip → Owners.
- `[a]` add → "Alice" → submit → list shows Alice.
- Add "Alice" again → should generate id `alice-2`.
- Click "Alice" row → edit form → change name → submit → list updates.
- `[x]` remove → pick Alice → removed.

- [ ] **Step 9.8: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split owner list screen into list/create/edit routes"
```

---

## Task 10: Split Accounts screen

Same shape as Owners. `AccountList.tsx` (287 lines, 4 modes) → rewritten `AccountList.tsx` + `AccountCreate.tsx` + `AccountEdit.tsx`. Uses `core/services/slug`.

**Files:**
- Rewrite: `src/tui/screens/AccountList.tsx`
- Create: `src/tui/screens/AccountCreate.tsx`
- Create: `src/tui/screens/AccountEdit.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 10.1: Rewrite `AccountList.tsx`**

Replace the entire contents of `src/tui/screens/AccountList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeAccount } from "../../core/services/account";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function AccountList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasAccounts = trip.accounts.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [{ label: "Remove", value: "remove", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/accounts/new", { props: { tripDirPath } });
				} else if (value === "remove" && hasAccounts) {
					goTo("/trips/accounts", {
						props: { tripDirPath, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (selectMode === "remove") {
		if (trip.accounts.length === 0) {
			return <Text dimColor>No accounts.</Text>;
		}
		return (
			<RemoveSelector
				header="Select an account to remove:"
				options={trip.accounts.map((a) => ({
					label: a.name,
					value: a.id,
					detail: `(${a.type})`,
				}))}
				onConfirm={(value) => {
					removeAccount(trip, value);
					reloadTrip();
					if (trip.accounts.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts yet.</Text>;
	}

	return (
		<VerticalSelect
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onChange={(accountId) => {
				goTo("/trips/accounts/edit", {
					props: { tripDirPath: trip.dirPath, accountId },
				});
			}}
			isActive
		/>
	);
}
```

- [ ] **Step 10.2: Create `AccountCreate.tsx`**

Create `src/tui/screens/AccountCreate.tsx`:

```tsx
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Display name",
		type: "text",
		required: true,
		placeholder: "e.g. Alice's Visa",
	},
	{
		key: "type",
		label: "Account Type",
		type: "select",
		required: true,
		options: [
			{ label: "Credit", value: "Credit" },
			{ label: "Debit", value: "Debit" },
		],
		defaultValue: "Credit",
	},
	{
		key: "owners",
		label: "Owner IDs (comma-separated)",
		type: "text",
		required: true,
		placeholder: "e.g. alice,bob",
	},
];

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				const ownersStr = values["owners"] ?? "";
				const owners = ownersStr.split(",").map((s) => s.trim());
				addAccount(trip, {
					id: uniqueSlug(
						name,
						trip.accounts.map((a) => a.id),
					),
					name,
					type: (values["type"] ?? "Credit") as AccountType,
					owners,
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
```

- [ ] **Step 10.3: Create `AccountEdit.tsx`**

Create `src/tui/screens/AccountEdit.tsx`:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { updateAccount } from "../../core/services/account";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const accountId = currentRoute.props["accountId"] as string;
	const account = trip?.accounts.find((a) => a.id === accountId);

	useEffect(() => {
		setTitleSuffix(account?.name ?? accountId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, account, accountId]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!account) return <Text dimColor>Account "{accountId}" not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice's Visa",
			defaultValue: account.name,
		},
		{
			key: "type",
			label: "Account Type",
			type: "select",
			required: true,
			options: [
				{ label: "Credit", value: "Credit" },
				{ label: "Debit", value: "Debit" },
			],
			defaultValue: account.type,
		},
		{
			key: "owners",
			label: "Owner IDs (comma-separated)",
			type: "text",
			required: true,
			placeholder: "e.g. alice,bob",
			defaultValue: account.owners.join(", "),
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {account.id}</Text>
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = values["name"] ?? account.name;
					const typeStr = values["type"] ?? account.type;
					const ownersStr =
						values["owners"] ?? account.owners.join(", ");
					const owners = ownersStr.split(",").map((s) => s.trim());
					updateAccount(trip, account.id, {
						name,
						type: typeStr as AccountType,
						owners,
					});
					reloadTrip();
					goBack();
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 10.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips/accounts"`:

```ts
| "/trips/accounts/new"
| "/trips/accounts/edit"
```

- [ ] **Step 10.5: Wire routes in `src/tui/router.ts`**

Add imports:
```ts
import { AccountCreate } from "./screens/AccountCreate";
import { AccountEdit } from "./screens/AccountEdit";
```

Add next to `"/trips/accounts"`:
```ts
"/trips/accounts/new": {
	component: AccountCreate as unknown as ComponentType,
	title: "Account",
	defaultFocus: "main",
},
"/trips/accounts/edit": {
	component: AccountEdit as unknown as ComponentType,
	title: "Account",
	defaultFocus: "main",
},
```

- [ ] **Step 10.6: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 10.7: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t10
```
- Create a trip → add owner "Alice" → Accounts → `[a]` add → name "Alice Visa", type Credit, owners "alice" → submit → list shows.
- Click row → edit form prefilled (including owners "alice") → modify name → submit.
- `[x]` remove → pick → removed.

- [ ] **Step 10.8: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split account list screen into list/create/edit routes"
```

---

## Task 11: Split Trips screen (most complex)

`TripList.tsx` (323 lines, 5 modes) → rewritten `TripList.tsx` + `TripCreate.tsx` + `TripDuplicate.tsx`. Uses `core/services/trip/toDirName` (unchanged). No `slug` import because trip identity is the directory-name-with-year, still handled by `toDirName`.

**Files:**
- Rewrite: `src/tui/screens/TripList.tsx`
- Create: `src/tui/screens/TripCreate.tsx`
- Create: `src/tui/screens/TripDuplicate.tsx`
- Modify: `src/tui/router.ts`

- [ ] **Step 11.1: Rewrite `TripList.tsx`**

Replace the entire contents of `src/tui/screens/TripList.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { deleteTrip, listTrips } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import {
	LIST_HINTS,
	SELECT_REMOVE_HINTS,
} from "../constants/hints";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "delete" | "duplicate";

export function TripList(): JSX.Element {
	const { goTo, goBack, currentRoute } = useNavigation();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";
	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setTitleSuffix(null);

		if (selectMode === "delete") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}
		if (selectMode === "duplicate") {
			setBorderColor(null);
			setMenu([], () => {});
			setHints([
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Select trip" },
				{ key: "q/esc", label: "Back to list" },
				{ key: "e", label: "Exit" },
			]);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{ label: "Duplicate", value: "duplicate", key: "d" },
				{ label: "Delete", value: "delete", key: "x" },
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && trips.length > 0) {
					goTo("/trips", {
						props: { dataDir, selectMode: "duplicate" },
					});
				} else if (value === "delete" && trips.length > 0) {
					goTo("/trips", { props: { dataDir, selectMode: "delete" } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		selectMode,
		dataDir,
		trips.length,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (selectMode === "delete") {
		if (trips.length === 0) {
			return <Text dimColor>No trips.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a trip to delete:"
				options={trips.map((t) => ({
					label: t.settings.name,
					value: t.dirPath,
					detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
				}))}
				onConfirm={(dirPath) => {
					deleteTrip(dirPath);
					const next = listTrips(dataDir);
					setTrips(next);
					if (next.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (selectMode === "duplicate") {
		if (trips.length === 0) {
			return <Text dimColor>No trips.</Text>;
		}
		return (
			<VerticalSelect
				options={trips.map((t) => ({
					label: t.settings.name,
					value: t.dirPath,
					detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
				}))}
				onChange={(dirPath) => {
					const trip = trips.find((t) => t.dirPath === dirPath);
					if (!trip) return;
					goTo("/trips/duplicate", {
						props: {
							dataDir,
							sourceDirPath: trip.dirPath,
							sourceName: trip.settings.name,
							sourceStartDate: trip.settings.startDate,
						},
					});
				}}
				onCancel={goBack}
				isActive
			/>
		);
	}

	if (trips.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<VerticalSelect
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onChange={(value) => {
				const trip = trips.find((t) => t.dirPath === value);
				if (trip) {
					goTo("/trips/overview", {
						props: {
							tripDirPath: trip.dirPath,
							tripName: trip.settings.name,
							dataDir,
						},
					});
				}
			}}
			isActive={focus === "main"}
		/>
	);
}
```

- [ ] **Step 11.2: Create `TripCreate.tsx`**

Create `src/tui/screens/TripCreate.tsx`:

```tsx
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const DEFAULT_SETTINGS: Omit<Settings, "name" | "startDate" | "endDate"> = {
	countries: [],
	baseCurrency: "THB",
	currencies: {},
	categories: [
		"Flight",
		"Hotels",
		"Transportation",
		"Shopping",
		"Eating",
		"Activities",
	],
	tags: [],
	exportPath: "./expenses.csv",
};

const FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Trip Name",
		type: "text",
		required: true,
		placeholder: "e.g. Japan Trip",
	},
	{
		key: "startDate",
		label: "Start Date",
		type: "date",
		required: true,
		defaultValue: today(),
	},
	{
		key: "endDate",
		label: "End Date",
		type: "date",
		required: true,
		defaultValue: addDays(today(), 1),
	},
];

export function TripCreate(): JSX.Element {
	const { goTo, currentRoute } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix("New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={FIELDS}
				onSubmit={(values) => {
					const name = values["name"] ?? "";
					const startDate = values["startDate"] ?? today();
					const endDate = values["endDate"] ?? addDays(today(), 1);
					const dirName = toDirName(name, startDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);
					const settings: Settings = {
						...DEFAULT_SETTINGS,
						name,
						startDate,
						endDate,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
					// replace: true so pressing [q] from the overview returns
					// to the trip list, not back to this empty create form.
					goTo("/trips/overview", {
						replace: true,
						props: {
							tripDirPath: newTrip.dirPath,
							tripName: name,
							dataDir,
						},
					});
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 11.3: Create `TripDuplicate.tsx`**

Create `src/tui/screens/TripDuplicate.tsx`:

```tsx
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { duplicateTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TripDuplicate(): JSX.Element {
	const { goBack, currentRoute } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";
	const sourceDirPath = currentRoute.props["sourceDirPath"] as string;
	const sourceName = currentRoute.props["sourceName"] as string;
	const sourceStartDate = currentRoute.props["sourceStartDate"] as string;

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(`Duplicate: ${sourceName}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, sourceName]);

	const fields: FormFieldConfig[] = [
		{
			key: "newName",
			label: "New Trip Name",
			type: "text",
			required: true,
			placeholder: `e.g. ${sourceName} v2`,
		},
	];

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = values["newName"] ?? "";
					const dirName = toDirName(name, sourceStartDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);
					duplicateTrip(dataDir, sourceDirPath, dirName, name);
					goBack();
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 11.4: Extend `RoutePath` union**

In `src/tui/models/index.ts`, add two new entries next to `"/trips"`:

```ts
| "/trips/new"
| "/trips/duplicate"
```

- [ ] **Step 11.5: Wire routes in `src/tui/router.ts`**

Add imports:
```ts
import { TripCreate } from "./screens/TripCreate";
import { TripDuplicate } from "./screens/TripDuplicate";
```

Add next to `"/trips"`:
```ts
"/trips/new": {
	component: TripCreate as unknown as ComponentType,
	title: "New Trip",
	defaultFocus: "main",
},
"/trips/duplicate": {
	component: TripDuplicate as unknown as ComponentType,
	title: "Duplicate Trip",
	defaultFocus: "main",
},
```

- [ ] **Step 11.6: Typecheck & lint**

```bash
bun run check:type && bun run check
```
Expected: clean.

- [ ] **Step 11.7: Smoke test**

```bash
bun run start --data-dir /tmp/finmove-t11
```
- No trips → `[c]` create → name "Japan Trip", dates → submit → lands on `/trips/overview` for new trip.
- `[q]` back → trip list shows "Japan Trip" (single `[q]` should land on browse, not on an empty create form — that verifies the `replace: true` flag).
- `[d]` duplicate → pick "Japan Trip" → form asks for new name → enter "Japan Trip 2" → submit → back on duplicate selector showing both trips.
- Try duplicate again with same name "Japan Trip" — should show inline error "Trip already exists".
- `[q]` back to list → `[x]` delete → pick "Japan Trip 2" → removed; still in delete mode with 1 trip.
- `[q]` back → browse, 1 trip remaining.

- [ ] **Step 11.8: Commit**

```bash
git add src/tui
git commit -m "refactor(tui): split trip list screen into list/create/duplicate routes"
```

---

## Task 12: Dead-code sweep

Ensure nothing from the old structure remains.

- [ ] **Step 12.1: Grep for leftovers**

```bash
grep -rn "setMode\|TripSettingsTags\|TripSettingsCountries\|TripSettingsCategories\|TripSettingsCurrencies\|TripMenu\b" src/tui/
```
Expected: no matches.

```bash
grep -rn "toSlug\b\|uniqueSlug\b" src/tui/
```
Expected: only imports from `core/services/slug` — no local definitions in TUI files.

```bash
grep -rn "/trips/menu" src/
```
Expected: no matches.

- [ ] **Step 12.2: Final typecheck & lint & test**

```bash
bun run check:type && bun run check && bun test
```
Expected: all green.

- [ ] **Step 12.3: No commit needed** if grep passes and all checks are green.

If grep found something, remove it, then:
```bash
git add src/
git commit -m "chore(tui): remove leftover mode-era references"
```

---

## Task 13: Full smoke test

Final end-to-end verification against the design spec's checklist.

- [ ] **Step 13.1: Full manual smoke test**

```bash
rm -rf /tmp/finmove-final && bun run start --data-dir /tmp/finmove-final
```

Run the full checklist from `docs/superpowers/specs/2026-04-24-screen-per-mode-refactor-design.md` § Testing § Manual smoke-test checklist:

**Trip flows**
- `[c]` Create → form → submit → lands on `/trips/overview`.
- `[d]` Duplicate → pick source → name form → submit → back on `/trips`; new trip visible.
- `[x]` Delete → pick → removes; stays in delete mode until list empty, then `goBack()`.
- `[q]` during any selectMode returns to normal list.

**Owner / Account / Currency flows**
- `[a]` Add → form → submit → back on list.
- Row-click in browse mode → edit form prefilled → submit → back on list.
- `[x]` or `[d]` Remove → pick → confirms; stays in remove mode until empty.

**Settings lists (Countries / Categories / Tags)**
- Row-click → edit form.
- Add & Delete as above.

**Regression checks**
- `[q]` from deep route navigates up one level at a time.
- `[e]` / `[esc]` exits program from any screen.
- `[tab]` switches focus between main and menu on list screens.
- Border color is red on `selectMode === "remove" | "delete"`, default otherwise.
- Hints update on every route change.

- [ ] **Step 13.2: Final checks**

```bash
bun run check:type && bun run check && bun test
```
Expected: all green.

---

## Non-goals (do not pursue in this plan)

- No validation for duplicate category/country/tag names on add or edit.
- No `useListMenu` hook or `SingleFieldForm` wrapper — `Form` already handles the one-text-field case.
- No changes to `ExpenseList`, `ExpenseForm`, `Export`, `TripSettings`.
- No changes to `core/services` beyond adding `slug/`.
- No changes to global keybindings, focus model, or layout context.
