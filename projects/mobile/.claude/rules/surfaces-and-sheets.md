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
- Radii come from tokens: `--mh-radius-card` for cards, `--mh-radius-control` for controls and boxes inside a card, `--mh-radius-sheet` for sheet tops, `--mh-radius-pill` for filter chips and dots.
- **A button with words is never round** (user decisions, 2026-11-17). Only icon-only buttons and filters may be round, and an icon-only button may be square too (user clarification, same day): the ⋯, a close X, the honey "+" and send are circles, the remove square beside a stepper (`.mh-remove`) is a square on `--mh-radius-control`. A button with words is a rounded rectangle on `--mh-radius-control` at every size, never a capsule: the block CTA ("Save and start"), a header's Save or Finish, a row verb (Resume, Invite, Join, Start), an option chip in a form (goals, muscles, venue kind, a chip input's words, share options), Home's role switch, Discover's city, and native buttons alike (the logger's "Back to…", a plan's Rest and Link chips, the session form's tiles and weekday letters, the program builder's week numbers). The theme gives an `ion-button` the radius (`ion-button.css`), so it carries no `shape="round"`.
  - `shape="round"` stays on icon-only buttons (the ⋯, a close X, the honey "+", send) and on filter chips: the filter strips (in a header or on a page) and the filter sheets' chip groups, with the Filters and calendar buttons and the narrowed day's `mh-day-chip`. A chip row that is not a filter (a person's groups, the copy-day picker) is square-cornered like any other button.
  - One exception: the short exercise form's muscle and equipment chips (`exercise-form-sheet`) are pills, like the exercise filter sheet's (user decision, 2026-11-17, on seeing the sheet).

## Discover's header (the one exception)

Discover's page is design "Discover Header Clean", A, built as drawn (owner, 2026-11-07). On that page only it sets aside three rules above, on purpose: a hairline closes the header (under the city, search and topic chips), the spotlight card (the coaches taking turns, `CoachSpotlight`) is white (the page's colour) with a hairline, and the idle topic chips sit on the card fill in the body ink instead of light navy. Its avatars stand on a point (`DISCOVER_HEX_SHAPE`). The corner print, the outlined honeycomb behind the bar (`cornerPrintPath`, `--mh-color-corner-print`, `--mh-corner-print-opacity`), lives there and nowhere else. Don't copy any of it to another screen, and don't "fix" it back on Discover; whether it spreads is the owner's call once it has been seen on a phone.

## Sheets

- Every bottom sheet is built on `mh-sheet-shell` (or `mh-action-sheet`, `mh-confirm-sheet`, `mh-choice-sheet`, which use it). Don't use `ActionSheetController` or a bare `ion-modal`.
- A sheet is one surface: header, body and footer all on `--ion-background-color`, with cards (`mh-card-list`, boxes on `--ion-card-background`) on top. Never paint the header, body or a box the page colour to make a band or a well.
- A sheet is raised one step above the page in both themes, as iOS does for raised surfaces: the shell's `mh-sheet` class redefines the surface tokens inside the modal (light slate-100 / slate-200, dark `#2c2c2e` / `#3a3a3c`, in `variables.css`), and the dark scrim is `--ion-backdrop-opacity: 0.6`. Keep reading the tokens in sheets; never hardcode the raised colours in a sheet's `.scss`.
- The shell's header is fixed: title, optional subtitle, close X. Don't add header customisation.
- A sheet has one inset, the body's `--ion-padding` (16px), in both modes (user decision, 2026-11-09): the title's text, the close X's glyph, the pinned strip (a search field, a chip strip's first chip) and the footer's buttons all line up with the cards. The shell sets it, and the searchbar skin drops Ionic's own side padding on every sheet's field (`ion-modal.mh-sheet ion-searchbar`, `ion-searchbar.css`), so a sheet's own `.scss` never pads or unpads its searchbar; a chip strip in the pinned strip bleeds out by the inset and pads back in by it.
- Options inside a sheet are a grouped list (see `lists.md`), not loose `ion-item`s on the sheet background.
- A sheet body made of several cards stacks them in `.mh-stack` (`layout.css`, the page rhythm without the page gutter). Never hand-roll a `flex-direction: column` + gap wrapper for it. A form sheet's labels and helpers keep their own spacing.
- A list of verbs is `mh-action-sheet`: one card for the actions and a separate card for the destructive ones, each with a hex tile.
- A sheet is as tall as what it says (`[fit]="true"`) unless it holds something to type into: action menus, `mh-confirm-sheet` and an `mh-choice-sheet` without a search field are all `fit`. A long one stops under the top safe area and its body scrolls, so copy of unknown length or a list that grows (Discover's cities) fits too (`ion-modal.css`, `.mh-sheet-fit`). A sheet with a text field or a search field gets a `0.95` breakpoint instead: the keyboard takes the bottom half, and a fitted sheet would sit under it.
- **A sheet whose action navigates must `await` its `close()` before `router.navigate(...)`.** Setting the `open` model to `false` only queues the binding; routing in the same turn strands the modal on top of the next page for good. Use `viewChild(SheetShell)` (or `ConfirmSheet`), then `await this._sheet()?.close();`. When testing such a flow, assert there is no visible `ion-modal`, not just the URL.
