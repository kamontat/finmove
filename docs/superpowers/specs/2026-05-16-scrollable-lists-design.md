# Scrollable Lists

## Summary

Make every list and table screen scroll automatically when its rows exceed the available main-box height. The user keeps pressing `↑`/`↓` to move the cursor; the viewport follows so the cursor stays visible. A `n/total` position indicator appears in the bottom-right of the list area when the list overflows. Table headers stay pinned at the top.

## Goals

- No information loss when the terminal is short or a list is long.
- One change at the `VerticalSelect` layer covers every consumer (`TableSelect`, `ListSelect`, and any future caller).
- Visual treatment consistent with the dashboard's `ScrollableMain` (corner indicator inside the main box, no scrollbars, no new key bindings).

## Non-goals

- Free-scroll mode (separate from cursor) for lists. The cursor owns `↑`/`↓`; viewport follows automatically.
- PageUp/PageDown/Home/End. Single-line auto-follow is sufficient for current list sizes.
- Horizontal scrolling.
- Visible scrollbars.
- Multi-line rows. All current callers render exactly one line per row; window math assumes that. A future multi-line caller would need to revisit this.
- Replacing or extending `ScrollableMain`. The dashboard keeps its own free-scroll behavior; the two never overlap (dashboard screens don't use `VerticalSelect`).

## Architecture

### Updated atom: `VerticalSelect`

`src/tui/components/atoms/VerticalSelect.tsx`. Public props are unchanged; behavior change is purely internal.

Behavior added:

- An outer `<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">` measures itself via `measureElement` after layout. The `flexGrow={1}` makes it claim all remaining vertical space inside its parent (the Default layout's fixed-height main box, or — for `TableSelect` — the area below the header).
- `viewportHeight` state holds the measured height. The measurement effect re-runs on terminal resize (`stdout.rows`/`stdout.columns` change).
- `visibleRows = Math.max(1, viewportHeight)`. Each rendered row is exactly one line tall.
- `scrollOffset` state holds the top row index of the current window. An effect keyed on `safeCursor`, `visibleRows`, and `rowCount` keeps the cursor inside `[scrollOffset, scrollOffset + visibleRows - 1]`:
  - If `safeCursor < scrollOffset` → `scrollOffset = safeCursor`.
  - If `safeCursor >= scrollOffset + visibleRows` → `scrollOffset = safeCursor - visibleRows + 1`.
  - Otherwise → `scrollOffset = Math.min(scrollOffset, Math.max(0, rowCount - visibleRows))` (re-clamp when `rowCount` or `visibleRows` shrinks).
- The component renders only the slice `[scrollOffset, min(rowCount, scrollOffset + visibleRows))`. `renderRow(idx, …)` still receives the real row index, and the real `idx` is used as the React key — so keys are stable across scrolls.
- Overflow indicator: when `rowCount > visibleRows`, a sibling `<Box position="absolute" bottom={0} right={0}><Text dimColor>{safeCursor + 1}/{rowCount}</Text></Box>` renders inside the clipping box. It does not scroll with the content and does not displace rows.
- `useInput` is unchanged — still gated by `isActive`, still drives the cursor. No new key bindings.

Skeleton (for orientation; the implementation plan can adjust details):

```tsx
const outerRef = useRef<DOMElement>(null);
const [viewportHeight, setViewportHeight] = useState(0);
const [scrollOffset, setScrollOffset] = useState(0);

const { stdout } = useStdout();
const rows = stdout?.rows ?? 0;
const cols = stdout?.columns ?? 0;

useEffect(() => {
  if (!outerRef.current) return;
  setViewportHeight(measureElement(outerRef.current).height);
}, [rows, cols]);

const visibleRows = Math.max(1, viewportHeight);

useEffect(() => {
  setScrollOffset((o) => {
    if (safeCursor < o) return safeCursor;
    if (safeCursor >= o + visibleRows) return safeCursor - visibleRows + 1;
    return Math.min(o, Math.max(0, rowCount - visibleRows));
  });
}, [safeCursor, visibleRows, rowCount]);

const start = scrollOffset;
const end = Math.min(rowCount, start + visibleRows);
const overflowing = rowCount > visibleRows;

return (
  <Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
    <Box flexDirection="column" flexShrink={0}>
      {Array.from({ length: end - start }, (_, i) => {
        const idx = start + i;
        return <Box key={idx}>{renderRow(idx, isActive && idx === safeCursor)}</Box>;
      })}
    </Box>
    {overflowing && (
      <Box position="absolute" bottom={0} right={0}>
        <Text dimColor>{safeCursor + 1}/{rowCount}</Text>
      </Box>
    )}
  </Box>
);
```

### Updated molecule: `TableSelect`

`src/tui/components/molecules/TableSelect.tsx`. The outer column box needs to stretch so the windowed area below the header has bounded height to claim. Required tweak:

```tsx
<Box flexDirection="column" flexGrow={1}>
  <Box flexShrink={0}>{/* header row */}</Box>
  <VerticalSelect ... />
</Box>
```

`flexGrow={1}` on the outer wrapper makes the table fill the main box; `flexShrink={0}` on the header keeps it from collapsing when the row area pushes against it. Column widths (`colWidths`) are still computed across **all** rows, not just visible ones — header alignment stays stable as the user scrolls. The pinned header sits above the windowed rows because it's a sibling box, not part of `VerticalSelect`'s scrollable area.

### `ListSelect`

`src/tui/components/molecules/ListSelect.tsx`. No code change. It renders `<VerticalSelect />` directly; the new `flexGrow={1}` outer box on `VerticalSelect` handles viewport fitting.

### `ScrollableMain` and `Default.tsx`

Not touched. The dashboard's free-scroll behavior is independent. List screens render their `<TableSelect>` or `<ListSelect>` directly into the Default layout's main box, just as today.

## Edge cases

- **Empty list (`rowCount === 0`).** Existing input-gating in `VerticalSelect` is unchanged. List screens short-circuit with an empty-state message before rendering `VerticalSelect`. No indicator.
- **First render before measurement.** `viewportHeight = 0`, so `visibleRows = 1`. Renders one row; one frame later the measurement effect fires and the real window paints. Cursor stays at 0, so no visible flash. Same trade-off accepted by `ScrollableMain`.
- **Terminal resize.** `useStdout` triggers re-render → measurement effect → new `viewportHeight` → auto-follow effect re-clamps `scrollOffset` so the cursor stays visible.
- **Row count shrinks (e.g., after delete).** `safeCursor` is already clamped by existing logic. The auto-follow effect re-runs because `rowCount` is in its deps, and `Math.max(0, rowCount - visibleRows)` prevents empty space at the bottom while rows still exist above.
- **Armed row scrolled out of view.** `TableSelect` passes `armedRowIndex` for delete confirmation styling. If the armed row is outside the window, it isn't rendered, but the armed hint in the main-box footer (rendered by `Default.tsx` via `useMenu().armedHint`) still tells the user a confirmation is pending. The delete action reads `armed.index`, not the cursor, so the armed state isn't affected by scrolling.
- **`isActive = false` (focus on menu).** `useInput` is still gated, so the cursor can't move. The auto-follow effect runs but has nothing to react to. Position indicator stays visible — it reflects position, not focus.
- **Single-line row assumption.** Every current caller (`TableSelect` cells are padded to single-line; `ListSelect` labels are single-line) satisfies this. A future multi-line consumer would need different math; not in scope.

## Files changed

- **Modify:** `src/tui/components/atoms/VerticalSelect.tsx` — add viewport measurement, scroll offset state, auto-follow effect, windowed slice render, absolute-positioned position indicator. New imports from `ink`: `useStdout`, `measureElement`, `DOMElement`.
- **Modify:** `src/tui/components/molecules/TableSelect.tsx` — add `flexGrow={1}` to outer column box, `flexShrink={0}` to header box.
- **No change:** `src/tui/components/molecules/ListSelect.tsx` — works automatically.
- **No change:** `src/tui/components/molecules/ScrollableMain.tsx`, `src/tui/layouts/Default.tsx`, list/select screens.

## Testing

No new automated tests; the project has no Ink rendering tests by convention. Live verification:

- Trip list with row count > terminal height: header stays pinned at top, cursor row is always visible, pressing `↓` past the visible bottom scrolls one row at a time, `n/total` in the bottom-right matches the cursor (1-indexed) and total.
- Expense list with > 30 expenses: same as above. Press `[x]` twice on a row to arm delete, scroll the cursor, confirm the armed hint stays visible in the main-box footer.
- Resize the terminal smaller while the cursor is near the bottom: window re-clamps so the cursor stays visible; `n/total` updates.
- Short list that fits entirely: no `n/total` indicator, behavior unchanged from today.
- `OwnerList`, `AccountList`, `CategoryList`, `CurrencyList`, `CountryList`, `TagList`, `OwnerSelect`, `AccountSelect`, etc.: confirm no regression.
- `[tab]` to menu while a list is overflowing: arrow keys no longer move cursor; `n/total` stays.
- `[tab]` back to main: cursor & scroll resume from previous position.

## Risks

- **First-frame flash.** `visibleRows = 1` for one frame before measurement lands. Identical to what `ScrollableMain` accepts; not user-visible in practice.
- **`measureElement` returns 0 before layout.** Handled by `Math.max(1, viewportHeight)` and the re-clamp on the next effect run when the real height arrives.
- **Stable React keys across scrolls.** We use the real row index as the key, not the position within the slice — so scrolling doesn't remount rows or break input focus.
- **Column-width recomputation.** Widths are computed over all rows, so header alignment is stable as the window moves; the trade-off is that an O(rows × cols) sweep happens on every render — same as today, no regression.
