---
paths:
  - "projects/mobile/src/**/*.{html,scss,css,ts}"
  - "src/**/*.{html,scss,css,ts}"
---

# Fields and forms in the mobile app

One field look, and one place that decides its colours: [`ion-input.css`](../../src/theme/components/ion-input.css) and its mirror [`ion-textarea.css`](../../src/theme/components/ion-textarea.css). A page sets attributes; it never sets a colour.

## Every text field

```html
<ion-input
  mode="md"
  fill="outline"
  labelPlacement="stacked"
  [label]="'form.label.name' | translate"
  [placeholder]="'groups.edit.namePlaceholder' | translate"
  [value]="name()"
  (ionInput)="name.set($event.detail.value ?? '')"
/>
```

Those first four attributes, every time. There is no second kind of field.

- **`mode="md"` is not optional.** `fill="outline"` is Material only, and each platform otherwise gets its own mode on purpose ([`app.config.ts`](../../src/app/app.config.ts)), so a field without it draws on an iPhone as bare text with no border and correctly on Android. That is the hardest kind of bug to notice: it looks right on whichever machine you happened to test on.
- **`labelPlacement="stacked"`, never `floating`.** A floating label sits in the placeholder's seat until something is typed, so the field can show its name or an example of its content, never both; once typed it is also the smallest type on the screen, which is the size someone glancing back at a half filled form has to read. Stacked parks the name in the notch for good and leaves the placeholder free.
- **A real `[label]`, always.** Not a placeholder standing in for one, and not an `aria-label`. A placeholder is gone the moment someone types, and an `aria-label` names the field for a screen reader while leaving it unnamed for everyone else. `ionic-gotchas.md` says the same thing from the other end: don't bind dynamic `aria-*` on `ion-input`, give it a stable label.
- **The placeholder is an example, not a second label.** "Push day" under "Routine name". Both are keys, in both languages.
- A field that spans lines is `ion-textarea` with `[autoGrow]="true"`. Everything above holds unchanged.
- A field is never `shape="round"`: the radius rules exclude that shape, and a capsule is for filter chips (`surfaces-and-sheets.md`).

## Colours

**Never set a colour on a field**, in a page `.scss` or anywhere else. Ionic works its own out from `--ion-color-step-*`, greys it computes off the page rather than ones this app chose, so the skin redefines those steps on the host and Ionic's formulas resolve to tokens instead:

| What | Token |
|---|---|
| Outline at rest | `--ion-border-color`, the grey the set table's cells and a stepper's value already use |
| Outline on hover | `--ion-color-medium`. No phone hovers; the browser you check a change in does |
| Outline on focus | `--ion-color-primary`, the honey. Pinned for a valid field too, so the ring always means "you are here" and never "correct" |
| Label and placeholder | `--ion-color-medium`, at full opacity |
| Label while focused | `--mh-color-honey-deep`. Ionic tints it with the outline's own honey, which is fine on a 2px rule and 2.2:1 as 12px text |
| The value | the page ink, inherited |
| Anything in error | `--mh-color-danger-deep` |

## The error line

A field's error is a sibling `<p>`, never Ionic's `errorText`:

```html
<ion-input … />
<p class="mh-helper over" role="alert">{{ error }}</p>
```

The skin paints the outline, the notched label and the line red off that sibling, because Ionic wipes its own `ion-invalid` from the host on its next render (`ionic-gotchas.md`). Keep the `<p>` immediately after the field or none of it fires.

## Optional and required

- The marker goes after the field's name, in parentheses and lowercase: "Picture (optional)". It is core's `form.hint.optional`, the word web's forms use too (user decision, 2026-11-17).
- Mark only the optional fields: no mark means required. A field that is required for some people and optional for others (the exercise form's muscle group: a coach must name one) shows the mark only when it is optional.
- On a section head it is the `ion-note` after the kicker; on a text field it joins the `[label]`: `('…note' | translate) + ' ' + ('form.hint.optional' | translate)`.
- Not there yet: the welcome steps (`welcome.optional`), `muscle-equipment-fields` ("Required" / "Optional" notes on its rows), and `group-edit` and `venue-sheet` (`form.placeholder.optional`) still show the bare word.

## When a field is the wrong control

- A **form or a sheet** is where fields belong: you are there to type.
- A **detail screen** reads values that already exist, so it uses a grouped list row (`mh-settings-row`, `lists.md`) with the value on the right, and a tap opens the sheet where the field is waiting. 48px a row against 56px plus a notch, and a row reads as a value rather than as a blank.
- A **composer** (a chat, a post, a comment) is not a form field and takes no outline.

## Not there yet

These do not follow the rule and are waiting on their own redesign (user decision, 2026-11-17). Don't fix them in passing, and don't copy them as a model:

- `groups/group-edit` and `_shared/components/chip-input`: the right label and placement, but no `fill="outline"` and no `mode="md"`.
- `payments/coach/create-invoice`: three fields with no label at all, one of them with no placeholder either.
- The note and message textareas in `set-menu-sheet`, `exercise-note-sheet`, `client-notes-sheet`, `participant-note-sheet`, `message-signups-sheet`, `cancel-session-sheet` and `assign-sheet`: outlined, but with no label.
