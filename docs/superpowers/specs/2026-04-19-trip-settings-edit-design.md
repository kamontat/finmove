# Trip Settings Edit — Design Spec

## Problem

Trip settings (name, dates, countries, currencies, categories, tags, export path) are written once during creation and cannot be modified afterward. Users need the ability to edit all settings fields after a trip is created.

## Constraints

- The trip directory name (slug) is never changed, regardless of name edits.
- `baseCurrency` (THB) is not editable.
- Changes persist immediately to `settings.yaml` on save/action.

## Core Layer

### New Service: `updateSettings`

**File:** `src/core/services/trip/updateSettings.ts`

- Signature: `updateSettings(tripPath: string, updates: Partial<Settings>) => void`
- Loads the current `settings.yaml`, deep-merges the updates, writes back.
- Does not modify `baseCurrency` even if included in updates.
- Exported from `src/core/services/trip/index.ts`.

No new models are required — the existing `Settings` interface covers all fields.

## TUI Layer

### Route: `/trips/settings` — TripSettings Screen

**File:** `src/tui/screens/TripSettings.tsx`

A hybrid screen combining a Form for simple fields with menu navigation for complex fields.

**Form fields (simple):**

| Field       | Type | Notes                  |
|-------------|------|------------------------|
| Name        | text | Trip display name      |
| Start Date  | date | Date picker            |
| End Date    | date | Date picker            |
| Export Path | text | File system path       |

**Menu items (complex fields):**

| Label      | Route                        |
|------------|------------------------------|
| Countries  | `/trips/settings/countries`  |
| Categories | `/trips/settings/categories` |
| Tags       | `/trips/settings/tags`       |
| Currencies | `/trips/settings/currencies` |

- Submitting the form calls `updateSettings` with changed simple fields.
- Sets `titleSuffix` to `"Settings"` for breadcrumb context.

### Route: `/trips/settings/countries` — TripSettingsCountries Screen

**File:** `src/tui/screens/TripSettingsCountries.tsx`

Manages the `countries: string[]` array.

- Displays current countries as a selectable list.
- Menu: **[a] Add** (text input for new country), **[d] Delete** (remove highlighted item).
- Saves immediately via `updateSettings`.
- Sets `titleSuffix` to `"Settings > Countries"`.

### Route: `/trips/settings/categories` — TripSettingsCategories Screen

**File:** `src/tui/screens/TripSettingsCategories.tsx`

Manages the `categories: string[]` array. Same UX pattern as countries.

- Menu: **[a] Add**, **[d] Delete**.
- Sets `titleSuffix` to `"Settings > Categories"`.

### Route: `/trips/settings/tags` — TripSettingsTags Screen

**File:** `src/tui/screens/TripSettingsTags.tsx`

Manages the `tags: string[]` array. Same UX pattern as countries.

- Menu: **[a] Add**, **[d] Delete**.
- Sets `titleSuffix` to `"Settings > Tags"`.

### Route: `/trips/settings/currencies` — TripSettingsCurrencies Screen

**File:** `src/tui/screens/TripSettingsCurrencies.tsx`

Manages the `currencies: Record<string, CurrencyConfig>` map.

- Displays list items as `CODE — rate` (e.g., `JPY — 0.23`).
- Menu: **[a] Add** (two-step input: currency code, then exchange rate), **[d] Delete** (remove highlighted), **[e] Edit** (edit exchange rate of highlighted item).
- Saves immediately via `updateSettings`.
- Sets `titleSuffix` to `"Settings > Currencies"`.

### Router Updates

**File:** `src/tui/router.ts`

Add 5 new routes:

| Path                          | Component                | Title             |
|-------------------------------|--------------------------|-------------------|
| `/trips/settings`             | TripSettings             | Settings          |
| `/trips/settings/countries`   | TripSettingsCountries    | Countries         |
| `/trips/settings/categories`  | TripSettingsCategories   | Categories        |
| `/trips/settings/tags`        | TripSettingsTags         | Tags              |
| `/trips/settings/currencies`  | TripSettingsCurrencies   | Currencies        |

Border colors should be consistent with existing trip screens.

### TripMenu Update

**File:** `src/tui/screens/TripMenu.tsx`

Add a **Settings** menu item with shortcut key `[s]` that navigates to `/trips/settings`.

## File Summary

| Action | File                                          |
|--------|-----------------------------------------------|
| Create | `src/core/services/trip/updateSettings.ts`    |
| Create | `src/tui/screens/TripSettings.tsx`            |
| Create | `src/tui/screens/TripSettingsCountries.tsx`   |
| Create | `src/tui/screens/TripSettingsCategories.tsx`   |
| Create | `src/tui/screens/TripSettingsTags.tsx`         |
| Create | `src/tui/screens/TripSettingsCurrencies.tsx`   |
| Modify | `src/core/services/trip/index.ts`             |
| Modify | `src/tui/router.ts`                           |
| Modify | `src/tui/screens/TripMenu.tsx`                |
