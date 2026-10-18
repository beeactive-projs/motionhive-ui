---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Surfaces and sheets in the mobile app

## Cards and surfaces

- Card surfaces have **no outline**: lists, `ion-card`, heroes, post cards, stat and info boxes, row cards. The card fill (`--ion-card-background`) on the grey page (`--ion-background-color`) is the edge.
- Borders are kept only where they carry meaning:
  - form controls (inputs, the session form's field buttons)
  - selectable tiles whose border shows the selection (it turns honey when picked)
  - floating overlays (the notification banner)
  - the 3px accent spine on session and invoice rows (`--mh-spine-width`)
- A tinted (wash) card gets its colour from the fill alone; don't add a matching `border-color`.
- Radii come from tokens: `--mh-radius-card` for cards, `--mh-radius-control` for controls and boxes inside a card, `--mh-radius-sheet` for sheet tops, `--mh-radius-pill` for chips.

## Sheets

- Every bottom sheet is built on `mh-sheet-shell` (or `mh-action-sheet`, `mh-confirm-sheet`, `mh-choice-sheet`, which use it). Don't use `ActionSheetController` or a bare `ion-modal`.
- A sheet is one surface: header, body and footer all on `--ion-background-color`, with white cards (`mh-card-list`, boxes on `--ion-card-background`) on top. Never paint the header, body or a box the page colour to make a band or a well.
- The shell's header is fixed: title, optional subtitle, close X. Don't add header customisation.
- Options inside a sheet are a grouped list (see `lists.md`), not loose `ion-item`s on the sheet background.
- A list of verbs is `mh-action-sheet`: one card for the actions and a separate card for the destructive ones, each with a hex tile.
- Short action menus use `[fit]="true"` (as tall as their content). Sheets with a text field, a growing list or copy of unknown length get a `0.95` breakpoint.
- **A sheet whose action navigates must `await` its `close()` before `router.navigate(...)`.** Setting the `open` model to `false` only queues the binding; routing in the same turn strands the modal on top of the next page for good. Use `viewChild(SheetShell)` (or `ConfirmSheet`), then `await this._sheet()?.close();`. When testing such a flow, assert there is no visible `ion-modal`, not just the URL.
