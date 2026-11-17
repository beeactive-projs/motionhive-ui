import { Service, inject } from '@angular/core';

import { AuthStore } from 'core';

import { DraftExercise } from './routine-builder.config';

/** An unsaved routine, as the builder had it. */
export interface ParkedDraft {
  name: string;
  notes: string;
  defaultRest: number | null;
  exercises: DraftExercise[];
  /** Editing a saved routine, as against reading it. */
  editMode: boolean;
  /** The builder's last row key, so the rows added after it get new ones. */
  keySeq: number;
}

/**
 * Unsaved routines the tab bar threw away (user decision, 2026-11-17: looking
 * at another tab keeps the draft). A tab tap lands on the tab's first page and
 * destroys the pages above it, the builder too, so the builder parks its draft
 * here as it goes and takes it back the next time the same routine, or a new
 * one in the same tab, opens.
 *
 * In memory only: a restart forgets them. Kept per account and per address
 * (`tabs/workouts/routine/new`, `tabs/programs/routine/<id>`), so a draft
 * comes back in the tab it was left in, to the person who left it. A saved
 * routine is kept under its own address even when the page was opened at
 * `new` (a "Save and start" whose start was put off), so its edits never
 * come back as a new routine.
 */
@Service()
export class RoutineDraftStore {
  private readonly _authStore = inject(AuthStore);
  private readonly _drafts = new Map<string, ParkedDraft>();

  park(path: string, draft: ParkedDraft): void {
    this._drafts.set(this._key(path), draft);
  }

  /** The draft left at this address, handed over once. */
  take(path: string): ParkedDraft | null {
    const key = this._key(path);
    const draft = this._drafts.get(key) ?? null;
    this._drafts.delete(key);
    return draft;
  }

  private _key(path: string): string {
    return `${this._authStore.user()?.id ?? ''}:${path}`;
  }
}
