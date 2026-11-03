import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Observable, catchError, forkJoin, map, of, switchMap, take } from 'rxjs';

import {
  AuthStore,
  Exercise,
  ExerciseKind,
  ExerciseService,
  ExerciseSource,
  ExerciseTaxonomyStore,
  preparePhoto,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { EXERCISE_NOTE_MAX_LENGTH } from '../../../workouts/_sheets/exercise-note-sheet/exercise-note-sheet';
import { ExerciseDraftForm, MAX_NAME_LENGTH, simpleDraft } from '../../exercise-draft';
import {
  EXERCISE_ICONS,
  FEATURED_EQUIPMENT_SLUGS,
  FEATURED_MUSCLE_SLUGS,
  MAX_PRIMARY_MUSCLES,
  SIMPLE_KINDS,
  collapsedChips,
  equipmentChip,
  featuredFirst,
  kindIcon,
  kindTone,
  muscleChip,
  toggleCapped,
  trackLabel,
} from '../../exercises.config';
import { toggleValue } from '../../../../_shared/utils/list.utils';

/** Chips a collapsed muscle cloud shows before More. */
const MUSCLE_PREVIEW = FEATURED_MUSCLE_SLUGS.length;
/** Chips a collapsed equipment cloud shows before More. */
const EQUIPMENT_PREVIEW = FEATURED_EQUIPMENT_SLUGS.length;

/**
 * Your own exercise, in one short form: a name, what you track, and,
 * if you like, the muscle it works, what it needs and a note to yourself.
 *
 * This is the coach's create wizard with the coaching taken out, for the
 * person who trains without one (or a coach in their own training) and just
 * needs the machine their gym has and the catalogue does not. It writes
 * through the same draft model as the wizard and the edit page, so what counts
 * as a valid exercise and how it reaches the API are one answer, not two.
 * The server makes such an exercise private (source USER) and lets it go
 * without a muscle; a coach's account still has to name one, so the chips say
 * Required for them.
 *
 * A sheet rather than a page because it opens from places that must not be
 * left: the picker over a workout half logged, a routine half built. Saving
 * closes it and hands the exercise back once it has gone, so the caller can
 * add it, open the next sheet or refresh its list without stranding this one.
 *
 * Edit loads the full row before it lets you save: a list row carries only
 * the primary muscles, and saving from it would quietly drop the rest.
 *
 * A picture is optional: picked here, prepared on the phone (upright, scaled
 * down, no location) and sent once the exercise is saved, as the note is.
 */
@Component({
  selector: 'mh-exercise-form-sheet',
  imports: [
    EmptyState,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonList,
    IonNote,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './exercise-form-sheet.html',
  styleUrl: './exercise-form-sheet.scss',
})
export class ExerciseFormSheet {
  readonly open = model(false);
  /** The exercise to change; null makes a new one. */
  readonly exercise = input<Exercise | null>(null);
  /** The name a new exercise starts with: what was typed in the picker's search. */
  readonly name = input('');
  /** Already translated ("Create and add"); empty falls back to Create or Save changes. */
  readonly saveLabel = input('');

  /** The exercise as saved, once the sheet has gone. */
  readonly saved = output<Exercise>();

  private readonly _authStore = inject(AuthStore);
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _exerciseTaxonomyStore = inject(ExerciseTaxonomyStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly form = new ExerciseDraftForm();
  readonly note = signal('');
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly musclesExpanded = signal(false);
  readonly equipmentExpanded = signal(false);
  /** The picture shown: the saved one's link, or a new one picked here. */
  readonly picture = signal<{ url: string; jpeg: Blob | null } | null>(null);
  readonly preparingPicture = signal(false);

  readonly maxNameLength = MAX_NAME_LENGTH;
  readonly maxNoteLength = EXERCISE_NOTE_MAX_LENGTH;

  /** The note as loaded, so an untouched one is not written back. */
  private _loadedNote = '';
  /** The picture as loaded, so an untouched one is not sent again. */
  private _loadedPicture: string | null = null;
  /** The saved exercise, held until the sheet has finished leaving. */
  private _pending: Exercise | null = null;

  readonly isEdit = computed(() => this.exercise() !== null);

  readonly title = computed<string>(() =>
    this._translateService.instant(this.isEdit() ? 'exercises.edit.title' : 'exercises.create.title'),
  );

  readonly confirmLabel = computed<string>(
    () =>
      this.saveLabel() ||
      this._translateService.instant(this.isEdit() ? 'button.saveChanges' : 'button.create'),
  );

  readonly canSave = computed(
    () => !this.loading() && !this.loadFailed() && !this.preparingPicture() && this.form.isValid(),
  );

  /** The four "What do you track?" tiles, wearing their kind's tile as the list rows do. */
  readonly trackTiles = SIMPLE_KINDS.map((kind) => ({
    value: kind,
    icon: kindIcon(kind),
    color: kindTone(kind),
    get label() {
      return trackLabel(kind);
    },
  }));

  private readonly _allMuscles = computed(() =>
    featuredFirst(this._exerciseTaxonomyStore.muscles().map(muscleChip), FEATURED_MUSCLE_SLUGS),
  );

  private readonly _allEquipment = computed(() =>
    featuredFirst(
      this._exerciseTaxonomyStore.equipment().map(equipmentChip),
      FEATURED_EQUIPMENT_SLUGS,
    ),
  );

  readonly muscleChips = computed(() =>
    this.musclesExpanded()
      ? this._allMuscles()
      : collapsedChips(
          this._allMuscles(),
          FEATURED_MUSCLE_SLUGS,
          this.form.draft().primaryMuscleIds,
          MUSCLE_PREVIEW,
        ),
  );

  readonly equipmentChips = computed(() =>
    this.equipmentExpanded()
      ? this._allEquipment()
      : collapsedChips(
          this._allEquipment(),
          FEATURED_EQUIPMENT_SLUGS,
          this.form.draft().equipmentIds,
          EQUIPMENT_PREVIEW,
        ),
  );

  readonly hasMoreMuscles = computed(() => this.muscleChips().length < this._allMuscles().length);
  readonly hasMoreEquipment = computed(
    () => this.equipmentChips().length < this._allEquipment().length,
  );

  /** At the server's cap of primary muscles: the rest of the cloud waits. */
  readonly musclesFull = computed(
    () => this.form.draft().primaryMuscleIds.length >= MAX_PRIMARY_MUSCLES,
  );

  constructor() {
    addIcons(EXERCISE_ICONS);
    this._exerciseTaxonomyStore.ensureLoaded();

    // Every opening is a fresh form: last time's half-typed name has no
    // business in this one.
    effect(() => {
      if (!this.open()) return;
      untracked(() => this._start());
    });
    inject(DestroyRef).onDestroy(() => this._setPicture(null));
  }

  /** A photo from the library or the camera, made ready to send. */
  async onPicturePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // The same photo picked twice must still fire `change`.
    input.value = '';
    if (!file) return;
    this.preparingPicture.set(true);
    try {
      const jpeg = await preparePhoto(file);
      this._setPicture({ url: URL.createObjectURL(jpeg), jpeg });
    } catch {
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.photo.toast.unreadable'),
      );
    } finally {
      this.preparingPicture.set(false);
    }
  }

  removePicture(): void {
    this._setPicture(null);
  }

  selectKind(kind: ExerciseKind): void {
    this.form.patch({ kind });
  }

  isKindOn(kind: ExerciseKind): boolean {
    return this.form.draft().kind === kind;
  }

  isMuscleOn(id: string): boolean {
    return this.form.draft().primaryMuscleIds.includes(id);
  }

  toggleMuscle(id: string): void {
    this.form.patch({
      primaryMuscleIds: toggleCapped(this.form.draft().primaryMuscleIds, id, MAX_PRIMARY_MUSCLES),
    });
  }

  isEquipmentOn(id: string): boolean {
    return this.form.draft().equipmentIds.includes(id);
  }

  toggleEquipment(id: string): void {
    this.form.patch({ equipmentIds: toggleValue(this.form.draft().equipmentIds, id) });
  }

  retry(): void {
    const exercise = this.exercise();
    if (exercise) this._load(exercise);
  }

  submit(): void {
    const payload = this.form.payload();
    if (!payload || this.saving()) return;

    const editing = this.exercise();
    this.saving.set(true);

    const write$ = editing
      ? this._exerciseService.update(editing.id, payload)
      : this._exerciseService.create(payload);

    write$
      .pipe(
        take(1),
        switchMap((written) =>
          forkJoin({
            noteError: this._writeNote(written.id),
            picture: this._writePicture(written),
          }).pipe(map(({ noteError, picture }) => ({ saved: picture.saved, noteError, pictureError: picture.error }))),
        ),
      )
      .subscribe({
        next: ({ saved, noteError, pictureError }) => {
          this.saving.set(false);
          if (noteError !== null) {
            // The exercise is saved; only the note is not. Say exactly that,
            // and carry on: editing the exercise again offers the note.
            void this._feedbackService.error(
              noteError,
              this._translateService.instant('exercises.simpleForm.toast.noteFailed'),
            );
          } else if (pictureError !== null) {
            void this._feedbackService.error(
              pictureError,
              this._translateService.instant('exercises.simpleForm.toast.pictureFailed'),
            );
          } else {
            void this._feedbackService.success(
              this._translateService.instant(
                editing ? 'exercises.edit.toast.updated' : 'exercises.create.toast.created',
              ),
            );
          }
          this._pending = saved;
          this.open.set(false);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant(
              editing ? 'exercises.edit.toast.saveFailed' : 'exercises.create.toast.createFailed',
            ),
          );
        },
      });
  }

  /** The exercise goes back only once the sheet is gone; Cancel sends nothing. */
  onDismissed(): void {
    const saved = this._pending;
    this._pending = null;
    if (saved) this.saved.emit(saved);
  }

  private _start(): void {
    this._pending = null;
    this.musclesExpanded.set(false);
    this.equipmentExpanded.set(false);
    this.loadFailed.set(false);

    const exercise = this.exercise();
    this._seedPicture(exercise?.thumbnailUrl ?? null);
    if (!exercise) {
      this.form.reset(simpleDraft(this.name()));
      // The server holds a coach's exercise to a primary muscle, whatever
      // mode the app is in; anyone else's is free to name none.
      this.form.requirePrimary.set(this._authStore.isInstructor());
      this._setNote('');
      return;
    }

    // The row on screen first, so the sheet opens filled; the full record
    // and the note replace it a moment later.
    this.form.seed(exercise);
    this.form.requirePrimary.set(exercise.source !== ExerciseSource.User);
    this._setNote('');
    this._load(exercise);
  }

  private _load(exercise: Exercise): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      exercise: this._exerciseService.get(exercise.id),
      // No note is the usual case, and a note that will not load must not
      // keep the exercise from being edited: it reads as empty.
      note: this._exerciseService.getNote(exercise.id).pipe(
        map((row) => row.note ?? ''),
        catchError(() => of('')),
      ),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ exercise: full, note }) => {
          this.form.seed(full);
          this._setNote(note);
          // Unless one was picked meanwhile: that one is what will be sent.
          if (!this.picture()?.jpeg) this._seedPicture(full.thumbnailUrl ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  private _setNote(note: string): void {
    this._loadedNote = note.trim();
    this.note.set(note);
  }

  private _seedPicture(url: string | null): void {
    this._loadedPicture = url;
    this._setPicture(url ? { url, jpeg: null } : null);
  }

  /** Shows a picture, letting go of the one before if it was a local copy. */
  private _setPicture(next: { url: string; jpeg: Blob | null } | null): void {
    const before = this.picture();
    if (before?.jpeg && before.url !== next?.url) URL.revokeObjectURL(before.url);
    this.picture.set(next);
  }

  /**
   * Send a newly picked picture, or take the old one off when it was
   * removed. Resolves to the exercise as it now is (with its new link) and
   * the error when that failed; never errors itself, as the note.
   */
  private _writePicture(saved: Exercise): Observable<{ saved: Exercise; error: unknown | null }> {
    const picture = this.picture();
    let write$: Observable<Exercise> | null = null;
    if (picture?.jpeg) write$ = this._exerciseService.setImage(saved.id, picture.jpeg);
    else if (!picture && this._loadedPicture) write$ = this._exerciseService.removeImage(saved.id);
    if (!write$) return of({ saved, error: null });
    return write$.pipe(
      map((withPicture) => ({ saved: withPicture, error: null })),
      catchError((error: unknown) => of({ saved, error: error ?? new Error('picture') })),
    );
  }

  /**
   * Write the note when it changed; empty deletes it. Resolves to the error
   * when the write failed, null otherwise, and never errors itself: the
   * exercise is already saved by the time this runs.
   */
  private _writeNote(exerciseId: string): Observable<unknown | null> {
    const note = this.note().trim();
    if (note === this._loadedNote) return of(null);
    return this._exerciseService.setNote(exerciseId, note || null).pipe(
      map(() => null),
      catchError((error: unknown) => of(error ?? new Error('note'))),
    );
  }
}
