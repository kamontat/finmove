# Scrollable Trip Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trip dashboard scrollable with `↑`/`↓` keys when its content exceeds the main-box height, with a `↑`/`↓`/`↕` corner glyph showing scroll state.

**Architecture:** A new self-contained `ScrollableMain` molecule wraps the dashboard. It uses Ink's `measureElement` to know both its own viewport height (via `flexGrow={1}`) and the content height, captures `useInput` while active, and translates content with `marginTop={-offset}` inside an `overflow="hidden"` outer box. No changes to layout, focus, or list/form behavior.

**Tech Stack:** React + Ink (TypeScript). Uses `measureElement`, `useInput`, `Box.position="absolute"`, `Box.overflow="hidden"`, and `Box.marginTop` with negative values.

**Spec:** `docs/superpowers/specs/2026-05-15-scrollable-trip-dashboard-design.md`

---

## File Structure

- **Create:** `src/tui/components/molecules/ScrollableMain.tsx` — the scrollable wrapper. Self-measures via Ink's `measureElement`, owns scroll offset and arrow-key input, renders an overflow glyph when needed.
- **Modify:** `src/tui/components/organisms/TripDashboard.tsx` — accept a new `isActive: boolean` prop, wrap existing content in `<ScrollableMain>`.
- **Modify:** `src/tui/screens/TripOverview.tsx` — read `focus` from `useFocus()`, pass `focus === "main"` to `TripDashboard`, add `↑↓ Scroll` to hints.

No new tests — TUI rendering is not covered by the project's test suite (convention). Verification is live in the running app.

---

## Task 1: Create `ScrollableMain` molecule

**Files:**
- Create: `src/tui/components/molecules/ScrollableMain.tsx`

- [ ] **Step 1: Verify clean baseline**

Run: `bun test && bun run check:type && bun run check`

Expected: 199 tests pass, zero type errors, zero lint errors. If anything is broken, stop and report — do not introduce new changes on top of an unclean baseline.

- [ ] **Step 2: Create the component file**

Write `src/tui/components/molecules/ScrollableMain.tsx` with this exact content:

```tsx
import { Box, type DOMElement, measureElement, Text, useInput } from "ink";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface ScrollableMainProps {
	isActive: boolean;
	children: ReactNode;
}

export function ScrollableMain({
	isActive,
	children,
}: ScrollableMainProps): JSX.Element {
	const outerRef = useRef<DOMElement>(null);
	const contentRef = useRef<DOMElement>(null);
	const [offset, setOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		if (!outerRef.current || !contentRef.current) return;
		const v = measureElement(outerRef.current).height;
		const c = measureElement(contentRef.current).height;
		setViewportHeight(v);
		setContentHeight(c);
	});

	const maxOffset = Math.max(0, contentHeight - viewportHeight);
	const clampedOffset = Math.min(offset, maxOffset);
	if (clampedOffset !== offset) {
		setOffset(clampedOffset);
	}

	useInput(
		(_, key) => {
			if (key.upArrow) {
				setOffset((o) => Math.max(0, o - 1));
			} else if (key.downArrow) {
				setOffset((o) => Math.min(maxOffset, o + 1));
			}
		},
		{ isActive },
	);

	const overflows = contentHeight > viewportHeight;
	let glyph: string | null = null;
	if (overflows) {
		if (clampedOffset === 0) glyph = "↓";
		else if (clampedOffset >= maxOffset) glyph = "↑";
		else glyph = "↕";
	}

	return (
		<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
			<Box
				ref={contentRef}
				flexDirection="column"
				flexShrink={0}
				marginTop={-clampedOffset}
			>
				{children}
			</Box>
			{glyph !== null && (
				<Box position="absolute" bottom={0} right={0}>
					<Text dimColor>{glyph}</Text>
				</Box>
			)}
		</Box>
	);
}
```

