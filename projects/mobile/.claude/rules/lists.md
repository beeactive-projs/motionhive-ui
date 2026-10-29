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
| Shape | slate cards with rounded corners on the page, inside `.mh-page` | rows edge to edge on the page, straight in `ion-content` |
| Rows | one line, a small tile, a value or chevron | a large avatar and two lines, a title with its time and a preview with its badges |

Grouped lists are described first; the flat list has its own section at the end. Both share the separator.

## The card

- A grouped list is `<ion-list [inset]="true" class="mh-card-list">`. Nothing else makes a card list: no hand-rolled bordered `div` around `ion-item`s, no `ion-list [inset]` without the class.
- The card has no outline and a `--mh-radius-card` radius; its fill lifts it off the page. Never add a border to it.
- Place it with the page layout (`.mh-page`, `.mh-section`), never with a margin on the list.
- The card and its rows paint Ionic's `--ion-item-background`, which every surface context keeps equal to `--ion-card-background`; neither the skin nor a row sets a background of its own. The page and card colours per context (page, sheet) are in `surfaces-and-sheets.md`, "Surfaces".
- A flat list lives only on a flat page and paints the page colour, `--ion-background-color` (`surfaces-and-sheets.md`, "Surfaces").

## Text beside a list

- A label over a list (`.mh-section-label`, or a `.mh-kicker` in `.mh-section`, `.mh-section-head` or `.mh-day-header`) is one look: small semibold in the muted ink, untracked (user decision, 2026-10-27). Don't add tracking or a colour to one.
- Labels, notes and footnotes beside a list start on `--mh-row-gutter`, in line with the tiles and avatars. The theme does it (`layout.css`); don't pad them per page. A label over chips or a field keeps its own small inset.
- A footnote under a list is a `.mh-footnote` inside the list's `.mh-section`, so the section gap binds it to the card. `.mh-helper` is the line under a field, not under a list.

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
- A flat screen carries `class="mh-flat-page"` on `ion-content` for good, not bound to a signal. It places the search notes under the field (`layout.css`); the surfaces are the same as any page's. The loading, empty and error states sit on the page the rows do.
- A label over a flat list (search's "People", "Messages") is a `.mh-section-label` directly before the list (see "Text beside a list").
- The header needs no class. Every app page's header ([`ion-header.css`](../../src/theme/components/ion-header.css)) puts the title, the end buttons, the search field, the back chevron and the `.mh-chip-row` pills on `--mh-row-gutter`, so they line up with the avatars on the left and with the row times on the right, and has no shadow or hairline. Don't pad these parts per page (user decision, 2026-10-27).
- The first row of a flat list has a hairline above it as well (drawn by the skin, same inset as the separators). That line, not a shadow or a border on the header, is the seam between header and list.

### Rows

- A row is one `ion-item` (bare, or in `ion-item-sliding`, or in a row component). It never sets `lines`, `--border-*`, `--padding-*` or `--min-height`; the skin gives every row 0.75rem above and below.
- No chevron: `detail="false"`. The whole row is the tap target, as in WhatsApp.
- The leading item is an `mh-hex-avatar` at `size="lg"` (3.25rem), centred on the row. A skeleton's `ion-skeleton-text slot="start"` block is 3.25rem too; the skin gives its row `--mh-row-lead: 3.25rem`, so its separator starts where the real rows' text does. Don't restate that in the page. The loading row is [`mh-row-skeleton`](../../src/app/_shared/components/row-skeleton/row-skeleton.html) (`[time]="true"` for a conversation row), never an inline `ion-item`. A search shows it only before its first answer; later keystrokes keep the last results until the next ones replace them.
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
- The one exception is a row verb (the invite page's "Invite"): an `ion-button.mh-row-action` in `slot="end"`, centred across both lines, because a button does not fit a 1.5rem line. A row with one never takes taps itself.
- Type comes from the skin: the title is Inter 600 at `--mh-text-md`, the second line `--mh-text-base` in `--ion-color-medium`, a note in a line `--mh-text-sm`. Don't restate them in the row. A row adds only its own states (an unread row lifts the preview to `--ion-text-color` and the time to `--mh-color-honey-deep`).
- Each line is a 1.5rem box (set by the skin), so a flat-list row is exactly 4.5rem. Don't put anything taller than 1.5rem in a line, and don't change a line's height or leading in a row. A row a fraction of a pixel off (the text's own 1.55 leading gave 72.047px) moves every separator below it off the pixel grid, and the ones that straddle two pixels draw thicker.
- Full ink in a row is `--ion-text-color`. `--ion-color-dark` is a dim slate in the dark palette.
- Swipe actions follow WhatsApp: `ion-item-option`s with the icon over the label (`slot="top"`), and the row closes after a tap.

### Grouped flat lists

A flat list split into labelled groups (the notification days, search's People and Messages) is a run of `.mh-section-label` + `ion-list.mh-flat-list` pairs, straight in `ion-content`. Under a label the label is the seam: the skin drops the first row's top hairline there. Reference: [`notifications.html`](../../src/app/main/notifications/notifications.html).

### Notifications

The bell's list is a grouped flat list, after Apple Mail's inbox: one label per day (`dayDividerLabel`), no search field, the Filters / All / Unread strip in the header. A category filter drops the day labels and shows one run.

- The leading item is the category's `mh-hex-avatar` at `size="lg"`, `tone="wash"`, since a notification has no person behind it.
- The body is one line with an ellipsis. The full text is in the screen the row opens, or in the detail sheet.
- Unread is a red dot centred in the gutter before the tile (absolutely placed, so the row's geometry does not move), plus full ink on the body and time. Not honey: that stays the Messages inbox's exception.

### Clients

The coach's Clients tab is one flat list off `/clients`, laid out like the Messages inbox: title, bell and the honey "+" (invite) in the header, the search field always there under them, then the All / Active / Requests / Archived chips. There are no segments and no "Needs attention" lens: the roster (`/coach/roster`) is not read here (user decision, 2026-10-19). Requests are the Requests chip (PENDING); there is no header button, menu row or page for them (user decision, 2026-10-19). A pending row opens the request sheet ([`request-sheet`](../../src/app/main/clients/_sheets/request-sheet/request-sheet.html), an `mh-action-sheet`): who, how long it has waited, their message, then Accept / Decline for an incoming request or Resend / Withdraw for a sent invitation. Home's banner and a request notification open the tab on the chip with `?filter=requests`, and the Clients tab carries a red count of the requests waiting on the coach (`incoming` from `/clients/requests/pending/count`, never `count`, which includes the invitations the coach sent).

- Inviting is the header's honey "+", not a floating button. It opens the invite page below, not a sheet.
- Opening search resets the chip to All: the pills fold away with the title, so a chip left on would narrow the results with nothing on screen saying so. A term under the API's floor gets a note under the header.
- Rows ([`client-row`](../../src/app/main/clients/_components/client-row/client-row.html)) are flat-list rows: `lg` avatar (a mail tile for an email-only invite), the name on the first line, the address and the status badge on the second. An email-only invite's address ellipses like any title; lines never wrap.

### Invite client

Inviting was a sheet with an `ion-segment` and it is a page now, [`invite-client`](../../src/app/main/clients/invite-client/invite-client.html) at `/tabs/clients/invite`, after the new-message page (user decision, 2026-10-27). Picking who to invite is a search over everyone: it wants the whole screen and the keyboard on arrival, and it needs nothing from the list behind it.

- **One field, and what is typed decides the door.** A name lists People; an address adds an "Invite by email" row under its own label. There is no segment, no mode and no second screen. `isEmailQuery` gates the section (so a half-typed `ana@` can say what is wrong with it) and `inviteEmail` gates the row (so it can never offer an address `@IsEmail()` refuses). Both live in `invite.utils.ts`, covered by `clients.config.spec.ts`.
- **The Invite button sends.** The decision is reversible one swipe away in the list, and a confirm step would make inviting three people at a gym nine taps instead of three. "Invite" is a real button (user decision, 2026-10-27): `ion-button.mh-row-action` (`ion-button.css`) in `slot="end"`, centred on the row, never inside a 1.5rem line, where its 2rem would push the 4.5rem row off the pixel grid. The row itself takes no taps, so each person is one control. Once sent, the button gives way to an `ion-badge` in the same slot: neutral "Sending", green "Invited". The email row uses the same button, which opens its sheet.
- **Search notes sit under the field** (user decision, 2026-10-27): the start hint, the minimum-length note, an address error and the "only people you are not connected to" scope all come first in the content, before the Share link row or any results. On a flat screen a `.mh-note-block` takes the row gutter and hugs the field (`layout.css`).
- **Share link or QR is a card**, like the Menu's account card (user decision, 2026-10-27): an `mh-card-list` with an `md` tile and a chevron, its edge on the row gutter beside the search field. It is an ordinary card, slate on the white page like every card.
- **The email door gets a sheet**, because it has something to confirm: the address in the shell's subtitle, an "Add a note" disclosure (the note is kept only here — nothing on mobile renders a coach's invite message in-app), the expiry line, then Send. The address is snapshotted when the sheet opens; the field behind it stays live.
- **Leaving forces the list to reload, once.** `ClientsStore.reenter()` measures time since the last load, so the normal path — open the tab, invite, come back — lands inside its window and the new pending row would not appear. The invite page tells `ClientsRefreshService` (on every send, and on Done with the Requests chip), and the Clients page reads it in `ionViewWillEnter`, which every way back fires, with one load: a chip change reloads by itself, an unchanged chip gets a refresh. Done returns to the bare `/tabs/clients`.
- **Never hand the list an instruction in the URL on the way back.** The chevron, the swipe and Android's back button all pop to the page's saved URL, query string included (only the browser's own back is popstate), so a `?filter=` or a reload flag left there is replayed on every later return from a client page: the chip snaps back under a coach who picked another, and the list reloads for nothing.

### Search start

What an open search shows before anything is typed, after Messenger: [`mh-search-start`](../../src/app/_shared/components/search-start/search-start.html). Messages and Clients use it.

- **Recent** is the last three people a search ended on: a person, never the typed text. Newest first, one row each, a remove X per row and "Clear all" beside the label. Kept on the device per screen and per account (`injectRecentSearches(scope)`, `mh.recentSearches.v1.<scope>.<userId>`), so nothing needs clearing on sign out. A person stops being a shortcut when they stop making sense: Messages drops someone you block.
- **Suggestions** come from data the screen already loaded, never a new request. Each is a labelled sideways strip of `lg` avatars over first names (`strips` input, in order, empty ones left out); each button's accessible name is the full name. Messages has no strip: its "Frequent contacts" (the people from the latest conversations; the inbox has no message counts, so recency stands in) are flat-list rows under the recents, the same list drawn with the same [`mh-person-row`](../../src/app/_shared/components/person-row/person-row.html) as on the new-message page (user decision, 2026-10-25). Clients has two: "Pending requests" (sent invitations and incoming requests; a tap opens the request sheet, an email-only invite shows the mail tile, and the status is said with the name) above "Newest clients" (active only; a tap opens the profile). Pending people are never remembered as recents.
- The remove X sits beside its row, not inside it (a button in a button is one control to a screen reader); the label stops a tap target short of it.
- With no recents and no suggestions the screen keeps its list. Typing replaces the view with results.
- The header folds as search opens and closes (`SearchHeaderFold` in `_shared/utils/fold.ts` on `(animate.enter)` / `(animate.leave)`): title and pills fold their height, the back chevron its width, so the field glides rather than jumps. Reduced motion skips it.

### New message

Search and starting a conversation are two things (user decision, 2026-10-25). The inbox's honey "+" (and the empty inbox's button) opens its own page, [`new-message`](../../src/app/main/messages/new-message/new-message.html) at `/tabs/messages/compose`, after Messenger: a back button and the "New message" title, the search field under them with the caret already in it, then a grouped flat list. No sheet, and no recents.

- Before anything is typed: **Suggested** first (the reader's own coaches, each with "Your coach" under the name, then the coaches `GET /profile/instructors/suggested` returns), then **Frequent contacts** (as in the inbox search, minus anyone already suggested). Nobody to suggest gives a one-line hint.
- Rows are flat-list rows (`mh-person-row`, shared with the inbox search's people), not strips: the page has the room, and the line under the name is where a sponsored coach will be marked (the API's `reason`).
- Typing lists People (`/users/search`) and the matching conversations. The page filters conversations itself (`conversationMatches` from core); the store's search query belongs to the inbox. Those rows have no swipe actions (`[swipeable]="false"`).
- Picking replaces the page (`replaceUrl`) with the thread, or with a draft (`new?to=`) when there is none, so back from the chat lands on the inbox.

### My coaches

The trainee's side of a coaching relationship, [`coaches`](../../src/app/main/coaches/coaches.html) at `/tabs/more/coaches`, reached from the Menu's "My training" card. It exists because a coach's invitation had nowhere to be answered on mobile: `acceptRequest` was called only from the coach's own Clients store, so an invitation sent to someone who has the app and not the web app went nowhere.

- A grouped flat list, two sections: **Invitations** first (the only thing on the screen waiting on the reader), then **Your coaches**. Rows are `mh-person-row`; the line under the name is "Invited you today" or "Coaching you since March 2026".
- A tap opens the verbs in an `mh-action-sheet`, as a pending client row does on the coach's side, so a request reads the same from either end: Accept / View profile / Decline for an invitation, Message / View profile / End coaching for a coach. Declining fires on the tap (the coach can invite again); ending a coaching asks first.
- `GET /clients/requests/pending` returns **incoming** requests only — verified against the API: with three outgoing requests on the account it answered `[]`. So there is no "requests you sent" section; a trainee's own request to a coach has no endpoint to read it back from. Don't add the section back without one.
- The Menu row carries a dot, not a count (`MoreBadgesService.hasCoachInvites`, train mode only). Its `incoming` number is role-agnostic: the same field feeds the Clients tab's red count in coach mode.


## Empty states

A screen with nothing to show says so through [`mh-empty-state`](../../src/app/_shared/components/empty-state/empty-state.html), never a hand-built block. It is laid out like WhatsApp's empty chat list: one centred column, the tile carrying the weight.

- The order is fixed — a `2xl` `mh-hex-avatar`, the heading at `--mh-text-xl`, the message, the action. Nothing else goes in it.
- **The action is a plain `fill="clear"` button in `color="primary"`** — the brand honey straight from the palette, not the deep `mh-text-link` ink. There is no solid or outline variant; an empty screen has one thing left to do and the words are enough for it. The honey is light on a white page (2.05:1) and is being looked at.
- The tile is honey in its wash (`color="primary" tone="wash"`), the same tile the hand-built empty screens use (clients, sessions, notifications), so every list with nothing to show looks the same (user decision, 2026-10-29). A load error destroys nothing, so it never turns red.
- The message is one sentence. The block caps its own width at about thirty characters a line so it breaks into a short stack under the heading; don't pass a paragraph.
- It fills the screen only where there is a screen to fill: `min-block-size: 100%` catches `ion-content`'s scroll box and resolves to nothing inside `.mh-page` or a sheet body, where the block keeps its natural height. The same component is both the whole-screen state and the one under a half-filled section, so don't wrap it in a spacer either way.
- The block sits on the page the rows do, so an empty inbox and a full one are one surface.
