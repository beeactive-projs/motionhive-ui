---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Lists in the mobile app

There are two kinds of list, and every `ion-list` is one of them. [`theme/components/ion-list.css`](../../src/theme/components/ion-list.css) is the single source of both skins; rows only lay out their own parts.

| | Grouped list (`mh-card-list`) | Flat list (`mh-flat-list`) |
|---|---|---|
| Looks like | iOS Mail "Mailboxes", WhatsApp settings and sheets | WhatsApp's chat list |
| For | settings, details, options, verbs, short fixed sets | the content of a screen: conversations, people, search results, notifications, activity |
| Shape | white cards with rounded corners on the slate page, inside `.mh-page` | white rows edge to edge, straight in `ion-content` |
| Rows | one line, a small tile, a value or chevron | a large avatar and two lines, a title with its time and a preview with its badges |

Grouped lists are described first; the flat list has its own section at the end. Both share the separator.

## The card

- A grouped list is `<ion-list [inset]="true" class="mh-card-list">`. Nothing else makes a card list: no hand-rolled bordered `div` around `ion-item`s, no `ion-list [inset]` without the class.
- The card has no outline and a `--mh-radius-card` radius; its fill lifts it off the grey page. Never add a border to it.
- Place it with the page layout (`.mh-page`, `.mh-section`), never with a margin on the list.
- The rows take the card's fill (`--ion-card-background`, set by the skin). In dark mode the page is the bars' grey (#1f1f1f) and cards step up to #2c2c2e; inside a sheet everything is one step higher (sheet #2c2c2e, cards #3a3a3c, see `surfaces-and-sheets.md`).
- A flat list and its page paint `--mh-color-flat-surface`, never `--ion-card-background`: white in light, the page grey in dark.
- A tab root made of cards (the Menu) still takes `mh-flat-header`, so its title and bell sit where the Messages tab puts them and no hairline closes the bar.

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

## Flat lists

The WhatsApp chat list. First use: the Messages inbox ([`messages.html`](../../src/app/main/messages/messages.html), [`conversation-row`](../../src/app/main/messages/_components/conversation-row/conversation-row.html)). Use it for any screen whose content is a long run of people or items, not for settings or details.

### The list and its page

- A flat list is `<ion-list class="mh-flat-list">`, without `[inset]`. It sits straight in `ion-content`, outside `.mh-page`; the rows run edge to edge.
- While the list is on screen, bind `[class.mh-flat-page]` on `ion-content` (from `layout.css`) so the page takes the rows' white. Drop it for empty and error states, which need the slate page.
- A label over a flat list (search's "People", "Messages") is a `.mh-section-label` directly before the list. The skin moves it onto the row gutter.
- The header over a flat list carries `class="mh-flat-header"` on `ion-header` ([`ion-header.css`](../../src/theme/components/ion-header.css)). It puts the title, the end buttons, the search field, the back chevron and the `.mh-chip-row` pills on `--mh-row-gutter`, so they line up with the avatars on the left and with the row times on the right. Don't pad these parts per page. It also drops Ionic's md header shadow: header and list are one white surface.
- The first row of a flat list has a hairline above it as well (drawn by the skin, same inset as the separators). That line, not a shadow or a border on the header, is the seam between header and list.

### Rows

- A row is one `ion-item` (bare, or in `ion-item-sliding`, or in a row component). It never sets `lines`, `--border-*`, `--padding-*` or `--min-height`; the skin gives every row 0.75rem above and below.
- No chevron: `detail="false"`. The whole row is the tap target, as in WhatsApp.
- The leading item is an `mh-hex-avatar` at `size="lg"` (3.25rem), centred on the row. A skeleton's `ion-skeleton-text slot="start"` block is 3.25rem too; the skin gives its row `--mh-row-lead: 3.25rem`, so its separator starts where the real rows' text does. Don't restate that in the page. In Messages the loading row is [`mh-row-skeleton`](../../src/app/main/messages/_components/row-skeleton/row-skeleton.html) (`[time]="true"` for a conversation row), not an inline `ion-item`. A search shows it only before its first answer; later keystrokes keep the last results until the next ones replace them.
- A count inside a filter chip is `<span class="count">` in the `.chip` button; the skin (`ion-button.css`) spaces it.
- The label holds the two lines. Trailing items go **in** the line they belong to, never in `slot="end"`:

  ```html
  <ion-label>
    <div class="mh-row-line">
      <h2>{{ name }}</h2>
      <ion-note>{{ time }}</ion-note>
    </div>
    <div class="mh-row-line">
      <p>{{ preview }}</p>
      <ion-badge color="primary">{{ count }}</ion-badge>
    </div>
  </ion-label>
  ```

  `.mh-row-line` lets the first child take the space and ellipsis on one line, and keeps whatever follows it whole. A row with no time or badge can use a bare `<h2>` and `<p>`.
- Type comes from the skin: the title is Inter 600 at `--mh-text-md`, the second line `--mh-text-base` in `--ion-color-medium`, a note in a line `--mh-text-sm`. Don't restate them in the row. A row adds only its own states (an unread row lifts the preview to `--ion-text-color` and the time to `--mh-color-honey-deep`).
- Each line is a 1.5rem box (set by the skin), so a flat-list row is exactly 4.5rem. Don't put anything taller than 1.5rem in a line, and don't change a line's height or leading in a row. A row a fraction of a pixel off (the text's own 1.55 leading gave 72.047px) moves every separator below it off the pixel grid, and the ones that straddle two pixels draw thicker.
- Full ink in a row is `--ion-text-color`. `--ion-color-dark` is a dim slate in the dark palette.
- Swipe actions follow WhatsApp: `ion-item-option`s with the icon over the label (`slot="top"`), and the row closes after a tap.

### Grouped flat lists

A flat list split into labelled groups (the notification days, search's People and Messages) is a run of `.mh-section-label` + `ion-list.mh-flat-list` pairs, straight in `ion-content`. Under a label the label is the seam: the skin drops the first row's top hairline there. Reference: [`notifications.html`](../../src/app/main/notifications/notifications.html).

### Notifications

The bell's list is a grouped flat list, after Apple Mail's inbox: one label per day (`dayDividerLabel`), no search field, the Filters / All / Unread strip in the `mh-flat-header`. A category filter drops the day labels and shows one run.

- The leading item is the category's `mh-hex-avatar` at `size="lg"`, `tone="wash"`, since a notification has no person behind it.
- The body is one line with an ellipsis. The full text is in the screen the row opens, or in the detail sheet.
- Unread is a red dot centred in the gutter before the tile (absolutely placed, so the row's geometry does not move), plus full ink on the body and time. Not honey: that stays the Messages inbox's exception.

### Clients

The coach's Clients tab is one flat list off `/clients`, laid out like the Messages inbox: title, bell and the honey "+" (invite) in the `mh-flat-header`, the search field always there under them, then the All / Active / Requests / Archived chips. There are no segments and no "Needs attention" lens: the roster (`/coach/roster`) is not read here (user decision, 2026-10-19). Requests are the Requests chip (PENDING); there is no header button, menu row or page for them (user decision, 2026-10-19). A pending row opens the request sheet ([`request-sheet`](../../src/app/main/clients/_sheets/request-sheet/request-sheet.html), an `mh-action-sheet`): who, how long it has waited, their message, then Accept / Decline for an incoming request or Resend / Withdraw for a sent invitation. Home's banner and a request notification open the tab on the chip with `?filter=requests`, and the Clients tab carries a red count of the requests waiting on the coach (`incoming` from `/clients/requests/pending/count`, never `count`, which includes the invitations the coach sent).

- Inviting is the header's honey "+", not a floating button.
- Opening search resets the chip to All: the pills fold away with the title, so a chip left on would narrow the results with nothing on screen saying so. A term under the API's floor gets a note under the header.
- Rows ([`client-row`](../../src/app/main/clients/_components/client-row/client-row.html)) are flat-list rows: `lg` avatar (a mail tile for an email-only invite), the name on the first line, the address and the status badge on the second. An email-only invite's address ellipses like any title; lines never wrap.

### Search start

What an open search shows before anything is typed, after Messenger: [`mh-search-start`](../../src/app/_shared/components/search-start/search-start.html). Messages and Clients use it.

- **Recent** is the last three people a search ended on: a person, never the typed text. Newest first, one row each, a remove X per row and "Clear all" beside the label. Kept on the device per screen and per account (`injectRecentSearches(scope)`, `mh.recentSearches.v1.<scope>.<userId>`), so nothing needs clearing on sign out. A person stops being a shortcut when they stop making sense: Messages drops someone you block.
- **Suggestions** come from data the screen already loaded, never a new request. Each is a labelled sideways strip of `lg` avatars over first names (`strips` input, in order, empty ones left out); each button's accessible name is the full name. Messages has no strip: its "Frequent contacts" (the people from the latest conversations; the inbox has no message counts, so recency stands in) are flat-list rows under the recents, the same list drawn with the same [`mh-person-row`](../../src/app/main/messages/_components/person-row/person-row.html) as on the new-message page (user decision, 2026-10-25). Clients has two: "Pending requests" (sent invitations and incoming requests; a tap opens the request sheet, an email-only invite shows the mail tile, and the status is said with the name) above "Newest clients" (active only; a tap opens the profile). Pending people are never remembered as recents.
- The remove X sits beside its row, not inside it (a button in a button is one control to a screen reader); the label stops a tap target short of it.
- With no recents and no suggestions the screen keeps its list. Typing replaces the view with results.
- The header folds as search opens and closes (`SearchHeaderFold` in `_shared/utils/fold.ts` on `(animate.enter)` / `(animate.leave)`): title and pills fold their height, the back chevron its width, so the field glides rather than jumps. Reduced motion skips it.

### New message

Search and starting a conversation are two things (user decision, 2026-10-25). The inbox's honey "+" (and the empty inbox's button) opens its own page, [`new-message`](../../src/app/main/messages/new-message/new-message.html) at `/tabs/messages/compose`, after Messenger: a back button and the "New message" title, the search field under them with the caret already in it, then a grouped flat list. No sheet, and no recents.

- Before anything is typed: **Suggested** first (the reader's own coaches, each with "Your coach" under the name, then the coaches `GET /profile/instructors/suggested` returns), then **Frequent contacts** (as in the inbox search, minus anyone already suggested). Nobody to suggest gives a one-line hint.
- Rows are flat-list rows (`mh-person-row`, shared with the inbox search's people), not strips: the page has the room, and the line under the name is where a sponsored coach will be marked (the API's `reason`).
- Typing lists People (`/users/search`) and the matching conversations. The page filters conversations itself (`conversationMatches` from core); the store's search query belongs to the inbox. Those rows have no swipe actions (`[swipeable]="false"`).
- Picking replaces the page (`replaceUrl`) with the thread, or with a draft (`new?to=`) when there is none, so back from the chat lands on the inbox.
