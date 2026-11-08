---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Surfaces and sheets in the mobile app

## Surfaces

Every surface reads one of two Ionic tokens: the page and its bars (header, footer, tab bar) `--ion-background-color`, a card, a bubble or a raised box `--ion-card-background`. A context redefines them in `variables.css`; nothing else does (user decision, 2026-10-27).

Light mirrors dark (user decision, 2026-10-27): one page colour for every screen, cards one step off it, a sheet one step further. Dark is grey, as iOS draws it (user decision, 2026-11-01, undoing the navy page of 2026-10-31). Navy stays only on boxes: the hive card and the navy card set.

| Context | Page and bars (light / dark) | Card (light / dark) |
|---|---|---|
| Every page, flat or grouped | white / #1f1f1f | slate-100 / #2c2c2e |
| A sheet (`mh-sheet`) | slate-100 / #2c2c2e | slate-200 / #3a3a3c |

- A soft fill on a card (`--mh-color-divider`, the neutral wash) is the next step again: slate-200 in light, #3a3a3c in dark.
- `--ion-border-color` is one step above that: slate-300 in light, #48484a in dark, so an outline still shows on a sheet's cards.
- Every context sets `--ion-item-background` to the same value as `--ion-card-background`. A card list and its rows paint through Ionic's own item background and set none of their own.
- Muted text is `--ion-color-medium`: slate-600 in light, because slate-500 is under AA on the slate cards (4.3:1). In dark it is slate-400, and slate-300 inside a sheet, where slate-400 is 4.4:1 on the sheet's cards. Never set a muted grey per component; read the token.
- A navy box (a next-session tile, the rest timer, a memory card) reads `--mh-color-navy-card` and its set, never `--mh-navy-900`, so its dark step stays in one place (navy 800, the hive card's).
- A bar is the page it sits on: never give a header or footer toolbar or the tab bar its own `--background`.
- No app bar has a shadow or a hairline: headers (`ion-header.css`), footers (`ion-footer.css`) and the tab bar (`ion-tab-bar.css`). Don't add `ion-no-border` or a `--border-*` to one. Sheets keep the shell's footer hairline.
- Don't mint a token for a surface in one context. Redefine the Ionic token in the context instead.

## Cards and surfaces

- Card surfaces have **no outline**: lists, `ion-card`, heroes, post cards, stat and info boxes, row cards. The card fill (`--ion-card-background`) on the page (`--ion-background-color`) is the edge.
- Borders are kept only where they carry meaning:
  - form controls (inputs, the session form's field buttons)
  - selectable tiles whose border shows the selection (it turns honey when picked)
  - floating overlays (the notification banner)
  - the 3px accent spine on session and invoice rows (`--mh-spine-width`)
- A tinted (wash) card gets its colour from the fill alone; don't add a matching `border-color`.
- Radii come from tokens: `--mh-radius-card` for cards, `--mh-radius-control` for controls and boxes inside a card, `--mh-radius-sheet` for sheet tops, `--mh-radius-pill` for chips.

## Discover's header (the one exception)

Discover's page is design "Discover Header Clean", A, built as drawn (owner, 2026-11-07). On that page only it sets aside three rules above, on purpose: a hairline closes the header (under the city, search and topic chips), the spotlight card (the coaches taking turns, `CoachSpotlight`) is white (the page's colour) with a hairline, and the idle topic chips sit on the card fill in the body ink instead of light navy. Its avatars stand on a point (`DISCOVER_HEX_SHAPE`). The corner print, the outlined honeycomb behind the bar (`cornerPrintPath`, `--mh-color-corner-print`, `--mh-corner-print-opacity`), lives there and nowhere else. Don't copy any of it to another screen, and don't "fix" it back on Discover; whether it spreads is the owner's call once it has been seen on a phone.

## Sheets

- Every bottom sheet is built on `mh-sheet-shell` (or `mh-action-sheet`, `mh-confirm-sheet`, `mh-choice-sheet`, which use it). Don't use `ActionSheetController` or a bare `ion-modal`.
- A sheet is one surface: header, body and footer all on `--ion-background-color`, with cards (`mh-card-list`, boxes on `--ion-card-background`) on top. Never paint the header, body or a box the page colour to make a band or a well.
- A sheet is raised one step above the page in both themes, as iOS does for raised surfaces: the shell's `mh-sheet` class redefines the surface tokens inside the modal (light slate-100 / slate-200, dark `#2c2c2e` / `#3a3a3c`, in `variables.css`), and the dark scrim is `--ion-backdrop-opacity: 0.6`. Keep reading the tokens in sheets; never hardcode the raised colours in a sheet's `.scss`.
- The shell's header is fixed: title, optional subtitle, close X. Don't add header customisation.
- Options inside a sheet are a grouped list (see `lists.md`), not loose `ion-item`s on the sheet background.
- A sheet body made of several cards stacks them in `.mh-stack` (`layout.css`, the page rhythm without the page gutter). Never hand-roll a `flex-direction: column` + gap wrapper for it. A form sheet's labels and helpers keep their own spacing.
- A list of verbs is `mh-action-sheet`: one card for the actions and a separate card for the destructive ones, each with a hex tile.
- Short action menus use `[fit]="true"` (as tall as their content). Sheets with a text field, a growing list or copy of unknown length get a `0.95` breakpoint.
- **A sheet whose action navigates must `await` its `close()` before `router.navigate(...)`.** Setting the `open` model to `false` only queues the binding; routing in the same turn strands the modal on top of the next page for good. Use `viewChild(SheetShell)` (or `ConfirmSheet`), then `await this._sheet()?.close();`. When testing such a flow, assert there is no visible `ion-modal`, not just the URL.
