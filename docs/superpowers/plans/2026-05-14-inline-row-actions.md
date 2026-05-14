# Inline Row Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline `[d]` (duplicate) and `[x]` (delete with two-press confirm) row actions for the nine list screens when focus is on the main zone, while preserving the existing dedicated picker screens for the menu-focus path.

**Architecture:** Introduce a new `MenuContext` (extracted from `LayoutContext`) that owns menu options plus a declarative `mainAction` per option. A pure `MenuStore` class implements the state machine (arm/check/confirm/reset). `MenuProvider` wraps the store and exposes hooks for screens and selectors. `layouts/Default.tsx` becomes the single entry point that calls `menu.trigger(value, focus)` from `SelectInput`'s `onChange`. Selector molecules (`ListSelect`, `TableSelect`) gain `armedRowIndex` and `onHighlight(_, index)` to feed the cursor back to the menu state and to paint the armed row red.

**Tech Stack:** TypeScript, React, Ink, Bun (test runner + runtime), Biome (lint+format).

**Spec:** `docs/superpowers/specs/2026-05-14-inline-row-actions-design.md`.

---

## Phase 1 — `MenuStore` state machine (pure TypeScript)

The state machine lives in a plain class so it can be unit-tested without React. Follows the existing pattern of `FormBufferStore` + `FormBufferProvider`.

### Task 1.1: Create `MenuStore` skeleton + first test

**Files:**
- Create: `src/tui/states/menuStore.ts`
- Create: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tui/states/__tests__/menuStore.test.ts
import { describe, expect, test } from "bun:test";
import { MenuStore } from "../menuStore";

describe("MenuStore", () => {
  test("initial state is empty", () => {
    const store = new MenuStore();
    expect(store.getOptions()).toEqual([]);
    expect(store.getArmed()).toBeNull();
    expect(store.getActiveIndex()).toBeNull();
    expect(store.getArmedHint()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `MenuStore` cannot be found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/tui/states/menuStore.ts
import type { FocusZone } from "../models";

export interface MenuOptionMainAction {
  confirmCount?: number;
  check?: (index: number) => boolean;
  onConfirm: (index: number) => void;
}

export interface MenuOption {
  label: string;
  value: string;
  key?: string;
  mainAction?: MenuOptionMainAction;
}

export interface ArmedState {
  value: string;
  index: number;
  count: number;
}

export class MenuStore {
  private options: MenuOption[] = [];
  private onSelect: ((value: string) => void) | null = null;
  private activeIndex: number | null = null;
  private armed: ArmedState | null = null;

  getOptions(): MenuOption[] {
    return this.options;
  }

  getOnSelect(): ((value: string) => void) | null {
    return this.onSelect;
  }

  getArmed(): ArmedState | null {
    return this.armed;
  }

  getActiveIndex(): number | null {
    return this.activeIndex;
  }

  getArmedHint(): string | null {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): add MenuStore skeleton with initial state"
```

---

### Task 1.2: `setMenu` populates options and onSelect; resets activeIndex and armed

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the existing `describe("MenuStore", ...)` block:

```ts
  test("setMenu stores options and onSelect callback", () => {
    const store = new MenuStore();
    const onSelect = (_value: string) => {};
    store.setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      onSelect,
    );
    expect(store.getOptions()).toEqual([{ label: "Add", value: "add", key: "a" }]);
    expect(store.getOnSelect()).toBe(onSelect);
  });

  test("setMenu clears any prior activeIndex", () => {
    const store = new MenuStore();
    store.setActiveIndex(3);
    store.setMenu([], () => {});
    expect(store.getActiveIndex()).toBeNull();
  });

  test("setMenu clears any prior armed state", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main");
    expect(store.getArmed()).not.toBeNull();
    store.setMenu([], () => {});
    expect(store.getArmed()).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `setMenu`, `setActiveIndex`, and `trigger` are not defined.

- [ ] **Step 3: Implement the methods**

Replace the body of `MenuStore` in `src/tui/states/menuStore.ts` with:

```ts
export class MenuStore {
  private options: MenuOption[] = [];
  private onSelect: ((value: string) => void) | null = null;
  private activeIndex: number | null = null;
  private armed: ArmedState | null = null;

  getOptions(): MenuOption[] {
    return this.options;
  }

  getOnSelect(): ((value: string) => void) | null {
    return this.onSelect;
  }

  getArmed(): ArmedState | null {
    return this.armed;
  }

  getActiveIndex(): number | null {
    return this.activeIndex;
  }

  getArmedHint(): string | null {
    return null;
  }

  setMenu(options: MenuOption[], onSelect: (value: string) => void): void {
    this.options = options;
    this.onSelect = onSelect;
    this.activeIndex = null;
    this.armed = null;
  }

  setActiveIndex(index: number | null): void {
    this.activeIndex = index;
  }

  reset(): void {
    this.armed = null;
  }

  trigger(_value: string, _focus: FocusZone): void {
    // implemented in later tasks
  }
}
```

- [ ] **Step 4: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS (the third test arming step still no-ops, but `setMenu` clears the (still-null) armed without issue — see Task 1.7 where the third test becomes meaningful).

Note: the third test ("setMenu clears any prior armed state") passes for now because `trigger` is a no-op, so `armed` stays null both before and after `setMenu` clears it. It will provide regression coverage once `trigger` is implemented.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): setMenu + setActiveIndex + reset"
```

---

### Task 1.3: `trigger` delegates to onSelect when focus is "menu"

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
  test("trigger calls onSelect when focus is menu", () => {
    const store = new MenuStore();
    const calls: string[] = [];
    store.setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      (value) => calls.push(value),
    );
    store.trigger("add", "menu");
    expect(calls).toEqual(["add"]);
  });

  test("trigger ignores unknown values", () => {
    const store = new MenuStore();
    const calls: string[] = [];
    store.setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      (value) => calls.push(value),
    );
    store.trigger("missing", "menu");
    expect(calls).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `trigger` is a no-op.

- [ ] **Step 3: Implement `trigger`**

Replace the placeholder `trigger` in `menuStore.ts` with:

```ts
  trigger(value: string, focus: FocusZone): void {
    const opt = this.options.find((o) => o.value === value);
    if (!opt) return;

    if (focus === "main" && opt.mainAction && this.activeIndex !== null) {
      // implemented in later tasks
      return;
    }

    this.armed = null;
    this.onSelect?.(value);
  }
```

- [ ] **Step 4: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): trigger delegates to onSelect for menu focus"
```

---

### Task 1.4: `trigger` falls through to onSelect when option has no `mainAction`

**Files:**
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger calls onSelect from main focus when option has no mainAction", () => {
    const store = new MenuStore();
    const calls: string[] = [];
    store.setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      (value) => calls.push(value),
    );
    store.setActiveIndex(2);
    store.trigger("add", "main");
    expect(calls).toEqual(["add"]);
  });

  test("trigger calls onSelect from main focus when activeIndex is null", () => {
    const store = new MenuStore();
    const calls: string[] = [];
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      (value) => calls.push(value),
    );
    // activeIndex stays null (no list rendered)
    store.trigger("delete", "main");
    expect(calls).toEqual(["delete"]);
  });
```

- [ ] **Step 2: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS. The existing `trigger` logic already handles these cases (mainAction absent → falls through; activeIndex null → falls through).

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/__tests__/menuStore.test.ts
git commit -m "test(menu): cover trigger fall-through cases"
```

---

### Task 1.5: `trigger` fires `onConfirm` immediately for `confirmCount: 1` (no arm)

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger fires onConfirm immediately when confirmCount is 1 (default)", () => {
    const store = new MenuStore();
    const confirmed: number[] = [];
    store.setMenu(
      [{ label: "Duplicate", value: "duplicate", key: "d",
        mainAction: { onConfirm: (i) => confirmed.push(i) } }],
      () => {},
    );
    store.setActiveIndex(2);
    store.trigger("duplicate", "main");
    expect(confirmed).toEqual([2]);
    expect(store.getArmed()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `onConfirm` is not yet called.

- [ ] **Step 3: Implement single-press path**

Replace the inner `if (focus === "main" && opt.mainAction && this.activeIndex !== null)` block in `menuStore.ts`:

```ts
    if (focus === "main" && opt.mainAction && this.activeIndex !== null) {
      const index = this.activeIndex;
      const action = opt.mainAction;
      const confirmCount = action.confirmCount ?? 1;

      const armedMatches =
        this.armed !== null &&
        this.armed.value === opt.value &&
        this.armed.index === index;

      if (armedMatches) {
        // handled in next task
        return;
      }

      const checkOk = action.check ? action.check(index) : true;
      if (!checkOk) {
        this.armed = null;
        return;
      }

      this.armed = { value: opt.value, index, count: 1 };
      if (this.armed.count >= confirmCount) {
        action.onConfirm(index);
        this.armed = null;
      }
      return;
    }
```

- [ ] **Step 4: Run test to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): mainAction single-press fires onConfirm immediately"
```

---

### Task 1.6: `trigger` arms on first press when `confirmCount: 2`

**Files:**
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger arms on first press when confirmCount is 2", () => {
    const store = new MenuStore();
    const confirmed: number[] = [];
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: (i) => confirmed.push(i) } }],
      () => {},
    );
    store.setActiveIndex(1);
    store.trigger("delete", "main");
    expect(confirmed).toEqual([]);
    expect(store.getArmed()).toEqual({ value: "delete", index: 1, count: 1 });
  });
```

- [ ] **Step 2: Run test to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS — the implementation from Task 1.5 already supports this (`count: 1 < confirmCount: 2` → no fire, armed remains).

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/__tests__/menuStore.test.ts
git commit -m "test(menu): cover two-press arm-on-first-press"
```

---

### Task 1.7: `trigger` confirms on second press at same `(value, index)`

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger fires onConfirm on second press for confirmCount: 2", () => {
    const store = new MenuStore();
    const confirmed: number[] = [];
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: (i) => confirmed.push(i) } }],
      () => {},
    );
    store.setActiveIndex(1);
    store.trigger("delete", "main"); // arm
    store.trigger("delete", "main"); // confirm
    expect(confirmed).toEqual([1]);
    expect(store.getArmed()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — the `armedMatches` branch returns without firing.

- [ ] **Step 3: Implement the confirm branch**

In `menuStore.ts`, replace the `if (armedMatches)` block:

```ts
      if (armedMatches) {
        const newCount = this.armed!.count + 1;
        if (newCount >= confirmCount) {
          action.onConfirm(index);
          this.armed = null;
        } else {
          this.armed = { value: opt.value, index, count: newCount };
        }
        return;
      }
```

- [ ] **Step 4: Run test to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): two-press confirm fires onConfirm on match"
```

---

### Task 1.8: `check` returning `false` skips arming

**Files:**
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger does not arm when check returns false", () => {
    const store = new MenuStore();
    const confirmed: number[] = [];
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: {
          confirmCount: 2,
          check: () => false,
          onConfirm: (i) => confirmed.push(i),
        } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main");
    expect(confirmed).toEqual([]);
    expect(store.getArmed()).toBeNull();
  });

  test("trigger arms when check returns true", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: {
          confirmCount: 2,
          check: () => true,
          onConfirm: () => {},
        } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main");
    expect(store.getArmed()).toEqual({ value: "delete", index: 0, count: 1 });
  });
