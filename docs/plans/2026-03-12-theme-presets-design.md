# Theme Presets Design

## Goal

Add a theme preset selector to settings so the app can switch between the current built-in look and a new `everforest` preset derived from the local Ghostty configuration, while preserving the existing `light` / `dark` / `system` theme mode behavior.

## Current State

- The app currently stores one configurable palette pair in `appearance.theme_palettes`.
- Theme choice is split into `light`, `dark`, or `system` via `appearance.theme_preference`.
- There is no preset layer, so all UI and terminal colors always come from the same stored palette pair.
- The local Ghostty config already provides an Everforest-style light palette that can serve as the source of truth for the new preset.

## Design

### Theme Model

Introduce a new `appearance.theme_preset` field with these values:

- `default`
- `everforest`

`theme_preference` remains unchanged and still controls whether the selected preset resolves to its light palette, dark palette, or follows the system theme.

### Preset Behavior

- `default` continues to use the current `appearance.theme_palettes` values.
- `everforest` uses built-in static palette definitions in the frontend.
- The existing palette customization mechanism remains intact for `default`; it does not apply to `everforest`.

### Everforest Palette Source

- `everforest.light` is based on `/Users/mannix/.config/ghostty/config` and `/Users/mannix/.config/ghostty/everforest-light`.
- `everforest.dark` is a matching dark companion palette built in the same color family so `system` mode stays meaningful.

### Settings UX

In the Appearance settings panel:

1. Add a new select field for theme preset.
2. Keep the existing `light` / `dark` / `system` radios below it.
3. Update helper text so users understand:
   - `Default` can still be customized via `preferences.json`
   - `Everforest` is a built-in preset

### Persistence and Migration

- Add `theme_preset` to the Rust settings model.
- Default missing or invalid values to `default`.
- Bump settings schema version so normalized settings are persisted back out with the new field.
- Do not mutate existing stored `theme_palettes` beyond current normalization rules.

## Testing

### Frontend

- Add pure logic tests for:
  - preset normalization
  - resolving `default` vs `everforest`
  - verifying key Everforest light values match the local Ghostty source

### Backend

- Add settings normalization tests for:
  - missing `theme_preset` falls back to `default`
  - valid `everforest` survives normalization

## Non-Goals

- No user-editable custom preset management
- No import/export of Ghostty themes
- No changes to the updater or release flow