Notes on the code:
- The `useEffect` has no dependency array on purpose — it runs after every render so any layout change (terminal resize, content reflow, parent re-render) re-measures both boxes.
- The clamp-during-render pattern (`if (clampedOffset !== offset) setOffset(clampedOffset)`) is React's recommended way to react to derived state changes. It triggers one extra render but never an infinite loop because the condition becomes false on the next pass.
- `flexShrink={0}` on the inner content box prevents Yoga from squashing the content to fit the viewport — we want overflow to be real so we can scroll through it.
- The glyph is rendered as a sibling of the content box (still inside the clipping outer box) with `position="absolute"`, so it stays anchored to the bottom-right regardless of `offset`.

- [ ] **Step 3: Run typecheck**

Run: `bun run check:type`

Expected: zero errors. (The component is exported but not yet used. Verify it does not produce an "unused" error — exports are not subject to `noUnusedLocals`, so this is fine.)

- [ ] **Step 4: Run lint**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 5: Run the full test suite**

Run: `bun test`

Expected: 199 tests still passing — no regressions in non-TUI code.

- [ ] **Step 6: Commit**

```bash
git add src/tui/components/molecules/ScrollableMain.tsx
git commit -m "feat(tui): add ScrollableMain molecule with arrow-key scrolling"
```

---

## Task 2: Wire `ScrollableMain` into the trip dashboard

**Files:**
- Modify: `src/tui/components/organisms/TripDashboard.tsx`
- Modify: `src/tui/screens/TripOverview.tsx`

- [ ] **Step 1: Add `isActive` prop to `TripDashboard`**

In `src/tui/components/organisms/TripDashboard.tsx`:

Find the `Props` interface at the top of the file:

```tsx
interface Props {
	status: TripStatus;
}
```

Change it to:

```tsx
interface Props {
	status: TripStatus;
}

interface DashboardProps {
	status: TripStatus;
	isActive: boolean;
}
```

Then find the exported function at the bottom of the file:

```tsx
export function TripDashboard({ status }: Props): JSX.Element {
	const hasOwners = status.ownerBalances.length > 0;
	const hasAccountSpend = status.byAccount.length > 0;
	return (
		<Box flexDirection="column" gap={1}>
			<StatusHeader status={status} />
			<ProgressBar status={status} />

			<Box flexDirection="row" flexWrap="wrap" gap={2}>
				<SpendBlock status={status} />
				{hasOwners && <OwnersBlock status={status} />}
				<CategoriesBlock status={status} />
				{hasAccountSpend && <AccountsBlock status={status} />}
				<CountsBlock status={status} />
			</Box>

			{status.warnings.length > 0 && <WarningList status={status} />}
		</Box>
	);
}
```

Replace it with:

```tsx
export function TripDashboard({
	status,
	isActive,
}: DashboardProps): JSX.Element {
	const hasOwners = status.ownerBalances.length > 0;
	const hasAccountSpend = status.byAccount.length > 0;
	return (
		<ScrollableMain isActive={isActive}>
			<Box flexDirection="column" gap={1}>
				<StatusHeader status={status} />
				<ProgressBar status={status} />

				<Box flexDirection="row" flexWrap="wrap" gap={2}>
					<SpendBlock status={status} />
					{hasOwners && <OwnersBlock status={status} />}
					<CategoriesBlock status={status} />
					{hasAccountSpend && <AccountsBlock status={status} />}
					<CountsBlock status={status} />
				</Box>

				{status.warnings.length > 0 && <WarningList status={status} />}
			</Box>
		</ScrollableMain>
	);
}
```

The inner private block components (`SpendBlock`, `OwnersBlock`, etc.) still take `Props` (the original one-field interface). Only the exported wrapper takes `DashboardProps`.

- [ ] **Step 2: Add the `ScrollableMain` import**

At the top of `src/tui/components/organisms/TripDashboard.tsx`, the current imports are:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { AccountType } from "../../../core/models";
import type { TripStatus } from "../../../core/services/trip";
```

Add the `ScrollableMain` import (alphabetized — comes after `ink` because `ScrollableMain` is a relative path):

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { AccountType } from "../../../core/models";
import type { TripStatus } from "../../../core/services/trip";
import { ScrollableMain } from "../molecules/ScrollableMain";
```

