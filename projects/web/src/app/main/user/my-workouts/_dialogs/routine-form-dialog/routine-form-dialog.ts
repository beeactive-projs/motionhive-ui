import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  CreateRoutineExercisePayload,
  CreateRoutinePayload,
  Exercise,
  Routine,
  RoutineExercise,
  ProgramAssignmentService,
  RoutineService,
  showApiError,
} from 'core';

import { ExercisePickerDialog } from '../../../../instructor/programs/exercise-picker-dialog/exercise-picker-dialog';

interface DraftSet {
  uiKey: string;
  setType: string;
  targetRepsMin: number | null;
  targetWeightKg: number | null;
  /**
   * A hold, not a rep count. The editor has no field for it yet, so it
   * rides along untouched — dropping it would rewrite a 30 second plank
   * as a set with no prescription at all.
   */
  targetDurationSeconds: number | null;
}

interface DraftExercise {
  /** Stable client-side id (so removing pre-save rows works without an id). */
  uiKey: string;
  exerciseId: string;
  exerciseName: string;
  exerciseThumbnailUrl: string | null;
  defaultSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restAfterSeconds: number | null;
  /**
   * Real per-set rows. Shown instead of the flat fields once the sets
   * differ, because a warm-up plus a top set plus backoffs cannot be
   * said with one set count and one target.
   */
  sets: DraftSet[];
  expanded: boolean;
}

/**
 * Create / edit a Routine.
 *
 * Behaviour:
 *   - `routine = null` → create mode.
 *   - `routine != null` → edit mode; hydrates fields + exercises on open.
 *   - The exercises list is locally edited; on save the FE PATCHes the full
 *     payload (BE replaces the routine_exercise rows wholesale).
 *   - Picker is reused in emit-only mode (no BE hop), then we drop the
 *     chosen Exercise into the local draft list with sensible defaults
 *     (3 sets, no targets — author can tweak).
 */
