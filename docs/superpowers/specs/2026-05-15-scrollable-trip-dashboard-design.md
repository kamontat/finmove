# Scrollable Trip Dashboard

## Summary

Make the trip dashboard scrollable with arrow keys when its content height exceeds the available main-box height. Scroll one line per `↑`/`↓` press, clamped to the content. Show a small `↑` / `↓` / `↕` glyph in the bottom-right of the main area when content overflows.

## Goals

- Don't lose information when the terminal is short or the dashboard reflows into many wrapped rows.
- Keep the change localized: introduce one new molecule, touch the dashboard screen and component, leave everything else (layout, list/form screens, navigation, focus model) untouched.

## Non-goals

- Generic scroll behavior for every screen. List screens (`VerticalSelect`) and form screens already own arrow keys; this spec does not touch them.
- Horizontal scrolling.
- Scrollbars. The corner glyph is the only affordance.
- PageUp/PageDown/Home/End. One-line scroll is enough for the dashboard's expected content sizes.

## Architecture

### New molecule: `ScrollableMain`

Lives at `src/tui/components/molecules/ScrollableMain.tsx`. Self-contained — no changes to `useLayout()` or `Default.tsx` are required.

Public shape:

```tsx
interface ScrollableMainProps {
  isActive: boolean;
  children: ReactNode;
}

export function ScrollableMain({ isActive, children }: ScrollableMainProps): JSX.Element
```

Behavior:

- Outer `<Box>` has `flexGrow={1}`, `flexDirection="column"`, `overflow="hidden"`, and a ref. Because it sits inside the Default layout's main box (fixed height, `flexDirection="column"`), `flexGrow={1}` makes it occupy the remaining vertical space.
- Inner `<Box>` has `flexDirection="column"`, `flexShrink={0}`, `marginTop={-offset}`, a ref, and renders `children`.
- After every layout, `measureElement` is called on both refs inside `useEffect`:
  - `viewportHeight` = outer ref's `.height`
  - `contentHeight` = inner ref's `.height`
- `maxOffset = Math.max(0, contentHeight - viewportHeight)`. If `offset > maxOffset` (terminal shrunk, data shrunk, content reflowed), clamp it down.
- `useInput((_, key) => { if (key.upArrow) setOffset(o => Math.max(0, o - 1)); else if (key.downArrow) setOffset(o => Math.min(maxOffset, o + 1)); }, { isActive })`.
- Overflow glyph: when `contentHeight > viewportHeight`, a sibling `<Box position="absolute" bottom={0} right={0}>` (sibling of the inner content box, inside the outer clipping box) renders a single-char `<Text dimColor>`. Because it's positioned absolutely, it does not scroll with the content. Glyph rules:
  - `offset === 0` and more below → `↓`
  - `offset === maxOffset` and more above → `↑`
  - `0 < offset < maxOffset` → `↕`
  - `contentHeight <= viewportHeight` → no glyph (skip rendering the absolute Box entirely)

Edge cases:

- First render: refs not yet attached, `viewportHeight = contentHeight = 0` until the effect fires. `maxOffset = 0`, glyph hidden, behavior is "fits". One re-render later the real numbers arrive. No flicker because nothing has moved yet — `offset` stays at 0.
- Terminal resize: Ink re-renders on `useStdout` change. The measurement effect re-runs; `maxOffset` updates; offset is re-clamped.
- Content change (e.g., trip data refreshed): same path as resize — re-measure, re-clamp.
- `isActive` flips to false (focus moved to menu): `useInput` is gated by `{ isActive }`, so arrow keys stop scrolling. The current `offset` is preserved.

### Wiring into `TripDashboard.tsx`

`TripDashboard` currently returns:

```tsx
<Box flexDirection="column" gap={1}>
  <StatusHeader ... />
  <ProgressBar ... />
  <Box flexDirection="row" flexWrap="wrap" gap={2}> ...five blocks... </Box>
  {status.warnings.length > 0 && <WarningList ... />}
</Box>
```

After:

```tsx
<ScrollableMain isActive={focus === "main"}>
  <Box flexDirection="column" gap={1}>
    <StatusHeader ... />
    <ProgressBar ... />
    <Box flexDirection="row" flexWrap="wrap" gap={2}> ...five blocks... </Box>
    {status.warnings.length > 0 && <WarningList ... />}
  </Box>
</ScrollableMain>
```

`TripDashboard` accepts a new prop:

```tsx
interface Props {
  status: TripStatus;
  isActive: boolean;
}
```

The screen (`TripOverview.tsx`) passes `focus === "main"` from `useFocus()` as `isActive`.

This is the minimal change. The dashboard's existing structure (`StatusHeader`, blocks, `WarningList`) is unchanged.

### Hint bar update in `TripOverview.tsx`

Add `{ key: "↑↓", label: "Scroll" }` to the hints array set by `setHints(...)`. It appears in the help bar (`[?]` to toggle). Harmless when content fits — the hint just doesn't do anything.

## Files changed

- **Create:** `src/tui/components/molecules/ScrollableMain.tsx` — the new component.
- **Modify:** `src/tui/components/organisms/TripDashboard.tsx` — wrap content in `ScrollableMain`, add `isActive` prop.
- **Modify:** `src/tui/screens/TripOverview.tsx` — pass `focus === "main"` to `TripDashboard`, add the `↑↓ Scroll` hint.

No changes to `Default.tsx`, `useLayout`, `useFocus`, navigation, or any list/form/select component.

## Testing

No new tests. The project has no Ink rendering tests by convention and this is purely UI behavior. Live verification:

- Run `bun run start --data-dir <dir-with-large-trip>`, open a trip with enough accounts/expenses/owners to make the dashboard exceed the main-box height.
- Confirm `↓` appears at the bottom-right.
- Press `↓` and verify content shifts up one line per press; once at the bottom, glyph becomes `↑`.
- Press `↑` to scroll back; glyph becomes `↕` in the middle and `↓` at the top.
- Press `[tab]` to move focus to the menu; verify arrow keys stop scrolling.
- Press `[tab]` back to main; arrow keys scroll again, preserving the previous offset.
- Resize the terminal smaller while scrolled; the offset is clamped if needed and the glyph state stays consistent.
- Open a small trip whose dashboard fits entirely — confirm no glyph appears and arrow presses do nothing.

## Risks

- **Ink's `measureElement` runs after layout.** The first paint always shows `offset=0` and no glyph; the corrected glyph appears on the second paint. This is one frame; not user-visible in practice.
- **Negative `marginTop` is supported by Yoga** (Ink's layout engine) — but if a future Ink upgrade rejects it, the fallback is `position="absolute"` + `top={-offset}` on the inner Box. Equivalent semantics. Spec uses `marginTop` for simplicity; the plan can switch if needed.
- **`overflow="hidden"` clips both axes** — fine here because the dashboard's outer container never overflows horizontally (block widths sum to fit within the terminal due to `flexWrap`).
