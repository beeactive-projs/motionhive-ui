---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Lists in the mobile app

Grouped lists follow the iOS inset-grouped look (iOS Mail "Mailboxes", WhatsApp settings and sheets). [`theme/components/ion-list.css`](../../src/theme/components/ion-list.css) is the single source of the skin; rows only lay out their own parts.

## The card

- A grouped list is `<ion-list [inset]="true" class="mh-card-list">`. Nothing else makes a card list: no hand-rolled bordered `div` around `ion-item`s, no `ion-list [inset]` without the class.
- The card has no outline and a `--mh-radius-card` radius; its fill lifts it off the grey page. Never add a border to it.
- Place it with the page layout (`.mh-page`, `.mh-section`), never with a margin on the list.

## Rows

- Rows are bare `ion-item`s, `mh-settings-row`, or a row component wrapping one `ion-item` (`ion-item-sliding` included). Any mix works in one list.
- Inside a card list, rows **never** set:
  - `lines` (Ionic's lines are switched off; the skin draws the separator)
  - `--border-*`, `--inner-border-width`, or a host `border-block-end`
  - `--min-height`, `--padding-*`, `--inner-padding-end`
  - `--detail-icon-color` / `--detail-icon-opacity`
  - a `margin-inline-end` on the leading item
- Rows are 3rem at least, padded by `--mh-row-gutter`. Use `[detail]="true"` for the chevron, never a hand-placed `chevron-forward` icon in `slot="end"`.
- Everything in a row sits on its centre line: tile, label, notes in either slot, trailing controls. Never `align-self: flex-start` or a `margin-top` nudge on a leading item.

## Separators

- One hairline per row, drawn by the skin: from where the label starts to a gutter short of the trailing edge, none under the last row, colour `--mh-color-separator`.
- The start is computed from the leading item's width, `--mh-row-lead`. Hex tiles set it from their `data-size`. A row with its own leading item (a weekday kicker, a week label) sets `--mh-row-lead` to that item's width on those rows, page-scoped:

  ```scss
  .dow { width: 2.5rem; }
  ion-item:has(> .dow) { --mh-row-lead: 2.5rem; }
  ```

- A new hex size used as a leading item needs its `--mh-row-lead` rule in `ion-list.css`.

## Leading icons

- A leading icon is a hex tile, `<mh-hex-avatar slot="start" size="sm" [icon]="…" [color]="…" />`, never a bare `<ion-icon slot="start">`. People and entities (avatars, logos, exercise thumbnails) use `md`.
- A decorative tile has no `name` (nothing announced); the label says what the row is.
- Colour the tile by what the row is about, and keep a concept's colour the same on every screen:

  | Concept | Colour |
  |---|---|
  | Personal details: email, phone, location, language, timezone, member since | from [`DETAIL_TILES`](../../src/app/_shared/config/detail-tiles.config.ts), never literals |
  | calendar, info, link, share, documents | `info` |
  | place, venue, video call, public / open | `teal` |
  | people, members, private / locked by choice | `violet` |
  | time, deadlines, cancellation windows | `coral` |
  | money, prices, payments, done | `success` |
  | delete, sign out, block, alerts and notifications | `danger` |
  | a row that creates or edits something | `primary` |
  | something that is off or unavailable | `medium` (never the default) |

- Neighbouring rows in one card take different hues. If two rows would collide, move the less specific one.
- A tile repeated down a content list (exercises, routines, notifications) uses `tone="wash"`; a settings or detail row uses the base tone.

## Trailing values

- A trailing value or count is `<ion-note slot="end">` at the label's size (`--mh-text-base`) in the muted ink: secondary by colour, not by shrinking. Don't set a `font-size` on it.
- A long value ellipsises on one line and never squeezes the label (see `mh-settings-row`).

## Settings rows

- Use `mh-settings-row` for a settings or account row (tile, label, value or badge, chevron) instead of rebuilding it from `ion-item`.
- Values come translated; an empty value shows `valuePlaceholder` ("Not provided"), never a blank.