@Component({
  selector: 'mh-routine-form-dialog',
  standalone: true,
  imports: [
    SelectButton,
    Checkbox,
    FormsModule,
    ButtonDirective,
    Dialog,
    InputNumber,
    Select,
    InputTextModule,
    TextareaModule,
    Toast,
    TooltipModule,
    ExercisePickerDialog,
  ],
  providers: [MessageService],
  templateUrl: './routine-form-dialog.html',
  styleUrl: './routine-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoutineFormDialog {
  readonly routine = input<Routine | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<Routine>();

  /**
   * Optional repeat, offered where the thought actually occurs: you have
   * just built the workout, and "I'll do this Mon/Wed/Fri" is the next
   * sentence. Scheduling was only reachable from a small calendar icon
   * on a saved row, which nobody found.
   *
   * Left off by default — most routines are made to be started once, and
   * forcing a schedule decision would slow the common case.
   */
  readonly repeatEnabled = signal(false);
  readonly repeatDays = signal<number[]>([]);
  readonly repeatWeeks = signal(4);

  /** ISO 8601: 1 = Monday … 7 = Sunday, matching the recurrence engine. */
  readonly weekdayOptions = [
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
    { label: 'S', value: 7 },
  ];

  private readonly _service = inject(RoutineService);
  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);

  readonly name = signal<string>('');
  readonly notes = signal<string>('');
  readonly folder = signal<string>('');
  readonly exercises = signal<DraftExercise[]>([]);
  /** The set types the simple editor exposes; the schema carries more. */
  readonly setTypeOptions = [
    { label: 'Working', value: 'NORMAL' },
    { label: 'Warm-up', value: 'WARMUP' },
    { label: 'Drop', value: 'DROPSET' },
    { label: 'Failure', value: 'FAILURE' },
  ];
  /**
   * Whether the exercise list was actually touched this session.
   *
   * The editor collapses each exercise to one set count plus one target,
   * so sending it back would flatten a routine whose sets genuinely
   * differ (a top set with backoffs, say). Renaming a routine shouldn't
   * quietly rewrite its programming, so an untouched list is omitted
   * from the update and the server leaves the tree alone.
   */
  private readonly _exercisesDirty = signal(false);
  readonly submitting = signal(false);
  readonly pickerOpen = signal(false);

  readonly isEdit = computed(() => this.routine() !== null);
  readonly dialogHeader = computed(() =>
    this.isEdit() ? 'Edit routine' : 'New routine',
  );
  readonly submitLabel = computed(() =>
    this.isEdit() ? 'Save changes' : 'Create routine',
  );
  readonly canSubmit = computed(
    () => this.name().trim().length >= 1 && !this.submitting(),
  );

  constructor() {
    effect(() => {
      if (this.visible()) this._hydrate();
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  onExercisePicked(ex: Exercise): void {
    const draft: DraftExercise = {
      uiKey: `new-${Date.now()}-${Math.floor(performance.now())}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      exerciseThumbnailUrl: ex.thumbnailUrl,
      defaultSets: 3,
      targetRepsMin: null,
      targetRepsMax: null,
      targetWeightKg: null,
      restAfterSeconds: null,
      sets: [],
      expanded: false,
    };
    this.exercises.update((cur) => [...cur, draft]);
    this._exercisesDirty.set(true);
    this.pickerOpen.set(false);
  }

  removeExercise(uiKey: string): void {
    this.exercises.update((cur) => cur.filter((e) => e.uiKey !== uiKey));
    this._exercisesDirty.set(true);
  }

  moveUp(uiKey: string): void {
    const cur = this.exercises();
    const i = cur.findIndex((e) => e.uiKey === uiKey);
    if (i <= 0) return;
    const copy = [...cur];
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
    this.exercises.set(copy);
    this._exercisesDirty.set(true);
  }

  moveDown(uiKey: string): void {
    const cur = this.exercises();
    const i = cur.findIndex((e) => e.uiKey === uiKey);
    if (i < 0 || i >= cur.length - 1) return;
    const copy = [...cur];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    this.exercises.set(copy);
    this._exercisesDirty.set(true);
  }

  /** Switch an exercise between the flat summary and real set rows. */
  toggleSetRows(uiKey: string): void {
    this.exercises.update((cur) =>
      cur.map((e) => {
        if (e.uiKey !== uiKey) return e;
        // Opening with no rows yet seeds them from the flat summary, so
        // the detail view starts from what the person already entered.
        const sets = e.sets.length
          ? e.sets
          : Array.from({ length: Math.max(1, e.defaultSets ?? 3) }, (_, i) => ({
              uiKey: `${e.uiKey}-new${i}`,
              setType: 'NORMAL',
              targetRepsMin: e.targetRepsMin,
              targetWeightKg: e.targetWeightKg,
              targetDurationSeconds: null,
            }));
        return { ...e, sets, expanded: !e.expanded };
      }),
    );
    this._exercisesDirty.set(true);
  }

  addSetRow(uiKey: string): void {
    this.exercises.update((cur) =>
      cur.map((e) => {
        if (e.uiKey !== uiKey) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            {
              uiKey: `${e.uiKey}-n${e.sets.length}-${e.sets.length}`,
              setType: 'NORMAL',
              // Copy the previous row, which is what you usually want.
              targetRepsMin: last?.targetRepsMin ?? null,
              targetWeightKg: last?.targetWeightKg ?? null,
              targetDurationSeconds: last?.targetDurationSeconds ?? null,
            },
          ],
        };
      }),
    );
    this._exercisesDirty.set(true);
  }

  removeSetRow(uiKey: string, setKey: string): void {
    this.exercises.update((cur) =>
      cur.map((e) =>
        e.uiKey === uiKey
          ? { ...e, sets: e.sets.filter((s) => s.uiKey !== setKey) }
          : e,
      ),
    );
    this._exercisesDirty.set(true);
  }

  patchSetRow(uiKey: string, setKey: string, patch: Partial<DraftSet>): void {
    this.exercises.update((cur) =>
      cur.map((e) =>
        e.uiKey === uiKey
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.uiKey === setKey ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    );
    this._exercisesDirty.set(true);
  }

  patchExercise(uiKey: string, patch: Partial<DraftExercise>): void {
    this.exercises.update((cur) =>
      cur.map((e) => (e.uiKey === uiKey ? { ...e, ...patch } : e)),
    );
    this._exercisesDirty.set(true);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const payload: CreateRoutinePayload = {
      name: this.name().trim(),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      ...(this.folder().trim() ? { folder: this.folder().trim() } : {}),
      // Creating always writes the list; editing only when it changed.
      ...(!this.isEdit() || this._exercisesDirty()
        ? { exercises: this.exercises().map((e) => this._toPayloadExercise(e)) }
        : {}),
    };

    this.submitting.set(true);
    const existing = this.routine();
    const req$ = existing
      ? this._service.update(existing.id, payload)
      : this._service.create(payload);

    req$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Routine updated' : 'Routine created',
          detail: `${saved.name} is ready to use.`,
          life: 2500,
        });
        // Schedule after the routine exists — it needs the id, and a
        // failed schedule must not lose the routine you just wrote.
        if (this.repeatEnabled() && this.repeatDays().length && !existing) {
          this._scheduleAfterCreate(saved);
        }
        this.saved.emit(saved);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          existing ? "Couldn't save routine" : "Couldn't create routine",
          'Please check the form and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _hydrate(): void {
    this._exercisesDirty.set(false);
    const r = this.routine();
    if (r) {
      this.name.set(r.name);
      this.notes.set(r.notes ?? '');
      this.folder.set(r.folder ?? '');
      this.exercises.set(
        (r.exercises ?? []).map((re) => this._toDraft(re)),
      );
    } else {
      this.name.set('');
      this.notes.set('');
      this.folder.set('');
      this.exercises.set([]);
    }
  }

  private _toDraft(re: RoutineExercise): DraftExercise {
    const sets = (re.sets ?? []).map((s, i) => ({
      uiKey: `${re.id}-s${i}`,
      setType: s.setType,
      targetRepsMin: s.targetRepsMin,
      targetWeightKg: s.targetWeightKg,
      targetDurationSeconds: s.targetDurationSeconds,
    }));
    return {
      sets,
      // Varied programming opens expanded, so nobody flattens it by
      // saving without noticing the detail was there. Timed sets open
      // too: only the row path carries a duration back to the API.
      expanded:
        (re.hasVariedSets ?? false) ||
        sets.some((s) => s.targetDurationSeconds != null),
      uiKey: re.id,
      exerciseId: re.exerciseId,
      exerciseName: re.exercise?.name ?? 'Exercise',
      exerciseThumbnailUrl: re.exercise?.thumbnailUrl ?? null,
      defaultSets: re.defaultSets,
      targetRepsMin: re.targetRepsMin,
      targetRepsMax: re.targetRepsMax,
      targetWeightKg: re.targetWeightKg,
      restAfterSeconds: re.restAfterSeconds,
    };
  }

  private _toPayloadExercise(
    d: DraftExercise,
  ): CreateRoutineExercisePayload {
    // Per-set rows win when the exercise is being edited as rows; the
    // flat shape stays for the common "3 × 8" case.
    if (d.expanded && d.sets.length) {
      return {
        exerciseId: d.exerciseId,
        sets: d.sets.map((s) => ({
          setType: s.setType,
          ...(s.targetRepsMin != null ? { targetRepsMin: s.targetRepsMin } : {}),
          ...(s.targetWeightKg != null
            ? { targetWeightKg: s.targetWeightKg }
            : {}),
          ...(s.targetDurationSeconds != null
            ? { targetDurationSeconds: s.targetDurationSeconds }
            : {}),
        })),
        ...(d.restAfterSeconds != null
          ? { restAfterSeconds: d.restAfterSeconds }
          : {}),
      };
    }
    return {
      exerciseId: d.exerciseId,
      defaultSets: Math.max(1, Math.min(30, d.defaultSets ?? 3)),
      ...(d.targetRepsMin != null ? { targetRepsMin: d.targetRepsMin } : {}),
      ...(d.targetRepsMax != null ? { targetRepsMax: d.targetRepsMax } : {}),
      ...(d.targetWeightKg != null ? { targetWeightKg: d.targetWeightKg } : {}),
      ...(d.restAfterSeconds != null
        ? { restAfterSeconds: d.restAfterSeconds }
        : {}),
    };
  }

  /**
   * Schedules after the routine exists — it needs the id, and a failed
   * schedule must never lose the routine you just wrote. Best effort:
   * the routine is saved either way.
   */
  private _scheduleAfterCreate(saved: Routine): void {
    this._assignmentService
      .scheduleRoutine({
        programId: saved.id,
        daysOfWeek: this.repeatDays(),
        repeatMode: 'BLOCK',
        repeatWeeks: this.repeatWeeks(),
      })
      .subscribe({
        next: () =>
          this._messageService.add({
            severity: 'success',
            summary: 'Added to your week',
            detail: `${saved.name} is on your schedule.`,
            life: 3000,
          }),
        error: (err) =>
          showApiError(
            this._messageService,
            'Routine saved, but not scheduled',
            'You can schedule it from the routine list.',
            err,
          ),
      });
  }

}
