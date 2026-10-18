---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Ionic behaviour to work with, not against

Each of these has caused a real bug or a false QA finding in this app.

## `ion-item`

- Horizontal insets are the item's variables: `--padding-start`, `--inner-padding-end` (plus Ionic's own safe-area term). Never write literal `padding-left/right` on an item, and never hand-pad a `div` to line up with item rows: make it an `ion-item`.
- `--min-height` applies to the inner row *inside* `--padding-top/bottom`, so `2rem` + 2 × `0.5rem` padding is a 3rem row.
- The shadow `.item-native` paints at `z-index: 1` with its own background. A pseudo-element on the item host must sit above it (`z-index: 2`) to show.
- Ionic's list stylesheet zeroes borders on `ion-item:only-child` and on the last sliding item, so row components that wrap one item can't rely on `lines`. In a card list the skin handles separators; see `lists.md`.
- A slotted `ion-note` defaults to `align-self: flex-start` with 18px/10px padding. In a card list the skin centres it. Outside one, reset both if the note must line up with the label.

## Form fields

- `ion-input` rewrites its own host classes on every re-render, so Angular's `[class.ion-invalid]`, `[class.ion-touched]` and `errorText` pattern fails silently on blur. Render a field error yourself, directly after the field:

  ```html
  <ion-input … />
  <p class="mh-helper over" role="alert">{{ error }}</p>
  ```

  `ion-input:has(+ .mh-helper.over)` in `theme/components/ion-input.css` paints the field invalid off that sibling, so keep the `<p>` immediately after it.
- Don't bind dynamic `aria-*` on `ion-input`; give it a stable label.

## Searchbars

- Every `ion-searchbar` carries `mhAutofocus` (`_shared/directives/searchbar-autofocus.directive.ts`). It waits for the sheet's `mh-presented` class and for Stencil to render the inner input; `setFocus()` called earlier is a silent no-op.

## Accessible names on Ionic buttons

- Ionic moves `aria-label` from the `ion-button` / `ion-fab-button` host onto the shadow `<button>`. A host query (`ion-button[aria-label]`) finds nothing; that is not a missing label. Check the shadow button (`host.shadowRoot.querySelector('button')`), and in Playwright target `button[aria-label="…"]`.
