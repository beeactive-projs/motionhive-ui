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

5. **Every verb's tile is coloured; only destructive verbs are red.** Mark those
   `destructive: true`; the sheet puts them last, in their own card. Every other verb takes its
   concept's hue from the tile table in `projects/mobile/.claude/rules/lists.md` ("Leading
   icons"): honey (`primary`) for the sheet's main verb or for editing and creating, `success` for
   unarchiving or checking in, `teal` for a place, a copy or a new routine, `violet` for people
   and for archiving (not red: it loses nothing and one tap undoes it, so it stays out of the
   destructive card), `info` for sharing, calendars, links and notes. Keep a verb's hue the same
   on every sheet, and give neighbours different hues. Grey (`medium`) is only for a verb that is
   off or unavailable, never the default (user decision, 2026-11-03): `color` is required and its
   type (`SheetActionColor`) leaves grey out, and the sheet greys a `disabled` verb itself. See the
   note on `SESSION_ACTIONS`.
6. **Say the effect when it is not obvious.** Use `hint` for a second line (Unpublish: "Back to
   draft. Clients already on it keep their copy.").

## Confirm wording

- The archive pair is **Archive / Unarchive** ("Arhivează" / "Dezarhivează"; the shared
  `button.archive` / `button.unarchive`), on every screen, never Restore (user decision,
  2026-11-03). Unarchive names the exact undo; Restore reads as getting back something deleted, and
  stays free for that.

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
  { id: ThingActionIds.EditDetails, label: 'things.actions.editDetails', icon: 'create-outline', color: 'primary' },
  { id: ThingActionIds.Duplicate, label: 'button.duplicate', icon: 'copy-outline', color: 'teal' },
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
| View assignments   | published             | the assignments page                                                                         |
| Edit details       | yours                 | sheet: name, description, length in weeks. Growing asks whether to repeat the existing weeks or leave the new ones empty; shrinking warns how many days go. |
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

**Workouts list** (`workouts/workouts.html`, the swipe on your routine rows): a swipe left reveals
More and Edit; there is no swipe right. More is the builder's sheet without Edit (Make a copy,
Archive, Delete routine). Edit opens the builder in edit mode (`?edit`). Archive happens on the tap
with a toast; Delete asks in red, as on the routine's page. On the archived routines page the swipe
left holds Unarchive alone, and a full swipe unarchives too: it happens at once, with a toast.

**Library filters** (`programs/programs.html`): the chip row filters by kind (All, Programs,
Routines). Who made it (Mine, MotionHive, All) is in the Filters sheet, and the Filters chip
counts it when it is not the default (Mine).

## Other screens already on this pattern

Sessions (`SESSION_ACTIONS`), clients (`visibleClientActions`, `visibleRequestActions`), messages
(`conversationActions`), notifications (`notificationListActions`), the workout logger
(`exerciseActions`).
