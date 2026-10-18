---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Lists in the mobile app

There are two kinds of list, and every `ion-list` is one of them. [`theme/components/ion-list.css`](../../src/theme/components/ion-list.css) is the single source of both skins; rows only lay out their own parts.

| | Grouped list (`mh-card-list`) | Feed list (`mh-feed-list`) |
|---|---|---|
| Looks like | iOS Mail "Mailboxes", WhatsApp settings and sheets | WhatsApp's chat list |
| For | settings, details, options, verbs, short fixed sets | the content of a screen: conversations, people, search results, notifications, activity |
| Shape | white cards with rounded corners on the slate page, inside `.mh-page` | white rows edge to edge, straight in `ion-content` |
| Rows | one line, a small tile, a value or chevron | a large avatar and two lines, a title with its time and a preview with its badges |

Grouped lists are described first; the feed list has its own section at the end. Both share the separator.

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

- One hairline per row, drawn by the skin: from where the label starts to a gutter short of the trailing edge (under the end of the trailing value or time, in both kinds), none under the last row, colour `--mh-color-separator`.
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
  | calendar, info, link, share, documents; notifications, reminders, mute | `info` (`tone="shade"`) |
  | place, venue, video call, public / open | `teal` |
  | people, members, private / locked by choice | `violet` |
  | time, deadlines, cancellation windows | `coral` |
  | money, prices, payments, done | `success` |
  | destructive verbs only: delete, remove, block, cancel, archive, leave, discard, sign out | `danger` |
  | a row that creates or edits something | `primary` |
  | something that is off or unavailable | `medium` (never the default) |

- **Red is for destruction only.** A tile, label or option is `danger` only when the row destroys, cancels, ends or cuts something off. Notifications, alerts, warnings, "off" states and anything merely important are never red. In an action sheet, mark the verb `destructive: true` (the sheet paints it red and moves it to its own card) instead of setting `color: 'danger'`.
- Neighbouring rows in one card take different hues. If two rows would collide, move the less specific one.
- A tile repeated down a content list (exercises, routines, notifications) uses `tone="wash"`; a settings or detail row uses the base tone.

## Trailing values

- A trailing value or count is `<ion-note slot="end">` at the label's size (`--mh-text-base`) in the muted ink: secondary by colour, not by shrinking. Don't set a `font-size` on it.
- A long value ellipsises on one line and never squeezes the label (see `mh-settings-row`).

## Settings rows

- Use `mh-settings-row` for a settings or account row (tile, label, value or badge, chevron) instead of rebuilding it from `ion-item`.
- Values come translated; an empty value shows `valuePlaceholder` ("Not provided"), never a blank.

## Feed lists

The WhatsApp chat list. First use: the Messages inbox ([`messages.html`](../../src/app/main/messages/messages.html), [`conversation-row`](../../src/app/main/messages/_components/conversation-row/conversation-row.html)). Use it for any screen whose content is a long run of people or items, not for settings or details.

### The list and its page

- A feed list is `<ion-list class="mh-feed-list">`, without `[inset]`. It sits straight in `ion-content`, outside `.mh-page`; the rows run edge to edge.
- While the feed is on screen, bind `[class.mh-feed-page]` on `ion-content` (from `layout.css`) so the page takes the rows' white. Drop it for empty and error states, which need the slate page.
- A label over a feed (search's "People", "Messages") is a `.mh-section-label` directly before the list. The skin moves it onto the row gutter.
- The header over a feed carries `class="mh-feed-header"` on `ion-header` ([`ion-header.css`](../../src/theme/components/ion-header.css)). It puts the title, the end buttons, the search field, the back arrow and the `.mh-chip-row` pills on `--mh-row-gutter`, so they line up with the avatars on the left and with the row times on the right. Don't pad these parts per page. It also drops Ionic's md header shadow: header and feed are one white surface.
- The first row of a feed has a hairline above it as well (drawn by the skin, same inset as the separators). That line, not a shadow or a border on the header, is the seam between header and list.

### Rows

- A row is one `ion-item` (bare, or in `ion-item-sliding`, or in a row component). It never sets `lines`, `--border-*`, `--padding-*` or `--min-height`; the skin gives every row 0.75rem above and below.
- No chevron: `detail="false"`. The whole row is the tap target, as in WhatsApp.
- The leading item is an `mh-hex-avatar` at `size="lg"` (3.25rem), centred on the row. A skeleton's block is 3.25rem too and sets `--mh-row-lead: 3.25rem` on its row, so its separator starts where the real rows' text does.
- The label holds the two lines. Trailing items go **in** the line they belong to, never in `slot="end"`:

  ```html
  <ion-label>
    <div class="mh-feed-line">
      <h2>{{ name }}</h2>
      <ion-note>{{ time }}</ion-note>
    </div>
    <div class="mh-feed-line">
      <p>{{ preview }}</p>
      <ion-badge color="primary">{{ count }}</ion-badge>
    </div>
  </ion-label>
  ```

  `.mh-feed-line` lets the first child take the space and ellipsis on one line, and keeps whatever follows it whole. A row with no time or badge can use a bare `<h2>` and `<p>`.
- Type comes from the skin: the title is Inter 600 at `--mh-text-md`, the second line `--mh-text-base` in `--ion-color-medium`, a note in a line `--mh-text-sm`. Don't restate them in the row. A row adds only its own states (an unread row lifts the preview to `--ion-text-color` and the time to `--mh-color-honey-deep`).
- Each line is a 1.5rem box (set by the skin), so a feed row is exactly 4.5rem. Don't put anything taller than 1.5rem in a line, and don't change a line's height or leading in a row. A row a fraction of a pixel off (the text's own 1.55 leading gave 72.047px) moves every separator below it off the pixel grid, and the ones that straddle two pixels draw thicker.
- Full ink in a row is `--ion-text-color`. `--ion-color-dark` is a dim slate in the dark palette.
- Swipe actions follow WhatsApp: `ion-item-option`s with the icon over the label (`slot="top"`), and the row closes after a tap.

### Next adopters (planned)

Notifications and Clients move to the feed list next. Both still use `mh-card-list` today. Use the Messages inbox as the template for the list, header (`mh-feed-header`, search, `.mh-chip-row`), `mh-feed-page`, rows, swipes and skeletons. Settle these adjustments when each screen is done, then record them here:

- **Notifications**: most rows have no person behind them, so decide what the leading item is (a hex tile at the avatar's 3.25rem, `tone="wash"`, or the actor's avatar when there is one). Decide how the day groups (Today, Earlier) map onto `.mh-section-label` over separate feed lists. Read state uses the inbox's unread treatment.
- **Clients**: the triage groups become `.mh-section-label` + one feed list each. The existing swipes switch to the WhatsApp option style. The searchbar and status chips move into the `mh-feed-header`. The requests and invite entry points stay as they are, and you decide whether they sit above the feed or in the header.