```

- [ ] **Step 2: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS — the check branch from Task 1.5 already handles this.

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/__tests__/menuStore.test.ts
git commit -m "test(menu): cover check predicate behavior"
```

---

### Task 1.9: `setActiveIndex` clears armed when index changes

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("setActiveIndex clears armed when index changes", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main"); // arm at 0
    expect(store.getArmed()).not.toBeNull();
    store.setActiveIndex(1);
    expect(store.getArmed()).toBeNull();
  });

  test("setActiveIndex keeps armed when same index re-sets", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main"); // arm at 0
    store.setActiveIndex(0); // same index
    expect(store.getArmed()).toEqual({ value: "delete", index: 0, count: 1 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `setActiveIndex` does not check armed state.

- [ ] **Step 3: Update `setActiveIndex`**

In `menuStore.ts`, replace `setActiveIndex`:

```ts
  setActiveIndex(index: number | null): void {
    if (this.armed !== null && index !== this.armed.index) {
      this.armed = null;
    }
    this.activeIndex = index;
  }
```

- [ ] **Step 4: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): clear armed when activeIndex changes"
```

---

### Task 1.10: Falling through to `onSelect` clears armed (other shortcut pressed)

**Files:**
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("trigger clears armed when falling through to onSelect", () => {
    const store = new MenuStore();
    store.setMenu(
      [
        { label: "Delete", value: "delete", key: "x",
          mainAction: { confirmCount: 2, onConfirm: () => {} } },
        { label: "Add", value: "add", key: "a" },
      ],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main"); // arm
    expect(store.getArmed()).not.toBeNull();
    store.trigger("add", "main"); // different value, no mainAction → fall through
    expect(store.getArmed()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS — the fall-through path already calls `this.armed = null`.

- [ ] **Step 3: Commit**

```bash
git add src/tui/states/__tests__/menuStore.test.ts
git commit -m "test(menu): cover armed clearing on fall-through"
```

---

### Task 1.11: `armedHint` returns formatted string from armed state

**Files:**
- Modify: `src/tui/states/menuStore.ts`
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  test("armedHint formats from armed option label and key", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main");
    expect(store.getArmedHint()).toBe("Press [x] again to confirm delete");
  });

  test("armedHint is null when not armed", () => {
    const store = new MenuStore();
    expect(store.getArmedHint()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: FAIL — `getArmedHint` returns null unconditionally.

- [ ] **Step 3: Implement `getArmedHint`**

In `menuStore.ts`, replace `getArmedHint`:

```ts
  getArmedHint(): string | null {
    if (this.armed === null) return null;
    const opt = this.options.find((o) => o.value === this.armed?.value);
    if (!opt) return null;
    const keyLabel = opt.key ?? opt.value;
    return `Press [${keyLabel}] again to confirm ${opt.label.toLowerCase()}`;
  }
```

- [ ] **Step 4: Run tests to verify**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/states/menuStore.ts src/tui/states/__tests__/menuStore.test.ts
git commit -m "feat(menu): derive armedHint from armed state and option"
```

---

### Task 1.12: `trigger` does not arm if no `activeIndex` even with mainAction (already covered, sanity check)

**Files:**
- Modify: `src/tui/states/__tests__/menuStore.test.ts`

- [ ] **Step 1: Verify by reading**

The tests added in Task 1.4 ("trigger calls onSelect from main focus when activeIndex is null") already prove that when `activeIndex === null`, even mainAction options fall through to `onSelect`. No new test needed; this task confirms coverage.

- [ ] **Step 2: Run the full suite to confirm green**

Run: `bun test src/tui/states/__tests__/menuStore.test.ts`
Expected: PASS — all MenuStore tests green.

- [ ] **Step 3: Run typecheck and biome on touched files**

Run: `bun run check:type` and `bun run check`
Expected: no errors.

- [ ] **Step 4: Commit (only if any formatting fixes needed)**

If `bun run fix` made any changes:

```bash
git add -A
git commit -m "chore(menu): apply biome formatting to MenuStore"
```

Otherwise skip this commit.

---

## Phase 2 — `MenuProvider` + integration with `Default` layout and `App`

### Task 2.1: Create `MenuProvider` wrapping `MenuStore`

**Files:**
- Create: `src/tui/states/menu.tsx`

- [ ] **Step 1: Write the provider and hook**

```tsx
// src/tui/states/menu.tsx
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FocusZone } from "../models";
import {
  type ArmedState,
  type MenuOption,
  MenuStore,
} from "./menuStore";

interface MenuContextValue {
  options: MenuOption[];
  onSelect: ((value: string) => void) | null;
  armed: ArmedState | null;
  armedHint: string | null;
  activeIndex: number | null;
  setMenu: (
    options: MenuOption[],
    onSelect: (value: string) => void,
  ) => void;
  setActiveIndex: (index: number | null) => void;
  trigger: (value: string, focus: FocusZone) => void;
  reset: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

interface MenuProviderProps {
  children: ReactNode;
}

export function MenuProvider({ children }: MenuProviderProps): JSX.Element {
  const storeRef = useRef<MenuStore>(new MenuStore());
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const setMenu = useCallback(
    (options: MenuOption[], onSelect: (value: string) => void) => {
      storeRef.current.setMenu(options, onSelect);
      bump();
    },
    [bump],
  );

  const setActiveIndex = useCallback(
    (index: number | null) => {
      const before = storeRef.current.getActiveIndex();
      const beforeArmed = storeRef.current.getArmed();
      storeRef.current.setActiveIndex(index);
      if (
        before !== index ||
        beforeArmed !== storeRef.current.getArmed()
      ) {
        bump();
      }
    },
    [bump],
  );

  const trigger = useCallback(
    (value: string, focus: FocusZone) => {
      storeRef.current.trigger(value, focus);
      bump();
    },
    [bump],
  );

  const reset = useCallback(() => {
    storeRef.current.reset();
    bump();
  }, [bump]);

  const value = useMemo<MenuContextValue>(() => {
    const s = storeRef.current;
    return {
      options: s.getOptions(),
      onSelect: s.getOnSelect(),
      armed: s.getArmed(),
      armedHint: s.getArmedHint(),
      activeIndex: s.getActiveIndex(),
      setMenu,
      setActiveIndex,
      trigger,
      reset,
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: bumped via setTick
  }, [setMenu, setActiveIndex, trigger, reset]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (ctx === null) {
    throw new Error("useMenu must be used within a MenuProvider");
  }
  return ctx;
}

export type { MenuOption, ArmedState };
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Run biome**

Run: `bun run check`
Expected: no errors. If biome complains, run `bun run fix` and re-check.

- [ ] **Step 4: Commit**

```bash
git add src/tui/states/menu.tsx
git commit -m "feat(menu): add MenuProvider and useMenu hook"
```

---

### Task 2.2: Wrap `App` with `MenuProvider`

**Files:**
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Add the import**

In `src/tui/App.tsx`, add to the imports section near the other state providers:

```tsx
import { MenuProvider } from "./states/menu";
```

- [ ] **Step 2: Wrap the provider tree**

Replace the provider tree inside `App()`:

```tsx
  return (
    <DataProvider>
      <FocusProvider>
        <HelpProvider>
          <LayoutProvider>
            <MenuProvider>
              <FormBufferProvider>
                <NavigationProvider initial={initial}>
                  <Router />
                </NavigationProvider>
              </FormBufferProvider>
            </MenuProvider>
          </LayoutProvider>
        </HelpProvider>
      </FocusProvider>
    </DataProvider>
  );
```

- [ ] **Step 3: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(menu): mount MenuProvider in App"
```

---

### Task 2.3: Switch `Default` layout to read menu fields from `useMenu`

**Files:**
- Modify: `src/tui/layouts/Default.tsx`

- [ ] **Step 1: Update imports and reads**

Replace the existing file with:

```tsx
import { Box, Text, useStdout } from "ink";
import type { JSX, ReactNode } from "react";
import { SelectInput } from "../components/atoms/SelectInput";
import { HelpBar } from "../components/molecules/HelpBar";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";

interface DefaultLayoutProps {
  title: string;
  defaultBorderColor?: string;
  children: ReactNode;
}

export function Default({
  title,
  defaultBorderColor,
  children,
}: DefaultLayoutProps): JSX.Element {
  const { focus } = useFocus();
  const { hints, colors } = useLayout();
  const { options: menuOptions, onSelect: onMenuSelect, armedHint, trigger } =
    useMenu();
  const { stdout } = useStdout();

  const terminalRows = stdout?.rows ?? 24;
  const hasMenu = menuOptions.length > 0 && onMenuSelect !== null;

  const titleHeight = 1;
  const mainBorderHeight = 2;
  const menuHeight = hasMenu ? 3 : 0;
  const helpHeight = 1;
  const reserved = titleHeight + mainBorderHeight + menuHeight + helpHeight;
  const mainHeight = Math.max(3, terminalRows - reserved);

  const activeBorderColor = colors.border ?? defaultBorderColor ?? "cyan";
  const mainBorderColor =
    focus === "main" || focus === "input" ? activeBorderColor : "gray";
  const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";
  const titleColor = colors.title ?? "cyan";

  return (
    <Box flexDirection="column" width="100%">
      <Text bold color={titleColor}>
        {" "}
        {title}
      </Text>

      <Box
        borderStyle="round"
        borderColor={mainBorderColor}
        paddingX={1}
        height={mainHeight}
        flexDirection="column"
      >
        {children}
        {armedHint !== null && (
          <Text color="red">{armedHint}</Text>
        )}
      </Box>

      {hasMenu && (
        <Box borderStyle="round" borderColor={menuBorderColor}>
          <SelectInput
            options={menuOptions}
            onChange={(value) => trigger(value, focus)}
            isActive={focus === "menu"}
          />
        </Box>
      )}

      <Box paddingX={1}>
        <HelpBar hints={hints} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: errors — `useLayout` still returns `menuOptions` and `onMenuSelect`, and screens still call `setMenu` via `useLayout`. We will resolve these in the next tasks; for now the only concern is `Default.tsx` itself compiles. If you see only errors in screen files, proceed.

- [ ] **Step 3: Commit**

```bash
git add src/tui/layouts/Default.tsx
git commit -m "feat(menu): Default layout reads menu fields from useMenu"
```

---

### Task 2.4: Remove menu fields from `useLayout` (LayoutContext) and migrate all setMenu call sites

**Files:**
- Modify: `src/tui/states/layout.tsx`
- Modify: `src/tui/App.tsx` (Router reads `menuOptions` from useLayout — switch to useMenu)
- Modify: every screen that imports `setMenu`/`menuOptions`/`onMenuSelect` from `useLayout` (full list below)

- [ ] **Step 1: Remove menu fields from LayoutContext**

Replace `src/tui/states/layout.tsx` with:

```tsx
import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { HelpHint } from "../models";

export interface LayoutColors {
  border?: string;
  title?: string;
}

interface LayoutContextValue {
  hints: HelpHint[];
  colors: LayoutColors;
  titleSuffix: string | null;
  setHints: (hints: HelpHint[]) => void;
  setColor: (colors: LayoutColors) => void;
  setTitleSuffix: (suffix: string | null) => void;
  resetLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
  children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps): JSX.Element {
  const [hints, setHintsState] = useState<HelpHint[]>([]);
  const [colors, setColorsState] = useState<LayoutColors>({});
  const [titleSuffix, setTitleSuffixState] = useState<string | null>(null);

  const setHints = useCallback((newHints: HelpHint[]) => {
    setHintsState(newHints);
  }, []);

  const setColor = useCallback((next: LayoutColors) => {
    setColorsState(next);
  }, []);

  const setTitleSuffix = useCallback((suffix: string | null) => {
    setTitleSuffixState(suffix);
  }, []);

  const resetLayout = useCallback(() => {
    setHintsState([]);
    setColorsState({});
    setTitleSuffixState(null);
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      hints,
      colors,
      titleSuffix,
      setHints,
      setColor,
      setTitleSuffix,
      resetLayout,
    }),
    [hints, colors, titleSuffix, setHints, setColor, setTitleSuffix, resetLayout],
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (ctx === null) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Update `App.tsx` Router to read `menuOptions` from `useMenu`**

Open `src/tui/App.tsx`. Find:

```tsx
import { LayoutProvider, useLayout } from "./states/layout";
```

Below it, add (or update if not already imported):

```tsx
import { useMenu } from "./states/menu";
```

Then in `Router()`:

```tsx
function Router(): JSX.Element {
  const { currentRoute } = useNavigation();
  const { setMenuAvailable } = useFocus();
  const { titleSuffix } = useLayout();
  const { options: menuOptions } = useMenu();
  const { trip } = useData();

  useGlobalKeys();

  const hasMenu = menuOptions.length > 0;
  useEffect(() => {
    setMenuAvailable(hasMenu);
  }, [hasMenu, setMenuAvailable]);
  // ... rest unchanged ...
```

- [ ] **Step 3: Bulk-migrate screens that destructure `setMenu` from `useLayout`**

For each of the following files, replace the `useLayout` destructure that includes `setMenu` with two hook calls — one for layout fields, one for menu. There are 31 such files; do them one at a time, run typecheck between batches if you prefer, but committing as a single batch is fine since the change is mechanical.

**Find pattern (use the same shape per file):**

```tsx
import { useLayout } from "../states/layout";
// ...
const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
```

**Replace with:**

```tsx
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
// ...
const { setHints, setColor, setTitleSuffix } = useLayout();
const { setMenu } = useMenu();
```

If the original line destructures `setMenu` alongside other layout fields (the common case), split the destructure. If only `setMenu` is destructured, replace entirely with `useMenu()`.

**Files to update (all under `src/tui/screens/`):**

```
AccountDelete.tsx, AccountList.tsx, AccountReferences.tsx, AccountSelect.tsx,
AccountTypeSelect.tsx, CategoryDelete.tsx, CategoryList.tsx, CategorySelect.tsx,
CountryDelete.tsx, CountryList.tsx, CurrencyDelete.tsx, CurrencyList.tsx,
CurrencySelect.tsx, ExpenseDelete.tsx, ExpenseDuplicateSelect.tsx, ExpenseList.tsx,
Export.tsx, OwnerDelete.tsx, OwnerList.tsx, OwnerReferences.tsx, OwnerSelect.tsx,
TagDelete.tsx, TagList.tsx, TagSelect.tsx, TripCreateCountryDelete.tsx,
TripCreateCountryList.tsx, TripDelete.tsx, TripDuplicateSelect.tsx, TripList.tsx,
TripOverview.tsx, TripSettings.tsx
```

For each file, the change is purely an import + destructuring split. Bodies remain unchanged in this task — `setMenu` is called with the same `(options, onSelect)` shape, and the new `MenuOption` type is a strict superset of the old `SelectOption`, so existing calls type-check.

- [ ] **Step 4: Typecheck**

Run: `bun run check:type`
Expected: no errors. If a screen still references `menuOptions` or `onMenuSelect` from `useLayout`, fix it the same way (read from `useMenu`).

- [ ] **Step 5: Run tests**

Run: `bun test`
Expected: PASS — no behavior change yet; the migration is mechanical.

- [ ] **Step 6: Commit**

```bash
git add src/tui/states/layout.tsx src/tui/App.tsx src/tui/screens/
git commit -m "refactor(menu): move setMenu/menuOptions from layout to menu context"
```

---

## Phase 3 — Selector component updates

### Task 3.1: `VerticalSelect` fires `onHighlight(0)` on mount

**Files:**
- Modify: `src/tui/components/atoms/VerticalSelect.tsx`

- [ ] **Step 1: Add the mount effect**

In `src/tui/components/atoms/VerticalSelect.tsx`, add `useEffect` to imports and a new effect at the top of the component body. The relevant changes:

```tsx
import { Box, useInput } from "ink";
import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";
```

Inside the component, after `const [cursor, setCursor] = useState(0);`:

```tsx
  useEffect(() => {
    if (rowCount > 0 && onHighlight) {
      onHighlight(0);
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: fire only on mount
  }, []);
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/atoms/VerticalSelect.tsx
git commit -m "feat(select): fire onHighlight(0) on mount in VerticalSelect"
```

---

### Task 3.2: `ListSelect` — `onHighlight: (value, index)` + `armedRowIndex`

**Files:**
- Modify: `src/tui/components/molecules/ListSelect.tsx`

- [ ] **Step 1: Update the component**

Replace `src/tui/components/molecules/ListSelect.tsx` with:

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface ListSelectProps {
  options: VerticalOption[];
  onChange: (value: string) => void;
  onHighlight?: (value: string, index: number) => void;
  onCancel?: () => void;
  isActive?: boolean;
  color?: string;
  armedRowIndex?: number | null;
}

export function ListSelect({
  options,
  onChange,
  onHighlight,
  onCancel,
  isActive = true,
  color,
  armedRowIndex,
}: ListSelectProps): JSX.Element {
  return (
    <VerticalSelect
      rowCount={options.length}
      renderRow={(i, selected) => {
        const o = options[i];
        if (!o) return null;
        const armed = armedRowIndex === i;
        const rowColor = armed ? "red" : color;
        return (
          <Text
            inverse={selected}
            {...(rowColor !== undefined ? { color: rowColor } : {})}
          >
            {selected ? "> " : "  "}
            {o.label}
            {o.detail ? <Text dimColor={!selected}> {o.detail}</Text> : null}
          </Text>
        );
      }}
      onChange={(i) => {
        const o = options[i];
        if (o) onChange(o.value);
      }}
      {...(onHighlight
        ? {
            onHighlight: (i: number) => {
              const o = options[i];
              if (o) onHighlight(o.value, i);
            },
          }
        : {})}
      {...(onCancel ? { onCancel } : {})}
      isActive={isActive}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: no new errors. (Existing call sites that pass `onHighlight` accept the second argument by widening — but since existing callers use `(value) => ...`, the extra argument is ignored. Compatible.)

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/ListSelect.tsx
git commit -m "feat(select): ListSelect onHighlight gains index, supports armedRowIndex"
```

---

### Task 3.3: `TableSelect` — `onHighlight(index)` + `armedRowIndex`

**Files:**
- Modify: `src/tui/components/molecules/TableSelect.tsx`

- [ ] **Step 1: Update the component**

Replace `src/tui/components/molecules/TableSelect.tsx` with:

```tsx
import { Box, Text } from "ink";
import type { JSX } from "react";
import { VerticalSelect } from "../atoms/VerticalSelect";

export interface TableCell {
  text: string;
  color?: string;
}

interface TableSelectProps {
  headers: string[];
  rows: TableCell[][];
  onChange: (rowIndex: number) => void;
  onHighlight?: (rowIndex: number) => void;
  onCancel?: () => void;
  isActive?: boolean;
  armedRowIndex?: number | null;
}

export function TableSelect({
  headers,
  rows,
  onChange,
  onHighlight,
  onCancel,
  isActive = true,
  armedRowIndex,
}: TableSelectProps): JSX.Element {
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce(
      (max, row) => Math.max(max, (row[i]?.text ?? "").length),
      0,
    );
    return Math.max(h.length, maxData) + 2;
  });

  const padCell = (text: string, i: number): string =>
    text.padEnd(colWidths[i] ?? 0);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>
          {"  "}
          {headers.map((h, i) => padCell(h, i)).join("")}
        </Text>
      </Box>

      <VerticalSelect
        rowCount={rows.length}
        renderRow={(rowIdx, selected) => {
          const row = rows[rowIdx] ?? [];
          const armed = armedRowIndex === rowIdx;
          return (
            <Box>
              <Text inverse={selected} {...(armed ? { color: "red" } : {})}>
                {selected ? "> " : "  "}
              </Text>
              {headers.map((_, colIdx) => {
                const cell = row[colIdx] ?? { text: "" };
                const padded = padCell(cell.text, colIdx);
                const cellColor = armed ? "red" : cell.color;
                return (
                  <Text
                    // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable id here
                    key={colIdx}
                    inverse={selected}
                    {...(cellColor !== undefined ? { color: cellColor } : {})}
                  >
                    {padded}
                  </Text>
                );
              })}
            </Box>
          );
        }}
        onChange={onChange}
        {...(onHighlight ? { onHighlight } : {})}
        {...(onCancel ? { onCancel } : {})}
        isActive={isActive}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tui/components/molecules/TableSelect.tsx
git commit -m "feat(select): TableSelect gains onHighlight + armedRowIndex"
```

---

## Phase 4 — Per-screen rollout (9 list screens)

Each screen task declares `mainAction` on its duplicate/delete menu options and wires `onHighlight`/`armedRowIndex` on its selector. Behavior on the dedicated picker screens (`/trips/delete`, `/trips/expenses/duplicate`, etc.) is untouched.

### Task 4.1: `TripList` — inline `[d]` duplicate + `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/TripList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { today } from "../../core/services/date";
import { deleteTrip, listTrips, sortTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripList(): JSX.Element {
  const { goTo, goBack } = useNavigation();
  const { focus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();

  const { dataDir = "./data" } = useRouteProps("/trips");

  const { clearByPrefix } = useFormBufferAdmin();
  useEffect(() => {
    clearByPrefix("trip-");
  }, [clearByPrefix]);

  const [trips, setTrips] = useState<Trip[]>(() =>
    sortTrips(listTrips(dataDir), today()),
  );

  useEffect(() => {
    setTitleSuffix(null);
    setColor({});

    setMenu(
      [
        { label: "Create", value: "create", key: "c" },
        {
          label: "Duplicate",
          value: "duplicate",
          key: "d",
          mainAction: {
            onConfirm: (i) => {
              const t = trips[i];
              if (!t) return;
              goTo("/trips/new", {
                props: { dataDir, duplicateFromDirPath: t.dirPath },
              });
            },
          },
        },
        {
          label: "Delete",
          value: "delete",
          key: "x",
          mainAction: {
            confirmCount: 2,
            onConfirm: (i) => {
              const t = trips[i];
              if (!t) return;
              deleteTrip(t.dirPath);
              const next = sortTrips(listTrips(dataDir), today());
              setTrips(next);
              if (next.length === 0) {
                goBack();
              }
            },
          },
        },
      ],
      (value) => {
        if (value === "create") {
          goTo("/trips/new", { props: { dataDir } });
        } else if (value === "duplicate" && trips.length > 0) {
          goTo("/trips/duplicate", { props: { dataDir } });
        } else if (value === "delete" && trips.length > 0) {
          goTo("/trips/delete", { props: { dataDir } });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    dataDir,
    trips,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (trips.length === 0) {
    return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

Notes:
- The duplicate flow reuses `/trips/new` with `duplicateFromDirPath` (same as `TripDuplicateSelect.tsx`). There is no separate "duplicate form" route.
- `deleteTrip` is added to the imports.
- `goBack` is destructured from `useNavigation`.
- `setActiveIndex` from `useMenu` is wired to `onHighlight`.

- [ ] **Step 2: Typecheck and lint**

Run: `bun run check:type && bun run check`
Expected: no errors. If lint complains about deps, ensure `goBack`, `trips`, etc. are in the `useEffect` deps.

- [ ] **Step 3: Manual smoke test**

Run: `bun run start` (in a tmux pane or separate terminal). Create at least 2 trips (or use existing data). Verify:
- Focus on main (default), highlight a trip, press `[d]` → `/trips/new` form opens with the highlighted trip prefilled via `duplicateFromDirPath`.
- Focus on main, press `[x]` → row turns red, hint shows. Press `[x]` again → trip deletes. Pressing arrow key first cancels the arm.
- `[tab]` to menu, press `[d]` → picker screen `/trips/duplicate` opens (existing).
- `[tab]` to menu, press `[x]` → picker screen `/trips/delete` opens (existing).

If `/trips/new` does not pre-populate the form fields from `duplicateFromDirPath`, that's an unrelated issue in `TripCreate.tsx` — surface it but proceed (the navigation itself is correct).

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/TripList.tsx
git commit -m "feat(trips): inline [d] duplicate and [x][x] delete on TripList"
```

---

### Task 4.2: `OwnerList` — inline `[x][x]` delete with refs check

**Files:**
- Modify: `src/tui/screens/OwnerList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function OwnerList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus, setFocus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  useEffect(() => {
    if (!trip) return;
    setFocus(trip.owners.length > 0 ? "main" : "menu");
  }, [trip, setFocus]);

  useEffect(() => {
    setTitleSuffix(null);
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const hasOwners = trip.owners.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasOwners
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  check: (i: number) => {
                    const owner = trip.owners[i];
                    if (!owner) return false;
                    const refs = findOwnerReferences(trip, owner.id);
                    if (refs.accounts.length > 0 || refs.expenses.length > 0) {
                      goTo("/trips/owners/references", {
                        props: { tripDirPath, ownerId: owner.id },
                      });
                      return false;
                    }
                    return true;
                  },
                  onConfirm: (i: number) => {
                    const owner = trip.owners[i];
                    if (!owner) return;
                    removeOwner(trip, owner.id);
                    reloadTrip();
                    if (trip.owners.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/owners/new", { props: { tripDirPath } });
        } else if (value === "delete" && hasOwners) {
          goTo("/trips/owners/delete", { props: { tripDirPath } });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.owners.length === 0) {
    return <Text dimColor>No owners yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `bun run check:type && bun run check`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

Start app, navigate to a trip with at least one referenced owner (used in an expense or account) and one clean owner. Verify:
- Highlight referenced owner, press `[x]` → navigates immediately to `/trips/owners/references` (no arm).
- Highlight clean owner, press `[x]` → row red, hint shown. Press `[x]` → deletes.
- Menu focus, press `[x]` → picker screen `/trips/owners/delete` opens.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/OwnerList.tsx
git commit -m "feat(owners): inline [x][x] delete with refs check"
```

---

### Task 4.3: `AccountList` — inline `[x][x]` delete with refs check

**Files:**
- Modify: `src/tui/screens/AccountList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
  findAccountReferences,
  removeAccount,
} from "../../core/services/account";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function AccountList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus, setFocus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  const { clearByPrefix } = useFormBufferAdmin();
  useEffect(() => {
    clearByPrefix("account-");
  }, [clearByPrefix]);

  useEffect(() => {
    if (!trip) return;
    setFocus(trip.accounts.length > 0 ? "main" : "menu");
  }, [trip, setFocus]);

  useEffect(() => {
    setTitleSuffix(null);
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const hasAccounts = trip.accounts.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasAccounts
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  check: (i: number) => {
                    const acc = trip.accounts[i];
                    if (!acc) return false;
                    const refs = findAccountReferences(trip, acc.id);
                    if (refs.expenses.length > 0) {
                      goTo("/trips/accounts/references", {
                        props: { tripDirPath, accountId: acc.id },
                      });
                      return false;
                    }
                    return true;
                  },
                  onConfirm: (i: number) => {
                    const acc = trip.accounts[i];
                    if (!acc) return;
                    removeAccount(trip, acc.id);
                    reloadTrip();
                    if (trip.accounts.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/accounts/new", { props: { tripDirPath } });
        } else if (value === "delete" && hasAccounts) {
          goTo("/trips/accounts/delete", { props: { tripDirPath } });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.accounts.length === 0) {
    return <Text dimColor>No accounts yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

Same pattern as owners — verify referenced account routes to `/trips/accounts/references`, clean account two-presses to delete.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/AccountList.tsx
git commit -m "feat(accounts): inline [x][x] delete with refs check"
```

---

### Task 4.4: `ExpenseList` — inline `[d]` duplicate + `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/ExpenseList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeExpense } from "../../core/services/expense";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./expenseListRow";

export function ExpenseList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus, setFocus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  const { clearByPrefix } = useFormBufferAdmin();
  useEffect(() => {
    clearByPrefix("expense-");
  }, [clearByPrefix]);

  useEffect(() => {
    if (!trip) return;
    setFocus(trip.expenses.length > 0 ? "main" : "menu");
  }, [trip, setFocus]);

  useEffect(() => {
    setTitleSuffix(null);
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const hasExpenses = trip.expenses.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasExpenses
          ? [
              {
                label: "Duplicate",
                value: "duplicate",
                key: "d",
                mainAction: {
                  onConfirm: (i: number) => {
                    const e = trip.expenses[i];
                    if (!e) return;
                    goTo("/trips/expenses/form", {
                      props: { tripDirPath, duplicateFromId: e.id },
                    });
                  },
                },
              },
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const e = trip.expenses[i];
                    if (!e) return;
                    removeExpense(trip, e.id);
                    reloadTrip();
                    if (trip.expenses.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/expenses/form", { props: { tripDirPath } });
        } else if (value === "duplicate" && hasExpenses) {
          goTo("/trips/expenses/duplicate", { props: { tripDirPath } });
        } else if (value === "delete" && hasExpenses) {
          goTo("/trips/expenses/delete", { props: { tripDirPath } });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  if (trip.expenses.length === 0) {
    return <Text dimColor>No expenses yet.</Text>;
  }

  const headers = EXPENSE_LIST_HEADERS;
  const rows = buildExpenseListRows(trip);

  return (
    <TableSelect
      headers={headers}
      rows={rows}
      onChange={(rowIndex) => {
        const expense = trip.expenses[rowIndex];
        if (!expense) return;
        goTo("/trips/expenses/form", {
          props: { tripDirPath: trip.dirPath, expenseId: expense.id },
        });
      }}
      onHighlight={setActiveIndex}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

- Highlight an expense, press `[d]` → goes to expense form with `duplicateFromId`.
- Highlight an expense, press `[x][x]` → deletes; list refreshes.

- [ ] **Step 4: Commit**

```bash
git add src/tui/screens/ExpenseList.tsx
git commit -m "feat(expenses): inline [d] duplicate and [x][x] delete on ExpenseList"
```

---

### Task 4.5: `CountryList` — inline `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/CountryList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function CountryList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  useEffect(() => {
    setTitleSuffix("Settings > Countries");
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const tripName = trip.settings.name;
    const countries = trip.settings.countries;
    const hasItems = countries.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasItems
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const target = countries[i];
                    if (target === undefined) return;
                    const remaining = countries.filter((c) => c !== target);
                    updateSettings(trip.dirPath, { countries: remaining });
                    reloadTrip();
                    if (remaining.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/settings/countries/new", {
            props: { tripDirPath, tripName },
          });
        } else if (value === "delete" && hasItems) {
          goTo("/trips/settings/countries/delete", {
            props: { tripDirPath, tripName },
          });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  const { countries } = trip.settings;

  if (countries.length === 0) {
    return <Text dimColor>No countries yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
bun run check:type
git add src/tui/screens/CountryList.tsx
git commit -m "feat(settings): inline [x][x] delete on CountryList"
```

---

### Task 4.6: `CategoryList` — inline `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/CategoryList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function CategoryList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  useEffect(() => {
    setTitleSuffix("Settings > Categories");
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const tripName = trip.settings.name;
    const categories = trip.settings.categories;
    const hasItems = categories.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasItems
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const target = categories[i];
                    if (target === undefined) return;
                    const remaining = categories.filter((c) => c !== target);
                    updateSettings(trip.dirPath, { categories: remaining });
                    reloadTrip();
                    if (remaining.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/settings/categories/new", {
            props: { tripDirPath, tripName },
          });
        } else if (value === "delete" && hasItems) {
          goTo("/trips/settings/categories/delete", {
            props: { tripDirPath, tripName },
          });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  const { categories } = trip.settings;

  if (categories.length === 0) {
    return <Text dimColor>No categories yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
bun run check:type
git add src/tui/screens/CategoryList.tsx
git commit -m "feat(settings): inline [x][x] delete on CategoryList"
```

---

### Task 4.7: `TagList` — inline `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/TagList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function TagList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  useEffect(() => {
    setTitleSuffix("Settings > Tags");
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const tripName = trip.settings.name;
    const tags = trip.settings.tags;
    const hasItems = tags.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasItems
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const target = tags[i];
                    if (target === undefined) return;
                    const remaining = tags.filter((t) => t !== target);
                    updateSettings(trip.dirPath, { tags: remaining });
                    reloadTrip();
                    if (remaining.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/settings/tags/new", {
            props: { tripDirPath, tripName },
          });
        } else if (value === "delete" && hasItems) {
          goTo("/trips/settings/tags/delete", {
            props: { tripDirPath, tripName },
          });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  const { tags } = trip.settings;

  if (tags.length === 0) {
    return <Text dimColor>No tags yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
bun run check:type
git add src/tui/screens/TagList.tsx
git commit -m "feat(settings): inline [x][x] delete on TagList"
```

---

### Task 4.8: `CurrencyList` — inline `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/CurrencyList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function CurrencyList(): JSX.Element {
  const { trip, reloadTrip } = useData();
  const { focus } = useFocus();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();
  const { goTo, goBack } = useNavigation();

  useEffect(() => {
    setTitleSuffix("Settings > Currencies");
    setColor({});
    if (!trip) return;

    const tripDirPath = trip.dirPath;
    const tripName = trip.settings.name;
    const currencies = trip.settings.currencies;
    const entries = Object.entries(currencies);
    const hasItems = entries.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasItems
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const entry = entries[i];
                    if (!entry) return;
                    const [code] = entry;
                    const { [code]: _unused, ...rest } = currencies;
                    updateSettings(trip.dirPath, { currencies: rest });
                    reloadTrip();
                    if (Object.keys(rest).length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/settings/currencies/new", {
            props: { tripDirPath, tripName },
          });
        } else if (value === "delete" && hasItems) {
          goTo("/trips/settings/currencies/delete", {
            props: { tripDirPath, tripName },
          });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    trip,
    reloadTrip,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (!trip) {
    return <Text dimColor>Loading...</Text>;
  }

  const { currencies } = trip.settings;
  const entries = Object.entries(currencies);

  if (entries.length === 0) {
    return <Text dimColor>No currencies yet.</Text>;
  }

  return (
    <ListSelect
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
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
bun run check:type
git add src/tui/screens/CurrencyList.tsx
git commit -m "feat(settings): inline [x][x] delete on CurrencyList"
```

---

### Task 4.9: `TripCreateCountryList` — inline `[x][x]` delete

**Files:**
- Modify: `src/tui/screens/TripCreateCountryList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryList(): JSX.Element {
  const { focus } = useFocus();
  const { goTo, goBack } = useNavigation();
  const { setHints, setColor, setTitleSuffix } = useLayout();
  const { setMenu, armed, setActiveIndex } = useMenu();

  const { dataDir = "./data", formId = "trip-new" } = useRouteProps(
    "/trips/new/countries",
  );

  const buffer = useFormBuffer(formId);
  const raw = buffer.values["countries"];
  const countries = Array.isArray(raw) ? raw : [];

  useEffect(() => {
    setTitleSuffix("Countries");
    setColor({});
    const hasItems = countries.length > 0;

    setMenu(
      [
        { label: "Add", value: "add", key: "a" },
        ...(hasItems
          ? [
              {
                label: "Delete",
                value: "delete",
                key: "x",
                mainAction: {
                  confirmCount: 2,
                  onConfirm: (i: number) => {
                    const target = countries[i];
                    if (target === undefined) return;
                    const remaining = countries.filter((c) => c !== target);
                    buffer.setField("countries", remaining);
                    if (remaining.length === 0) {
                      goBack();
                    }
                  },
                },
              },
            ]
          : []),
      ],
      (value) => {
        if (value === "add") {
          goTo("/trips/new/countries/new", { props: { dataDir, formId } });
        } else if (value === "delete" && hasItems) {
          goTo("/trips/new/countries/delete", { props: { dataDir, formId } });
        }
      },
    );
    setHints(LIST_HINTS);
  }, [
    dataDir,
    formId,
    countries,
    buffer,
    setMenu,
    setHints,
    setColor,
    setTitleSuffix,
    goTo,
    goBack,
  ]);

  if (countries.length === 0) {
    return <Text dimColor>No countries yet. Press [a] to add one.</Text>;
  }

  return (
    <ListSelect
      options={countries.map((c) => ({ label: c, value: c }))}
      onChange={() => {
        /* read-only navigation; edit is via Delete + Add */
      }}
      onHighlight={(_, i) => setActiveIndex(i)}
      armedRowIndex={armed?.value === "delete" ? armed.index : null}
      isActive={focus === "main"}
    />
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
bun run check:type
git add src/tui/screens/TripCreateCountryList.tsx
git commit -m "feat(trip-new): inline [x][x] delete on country sub-list"
```

---

## Phase 5 — Final verification

### Task 5.1: Full type + lint + test sweep

**Files:** none (commands only).

- [ ] **Step 1: Typecheck**

Run: `bun run check:type`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `bun run check`
Expected: no errors. If errors, run `bun run fix` and review the diff before re-checking.

- [ ] **Step 3: Tests**

Run: `bun test`
Expected: all pass, including the new `menuStore.test.ts`.

- [ ] **Step 4: Commit (only if `bun run fix` made any changes)**

```bash
git add -A
git commit -m "chore: apply biome auto-fixes"
```

Otherwise skip.

---

### Task 5.2: Manual end-to-end verification

**Files:** none (interactive verification).

- [ ] **Step 1: Prepare a test trip**

Run: `bun run start`
Create or open a trip with: at least 2 trips total, at least one owner used in an account or expense (referenced), one unused owner, at least one account used in an expense and one unused, at least 2 expenses, at least 2 countries/categories/tags/currencies.

- [ ] **Step 2: Run through the 10 scenarios from the spec test plan**

Working from `docs/superpowers/specs/2026-05-14-inline-row-actions-design.md` § "Test plan" → "Manual":

1. On each of the 9 list screens, focus on main, press `[d]` (where applicable) on a highlighted row → confirm the duplicate form opens with source prefilled.
2. On each list screen, focus on main, press `[x]` → row red, hint shown. Press `[x]` again → deletes; list refreshes. If list empties, screen navigates back.
3. Arm a row via `[x]`, then arrow down → confirm arm clears.
4. Arm a row, press `[esc]` → confirm navigation back and clean state on return.
5. Arm a row, `[tab]` to menu, `[tab]` back → confirm armed state still on the row.
6. Owners: `[x]` on a referenced row → routes to `/trips/owners/references` with no arm. Accounts: same.
7. Owners/accounts: `[x]` on a clean row arms; second `[x]` deletes.
8. Focus menu, `[d]`/`[x]` on each list → opens the dedicated picker screen.
9. Empty-list screens: no delete/duplicate option visible.
10. `[?]` shows the help bar with current shortcuts.

- [ ] **Step 3: Stop the app and report**

Stop with `[e]` (exit). Report any unexpected behavior to the user before declaring the feature complete.

---

## Self-review (run before handoff)

**Spec coverage:**
- ✅ MenuContext with `mainAction` — Phase 1+2.
- ✅ Two-press `[x][x]` confirm — Task 1.7, 4.x (all list screens).
- ✅ Single-press `[d]` duplicate — Task 1.5, 4.1, 4.4.
- ✅ References check on owners/accounts — Task 4.2, 4.3.
- ✅ Picker screens preserved — Phase 2.4 leaves them untouched; the fall-through path in `trigger` routes menu-focus to `onSelect`, which screens use to `goTo(pickerPath)`.
- ✅ Armed-row red rendering + hint — Task 3.2/3.3 (selectors), Task 2.3 (`Default` renders hint).
- ✅ `activeIndex` cleared on `setMenu` — Task 1.2.
- ✅ Armed cleared on cursor change — Task 1.9.
- ✅ Armed cleared on fall-through — Task 1.10.

**Placeholder scan:** No TBDs, no "implement later", no abstract "add error handling" — every step has full code.

**Type consistency:** `MenuOption`, `ArmedState`, `MenuOptionMainAction` defined once in `menuStore.ts`, re-exported from `menu.tsx`, consumed by every screen. `setMenu(options, onSelect)` signature consistent across `MenuStore`, `MenuContextValue`, and all callers. `onHighlight: (value: string, index: number) => void` on `ListSelect`; `onHighlight: (index: number) => void` on `TableSelect` — different intentionally because table rows have no value abstraction.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-inline-row-actions.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
