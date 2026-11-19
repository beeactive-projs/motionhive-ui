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

## Page lifecycle

- `ionViewWillEnter` fires on the page underneath as soon as an iOS edge swipe back starts, and nothing undoes it if the swipe is let go. Keep it to what is safe to run twice. Clear a one-shot flag and switch `IonRouterOutlet.swipeGesture` in `ionViewDidEnter`, which fires only when the entry completes: switching the gesture off mid-drag snapped every swipe back and left it dead (the routine builder and the logger, 2026-11-17).
- `swipeGesture = false` stops only iOS's edge swipe. Android's back, the button and the system's swipe in from either edge, still pops the page. A page that asks before it is left (the logger, the routine builder) also takes the back with `Platform.backButton.subscribeWithPriority(PAGE_BACK_PRIORITY, …)` in `ionViewDidEnter` and lets go in `ionViewWillLeave` (`_shared/utils/swipe-back.ts`; the logger popped with the workout still running until 2026-11-18).
- A tab tap lands on the tab's first page (`navigateRoot`, user decision) and destroys every page above it in that stack. State that must outlive a tab switch lives outside the page; the routine builder parks its draft in `RoutineDraftStore`. A link straight to a page's own URL from another tab (Home's "+ → Routine") reuses the cached page instead.

## Floating controls over a list

- A touch that starts on a `slot="fixed"` element never scrolls `ion-content`: the fixed slot sits outside the scroller. A wide control there, in the middle of the screen where a thumb starts a swipe, makes the list refuse to scroll, and a short flick on it reads as a tap. The logger's "Back to…" pill did both (2026-11-17): the list would not go down past it and kept jumping back to the set in progress.
- Inside the scroller is not enough either. Moved into a zero-height `position: sticky` strip at the end of the content, the pill still jumped the list back up on a phone, because a short flick that starts on a button there still lands as a tap. It was removed (user decision, 2026-11-18), and with it the scroll after a tick: the logger opens on the set in progress, once, and after that the list moves only when the person moves it (and to keep a set above the number pad).
- So don't put a wide tappable control over a scrolling list, where a thumb starts a swipe. If one is ever needed, keep it small and to a side.
- `slot="fixed"` stays right for what is not touched mid-scroll: `ion-refresher`, a decorative background, an `ion-fab` in a corner.

## Searchbars

- Every `ion-searchbar` carries `mhAutofocus` (`_shared/directives/searchbar-autofocus.directive.ts`). It waits for the sheet's `mh-presented` class and for Stencil to render the inner input; `setFocus()` called earlier is a silent no-op.
- Every component with an `ion-searchbar` imports `SearchbarLabelDirective` (`_shared/directives/searchbar-label.directive.ts`; its selector is the bare element). Ionic hardcodes `aria-label="search text"` on the inner input and never copies the host's, so without it every field is announced as "search text", in English in Romanian too. Give the host an `aria-label` when the placeholder is not the field's name; the directive falls back to the placeholder. Check `ion-searchbar input`'s `aria-label`, not the host's.

## Accessible names on Ionic buttons

- Ionic moves `aria-label` from the `ion-button` / `ion-fab-button` host onto the shadow `<button>`. A host query (`ion-button[aria-label]`) finds nothing; that is not a missing label. Check the shadow button (`host.shadowRoot.querySelector('button')`), and in Playwright target `button[aria-label="…"]`.
- Every `ion-back-button` carries `[attr.aria-label]="'a11y.back' | translate"`. Without it Ionic names the button with its English default "back" (`backButtonText` is empty in `app.config.ts`, so there is no text to fall back on).

## The keyboard

- A page with text fields over a footer of buttons carries `mhKeyboardFooter` on its `ion-footer` (`_shared/directives/keyboard-footer.directive.ts`, first used on the welcome flow). On iOS the bar rides up with the keyboard on `keyboardWillShow` (the plugin's late body resize is held off while the page is shown, as in the chat), and the focused field, with whatever is marked `data-mh-keyboard-block` around it (its chips, its results), is kept above the raised bar. On both platforms the bar keeps only its buttons while the keyboard is up (`mh-keyboard-open`), and the keyboard closes on a tap outside a field, a drag of the content, and leaving the page. Call its `dismiss()` before a footer or header button acts. The chat keeps its own, built on the same helpers (`_shared/utils/keyboard.ts`).
- A control that must keep the keyboard up (an Add, a chip's remove) keeps the field's focus by cancelling `mousedown`, and carries `data-mh-keeps-keyboard`. Not `pointerdown`: cancelled on a touch, WebKit drops the tap's click and the button does nothing.
- Words that become chips (a coach's own specialities, a group's tags) are `mh-chip-input` (`_shared/components/chip-input/`), not a comma separated field. The coaching sheet's specialities field is still to move.