- [ ] **Step 3: Pass `focus` into `TripDashboard` from `TripOverview`**

Open `src/tui/screens/TripOverview.tsx`. Current top of file:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { today } from "../../core/services/date";
import { getTripStatus } from "../../core/services/trip";
import { TripDashboard } from "../components/organisms/TripDashboard";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
```

Add the `useFocus` import:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { today } from "../../core/services/date";
import { getTripStatus } from "../../core/services/trip";
import { TripDashboard } from "../components/organisms/TripDashboard";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
```

Then find the current function body:

```tsx
export function TripOverview(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setHints } = useLayout();
	const { setMenu } = useMenu();
	useEffect(() => {
```

Add the `useFocus` hook call:

```tsx
export function TripOverview(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setHints } = useLayout();
	const { setMenu } = useMenu();
	const { focus } = useFocus();
	useEffect(() => {
```

Find the existing `setHints([...])` call inside the `useEffect`:

```tsx
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
```

Replace with the same array plus the new `↑↓ Scroll` entry, placed first since it relates to the main area which is the default focus:

```tsx
		setHints([
			{ key: "↑↓", label: "Scroll" },
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
```

Find the final `return <TripDashboard status={getTripStatus(trip, today())} />;` line near the bottom of the function and replace it with:

```tsx
	return (
		<TripDashboard
			status={getTripStatus(trip, today())}
			isActive={focus === "main"}
		/>
	);
```

- [ ] **Step 4: Run typecheck**

Run: `bun run check:type`

Expected: zero errors.

- [ ] **Step 5: Run lint**

Run: `bun run check`

Expected: zero errors.

- [ ] **Step 6: Run the full test suite**

Run: `bun test`

Expected: 199 tests pass.

- [ ] **Step 7: Smoke-test in the TUI (defer to human if no interactive terminal)**

If you can run an interactive terminal:

```bash
bun run start
```

Then:
1. Open a trip whose dashboard is taller than the terminal (or shrink the terminal vertically until content overflows).
2. Confirm `↓` appears in the bottom-right of the main box.
3. Press `↓` — content shifts up one line per press. Confirm the corner glyph becomes `↕` once you've scrolled but aren't at the bottom, then `↑` at the bottom.
4. Press `↑` — content scrolls back.
5. Press `[tab]` to move focus to the menu. Arrow keys must stop scrolling (they now navigate the menu). Press `[tab]` again to return; arrow keys scroll again from the preserved offset.
6. Resize the terminal taller until content fits — the corner glyph disappears, arrow presses do nothing.

If you cannot drive an interactive terminal, say so explicitly in your status report and leave verification to the human. Do not fabricate confirmation.

- [ ] **Step 8: Commit**

```bash
git add src/tui/components/organisms/TripDashboard.tsx src/tui/screens/TripOverview.tsx
git commit -m "feat(tui): make trip dashboard scrollable with arrow keys"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 builds the `ScrollableMain` molecule with all behavior described in the spec's "Architecture > New molecule" section (flexGrow viewport, marginTop offset, measureElement effect, clamp logic, useInput for ↑/↓, absolute-positioned glyph with the three-state rule). Task 2 implements the spec's "Wiring into TripDashboard.tsx" section (new `isActive` prop, wrap content in `<ScrollableMain>`) and the "Hint bar update" section (add `↑↓ Scroll` to `TripOverview`'s hints, pass `focus === "main"` from `useFocus`). The Non-goals (no PageUp/PageDown/Home/End, no horizontal scrolling, no scrollbar, no test additions) are honored — no extra keys or features beyond ↑/↓.
- **Placeholders:** none. Each code-change step shows exact code.
- **Type consistency:** `DashboardProps` (Task 2 Step 1) matches what `TripOverview` passes (Task 2 Step 3). The inner block components keep using the original `Props` (single `status` field). `ScrollableMainProps` (Task 1 Step 2) matches the usage in Task 2 Step 1 (`isActive`, `children`).
