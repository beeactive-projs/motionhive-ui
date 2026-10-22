# Mobile actions: where a verb lives

How the Ionic app (`projects/mobile`) places the things you can do to an item: which verb is a
visible button, which sits behind the ⋯, and what happens after the tap. Follow it for every new
screen so the app behaves the same everywhere.

For how a web button looks (PrimeNG severities), see [ACTION-SYSTEM.md](ACTION-SYSTEM.md). This
document is about placement and flow, not styling.

## The rules

1. **⋯ opens the item's action sheet.** Always `mh-action-sheet`. It never navigates to a page and
   there is no "settings" screen behind it.
2. **A footer button is for the one step the screen is waiting on**: publishing a draft, starting
   a routine, copying a starter. It lives in `mh-cta-bar`. Once an item is ready, what you do
   with it (Assign included) is in the ⋯, the main verb first. A verb is never in both places.
3. **The sheet lists only what applies now.** Hide a verb that cannot apply to this item in this
   state (a draft has nobody assigned, a MotionHive starter cannot be deleted). Show it disabled,
   with a hint saying why, only when the person can make it possible from here.
4. **What follows a tap depends on the verb's weight:**

   | The verb…                      | Then                                                         | Example                    |
   | ------------------------------ | ------------------------------------------------------------ | -------------------------- |
   | hands the item to someone      | its own sheet from the bottom (`mh-sheet-shell`)             | Assign to a client         |
   | changes fields of this item    | an edit sheet (`mh-sheet-shell`, Cancel and Save)            | Edit details               |
   | goes somewhere                 | navigate to that page                                        | View assignments           |
   | is reversible in one tap       | do it now, then a toast saying what happened                 | Publish, Unpublish         |
   | creates something new          | a confirm (`mh-confirm-sheet`) saying what you get           | Duplicate, Make a copy     |
   | loses data                     | a red confirm (`tone="danger"`) naming what goes and what stays | Delete program          |

5. **Only destructive verbs are red.** Mark them `destructive: true`; the sheet puts them last, in
   their own card. Everything else stays neutral (`color: 'medium'`). Honey (`primary`) is kept for
   the sheet's one main verb (sessions: Open, a published program: Assign to a client), and a verb
   with a meaning of its own may take that hue (check in is `success`). See the note on
   `SESSION_ACTIONS`.
6. **Say the effect when it is not obvious.** Use `hint` for a second line (Unpublish: "Back to
   draft. Clients already on it keep their copy.").

## Confirm wording

- The title asks with the verb: "Duplicate this program?", "Make a copy?".
- The confirm button repeats the verb ("Duplicate", "Make a copy", "Delete"). Never "OK" or "Yes".
- The body names the item, says what you get, and says what stays as it is.
- A destructive confirm names what goes and what survives ("Clients already assigned keep their
  own copy"), and its cancel is "Keep it".
- Every string ships in English and Romanian in the same change (see `CLAUDE.md`).

## Building one

**Config** in `<feature>.config.ts`, next to the feature's other display rules:

```ts
export const ThingActionIds = { EditDetails: 'editDetails', Duplicate: 'duplicate', Delete: 'delete' } as const;
export type ThingActionId = (typeof ThingActionIds)[keyof typeof ThingActionIds];

export const THING_ACTIONS: readonly SheetAction<ThingActionId>[] = [
  { id: ThingActionIds.EditDetails, label: 'things.actions.editDetails', icon: 'create-outline', color: 'medium' },
  { id: ThingActionIds.Duplicate, label: 'button.duplicate', icon: 'copy-outline', color: 'medium' },
  { id: ThingActionIds.Delete, label: 'things.delete.title', icon: 'trash-outline', color: 'danger', destructive: true },
];

/** Only the verbs that apply to this thing as it is now. */
export function visibleThingActions(thing: Thing): SheetAction<ThingActionId>[] { … }
```

- Labels and hints are translation keys; the sheet translates them. Reuse `button.*` keys when the
  word is the same.
- Register every icon in the feature's `*_ICONS` map. The feature's config spec fails on an icon
  that is rendered but not registered (it would otherwise draw as a blank box).
- Test `visibleThingActions` for each state that changes the list.

**Sheet.** Use `mh-action-sheet` inline, or a thin wrapper under `_sheets/<thing>-actions-sheet/`
when the same sheet opens from more than one screen (`program-actions-sheet`).

**Page.** One signal, one opener, one switch. The page decides what each verb means:

```ts
readonly actionsOpen = signal(false);

onAction(id: ThingActionId): void {
  switch (id) {
    case ThingActionIds.EditDetails: this.detailsOpen.set(true); return;
    case ThingActionIds.Duplicate:   this.duplicateOpen.set(true); return;
    case ThingActionIds.Delete:      this.deleteOpen.set(true); return;
  }
}
```

The action sheet emits after it has closed, so a follow up sheet can open straight away.

**A sheet that sends something waits for the answer.** Give it a `saving` input and pass it to
`mh-sheet-shell` (spinner on the button, Cancel and close locked). The sheet only emits; the page
sends the request, closes the sheet and toasts on success, and on failure toasts and leaves the
sheet open with everything still filled in. Never close first and send after: the screen then
looks like nothing happened until the toast. Examples: `assign-sheet`, `client-notes-sheet`,
`program-details-sheet`.

**Leaving the page after a confirm.** Close the confirm sheet and wait for it before navigating,
or it stays stranded over the next page:

```ts
private readonly _deleteSheet = viewChild<ConfirmSheet>('deleteSheet');
…
await this._deleteSheet()?.close();
void this._router.navigate([...]);
```

## As built: programs and routines

**Program builder** (`programs/program-builder`, `PROGRAM_ACTIONS`, `visibleProgramActions`)

| Action             | Shown when            | Then                                                                                         |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------- |
| Assign to a client | published             | the assign sheet opens from the bottom                                                       |
| Edit details       | yours                 | sheet: name, description, length in weeks. Growing asks whether to repeat the existing weeks or leave the new ones empty; shrinking warns how many days go. |
| View assignments   | published             | the assignments page                                                                         |
| Duplicate          | always                | confirm, then opens the draft copy                                                           |
| Unpublish          | yours and published   | immediate, toast; the footer turns into Publish                                              |
| Delete program     | yours                 | red confirm, then back to the library                                                        |

Footer: only on your draft, **Publish**, disabled with the reason above it until the program has a
name and at least one day of work. Once published the footer goes and the week grid gets the whole
screen. A MotionHive starter shows Duplicate (plus Assign and View assignments once published) and
nothing it cannot change.

**Routine builder** (`workouts/routine-builder`, `routineActions`)

| Who                | Footer       | ⋯                                    |
| ------------------ | ------------ | ------------------------------------ |
| Coach, own routine | Edit         | Make a copy, Delete routine          |
| Trainee, own       | Start        | Edit, Make a copy, Delete routine    |
| Coach, starter     | Make a copy  | none (copying is the only verb)      |
| Trainee, starter   | Start        | none                                 |

Make a copy always asks first and then opens the copy.

**Library filters** (`programs/programs.html`): the chip row filters by kind (All, Programs,
Routines). Who made it (Mine, MotionHive, All) is in the Filters sheet, and the Filters chip
counts it when it is not the default (Mine).

## Other screens already on this pattern

Sessions (`SESSION_ACTIONS`), clients (`visibleClientActions`, `visibleRequestActions`), messages
(`conversationActions`), notifications (`notificationListActions`), the workout logger
(`exerciseActions`).
