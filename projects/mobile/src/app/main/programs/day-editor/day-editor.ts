import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Observable, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import {
  CopyDayDetail,
  Exercise,
  ExerciseKind,
  ExerciseSetType,
  PrescribedSet,
  Program,
  ProgramService,
  ProgramWorkout,
  SetField,
  appLocale,
  estimateWorkoutMinutes,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { Notice } from '../../../_shared/components/notice/notice';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { prefersReducedMotion } from '../../../_shared/utils/motion';
import { coachStackOf } from '../../clients/client-paths';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseCard } from '../../workouts/_components/exercise-card/exercise-card';
import { NumericKeypad } from '../../workouts/_components/numeric-keypad/numeric-keypad';
import { PAD_REVEAL_MS, revealAbovePad } from '../../workouts/_components/numeric-keypad/pad-reveal';
import {
  PlanStep,
  PlanSteppers,
  stepperLabelKey,
  stepperLabelWithUnit,
} from '../../workouts/_components/plan-steppers/plan-steppers';
import { SetRow } from '../../workouts/_components/set-row/set-row';
import { SetTableHead } from '../../workouts/_components/set-table-head/set-table-head';
import { SetMenuSheet } from '../../workouts/_sheets/set-menu-sheet/set-menu-sheet';
import {
  KEYPAD_FIELD,
  SetBadge,
  SetRowModes,
  cellValue,
  columnLabelKey,
  setBadge,
} from '../../workouts/logger/logger-flow';
import {
  BuilderExerciseActionId,
  BuilderExerciseActionIds,
  DraftExercise,
  DraftSet,
  NO_REST,
  builderExerciseActions,
  builderRestChoices,
  copyOfSet,
  draftFields,
  exerciseRest,
  flattened,
  nextSet,
  repsRangeText,
  stepperFields,
  steppedAll,
  withAll,
  withExerciseRest,
  withSetCount,
  withValue,
} from '../../workouts/routine-builder/routine-builder.config';
import {
  DEFAULT_SETS,
  KEYPAD_STEP,
  KeypadField,
  KeypadFields,
  WORKOUT_ICONS,
  prescriptionLine,
  secondsToClock,
  shortDayLabel,
} from '../../workouts/workouts.config';
import { CopyBanner } from '../_components/copy-banner/copy-banner';
import { PlanNoteSheet } from '../_sheets/plan-note-sheet/plan-note-sheet';
import {
  LastResultView,
  canMoveTo,
  copyBadge,
  copyClientName,
  copyHeader,
  insteadOfLine,
  lastResultView,
  markedChanged,
  programLine,
} from '../client-copy/client-copy.config';
import { PROGRAM_ICONS, dayLabel, weekLabel } from '../programs.config';
import { CopyDaySource, DaySource, DaySourceKinds, ProgramDaySource } from './day-source';
import {
  NEW_SET_PREFIX,
  NO_EXTRAS,
  NO_TARGET,
  SetExtras,
  blockTags,
  dayBlocks,
  draftFromPrescribed,
  draftTargets,
  exerciseRpe,
  exerciseTempo,
  extrasForSets,
  extrasFromDay,
  extrasOf,
  isNewSetKey,
  linkChanges,
  movedOrder,
  rpeLabel,
  rpeOptions,
  setItems,
  tempoOptions,
  unlinkChanges,
  withWarmup,
  withWorkingExtras,
} from './day-editor.config';

/** The keypad's set key when it types one target into every set of an exercise. */
const ALL_SETS = '*';

/**
 * How long the page waits after the last change to an exercise's targets
 * before saving them: a run of taps on a stepper is one save, not one each.
 */
const SAVE_DELAY_MS = 700;

/** The value the rest sheet uses for the day's own rest, as against an exercise's key. */
const DAY_REST = 'day';

/** The two ways an exercise's targets are set (the segment on its card). */
export const TargetModes = {
  All: 'all',
  PerSet: 'perSet',
} as const;

export type TargetMode = (typeof TargetModes)[keyof typeof TargetModes];

/** The cell the keypad is bound to: one set's, or a target of every set (`ALL_SETS`). */
interface CellEdit {
  exerciseKey: string;
  setKey: string;
  field: SetField;
}

/** One planned set as the table draws it. */
interface SetView {
  set: DraftSet;
  badge: SetBadge;
  editing: SetField | null;
  /** What the pad has typed for this set's open cell; null when none is open. */
  draft: string | null;
  /** `data-editing` while the pad types into it, so the page keeps it above the pad. */
  marker: string | null;
  texts: Partial<Record<SetField, string>>;
}

/** What a client's copy adds to an exercise's card (design ClientCopy). */
export interface CopyCardView {
  /** "Changed for Anna", "Replaced", "Added for Anna"; null as assigned. */
  badge: string | null;
  /** "Instead of Overhead press" under a replaced one. */
  insteadOf: string | null;
  /** "In the program: 3 sets · 8–10 reps · 60 kg" under a changed one. */
  programLine: string | null;
  canRevert: boolean;
  /** The client's last time on the movement, beside the targets. */
  last: LastResultView | null;
}

/** The source the route gave, or the program's when it gave none. */
function injectDaySource(): DaySource {
  const provided = inject(DaySource, { optional: true });
  if (provided) {
    return provided;
  }
  return inject(ProgramDaySource);
}

/** One exercise of the day as its card draws it. */
export interface ExerciseView {
  row: DraftExercise;
  index: number;
  /** "3A": a superset member's label, else null. */
  tag: string | null;
  /** "3 sets · 8–10 reps · 60 kg", what the targets add up to. */
  meta: string;
  fields: SetField[];
  rows: SetView[];
  activeField: SetField | null;
  /** What the pad has typed into the active stepper; null when none is active. */
  preview: string | null;
  /** The segment's value: the same for every set, or set by set. */
  mode: TargetMode;
  canAddWeight: boolean;
  /** "2:00" on its rest chip, or empty when it takes the day's. */
  restChip: string;
  /** What the rest chip says: its own time, or "Rest". */
  restText: string;
  restName: string;
  /** "RPE 8" / "3-1-1-0", or null when none is set. */
  rpe: string | null;
  tempo: string | null;
  /** In a superset, whose rest is set once for the round, on the block. */
  inSuperset: boolean;
  /** Move up or down applies: the ⋮ shows. */
  canMove: boolean;
  /** On a client's copy: its label, the program's values, the last result. */
  copy: CopyCardView | null;
}

/** One block of the day: an exercise on its own, or a superset. */
export interface BlockView {
  key: string;
  number: number;
  members: ExerciseView[];
  superset: boolean;
  /** "Rest after both · 1:30": the last member's rest, the rest after a round. */
  restLabel: string;
  /** The link chip after it, named by the two exercises it would join; empty for the last block. */
  linkLabel: string;
}

/**
 * One day of a program — the routine builder's screen over the program's
 * nested API: the same exercise cards, steppers, set table and number pad,
 * so planning a client's day and planning your own routine are one gesture.
 *
 * Unlike a routine, a day saves as it goes. Each exercise's targets are one
 * request (`setSets`) a moment after the last change, which updates the
 * saved sets in place: the clients' copies link back to those rows by id.
 * Anything that changes the day's shape (adding, removing, moving, linking)
 * waits for those saves, makes its one request and reads the day again.
 *
 * The same screen edits one client's copy of a day (design ClientCopy,
 * owner 2026-11-20) when the route gives it a `CopyDaySource`: the same
 * cards and pad over the copy's routes, plus what the copy adds (whose copy
 * it is, each exercise's label against the program, "Back to the program's
 * values", the client's last result, Swap, and the day's date). The day's
 * name, note and rest and the superset links are the program's business
 * and stay off a copy.
 */
@Component({
  selector: 'mh-day-editor',
  imports: [
    ActionSheet,
    ChoiceSheet,
    ConfirmSheet,
    CopyBanner,
    EmptyState,
    ExerciseCard,
    ExercisePickerSheet,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    Notice,
    NumericKeypad,
    PlanNoteSheet,
    PlanSteppers,
    SetMenuSheet,
    SetRow,
    SetTableHead,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './day-editor.html',
  styleUrl: './day-editor.scss',
})
export class DayEditor implements ViewWillEnter, ViewWillLeave {
  private readonly _programService = inject(ProgramService);
  /** A program's day, or one client's copy of one: what the requests go to. */
  private readonly _source = injectDaySource();
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  /** Programs, or Clients when the plan was opened from a client's page. */
  private readonly _stack = coachStackOf(this._router.url);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly Modes = SetRowModes;
  readonly TargetModes = TargetModes;
  readonly DayRest = DAY_REST;
  readonly skeletonCards = [1, 2];
  /** Editing one client's copy of the day, not the program's. */
  readonly isCopy = this._source.kind === DaySourceKinds.Copy;

  readonly program = signal<Program | null>(null);
  readonly workout = signal<ProgramWorkout | null>(null);
  /** The client's copy of the day: whose, the labels, the program's values, last results. */
  readonly copy = signal<CopyDayDetail | null>(null);
  /** The program or the plan the day belongs to, from the route. */
  readonly parentId = signal<string | null>(null);
  /** The exercise Swap replaces, while the picker is open for it. */
  readonly swapFor = signal<string | null>(null);
  readonly revertTarget = signal<DraftExercise | null>(null);
  readonly revertOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly pickerOpen = signal(false);
  readonly removeTarget = signal<DraftExercise | null>(null);
  readonly removeOpen = signal(false);

  readonly name = signal('');
  readonly note = signal('');

  /** The day's exercises as the builder edits them, keyed by their ids. */
  readonly drafts = signal<DraftExercise[]>([]);
  /** What each set holds that the drafts do not draw (effort, tempo, a note), by set key. */
  readonly extras = signal<Record<string, SetExtras>>({});

  private _programId: string | null = null;
  private _workoutId: string | null = null;
  private _fieldsSeeded = false;
  private _saved = { name: '', note: '' };
  private _pendingSave: Promise<boolean> | null = null;

  /** Exercises the coach opened set by set here, kept so a reload does not fold them back. */
  private readonly _perSetKeys = new Set<string>();
  /** Exercises whose targets changed and wait to be saved. */
  private readonly _dirty = new Set<string>();
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _inFlight = new Map<string, Promise<void>>();
  private _keySeq = 0;

  readonly showSkeleton = computed(() => this.loading() && !this.workout());
  readonly showError = computed(
    () => !this.loading() && !this.workout() && (this.error() || !!this.program()),
  );

  /** Where back lands when there is no stack to pop: the week grid, or the client's copy. */
  readonly builderUrl = computed(() => {
    const id = this.parentId();
    if (id) {
      return this._source.backCommands(this._stack, id).join('/');
    }
    return this._stack;
  });

  /** "Week 3 · Mon", or on a client's copy its real date: "Week 3 · Mon 16 Nov". */
  readonly eyebrow = computed(() => {
    const workout = this.workout();
    if (!workout) {
      return '';
    }
    const copy = this.copy();
    if (copy && copy.day.scheduledDate) {
      return `${weekLabel(workout.weekIndex)} · ${shortDayLabel(copy.day.scheduledDate)}`;
    }
    return `${weekLabel(workout.weekIndex)} · ${dayLabel(workout.dayIndex)}`;
  });

  // ─── A client's copy ───────────────────────────────────────────

  /** "Anna", whose copy this is. */
  readonly copyName = computed(() => {
    const fallback = this._translateService.instant('programs.common.clientFallback');
    const copy = this.copy();
    if (!copy) {
      return fallback;
    }
    return copyClientName(copy.assignment.client, fallback);
  });

  readonly copyClient = computed(() => {
    const copy = this.copy();
    if (!copy) {
      return null;
    }
    return copy.assignment.client;
  });

  /** "Anna's copy" and "Changes reach only Anna. Strength Base stays as it is." */
  readonly copyHeader = computed(() => {
    const copy = this.copy();
    if (!copy) {
      return null;
    }
    return copyHeader(this.copyName(), copy.assignment.programNameSnapshot);
  });

  /** Each exercise of the copy as its card adds it, by exercise id. */
  readonly copyCards = computed(() => {
    const cards = new Map<string, CopyCardView>();
    const copy = this.copy();
    if (!copy) {
      return cards;
    }
    const name = this.copyName();
    for (const row of copy.day.exercises) {
      cards.set(row.id, {
        badge: copyBadge(row.change, name),
        insteadOf: insteadOfLine(row),
        programLine: programLine(row),
        canRevert: row.canRevert,
        last: lastResultView(row.lastResult),
      });
    }
    return cards;
  });

  /**
   * Why this day of the copy can no longer change (the client started it
   * since the copy's page was read, say); null while it can. The API
   * refuses a write to it either way.
   */
  readonly copyLockNote = computed(() => {
    const copy = this.copy();
    if (!copy || copy.day.editable) {
      return null;
    }
    let lock: string = 'other';
    if (copy.day.lock !== null) {
      lock = copy.day.lock;
    }
    return this._translateService.instant('programs.clientCopy.dayLocked', { lock });
  });

  /** The day's date in the picker. */
  readonly copyDate = computed(() => {
    const copy = this.copy();
    if (!copy || !copy.day.scheduledDate) {
      return null;
    }
    return copy.day.scheduledDate;
  });

  readonly copyMin = computed(() => {
    const copy = this.copy();
    if (!copy) {
      return undefined;
    }
    return copy.move.from;
  });

  readonly copyMax = computed(() => {
    const copy = this.copy();
    if (!copy || copy.move.to === null) {
      return undefined;
    }
    return copy.move.to;
  });

  /** The picker speaks the app's language, not the phone's. */
  readonly locale = appLocale;

  /** The picker's rule, the API's too: inside the plan, from today, and free. */
  readonly dateEnabled = (iso: string): boolean => {
    const copy = this.copy();
    if (!copy) {
      return false;
    }
    return canMoveTo(iso.slice(0, 10), copy.move);
  };

  readonly revertBody = computed(() => {
    const row = this.revertTarget();
    if (!row) {
      return '';
    }
    return this._translateService.instant('programs.clientCopy.revert.body', {
      name: row.name,
      client: this.copyName(),
    });
  });

  readonly addedIds = computed(() => this.drafts().map((row) => row.exerciseId));

  // ─── Rest ──────────────────────────────────────────────────────

  readonly dayRest = computed(() => this.workout()?.defaultRestSeconds ?? null);
  readonly programRest = computed(() => this.program()?.defaultRestSeconds ?? null);
  /** "1:30", or the rest it falls back to: "Program (1:30)", "Client's own default". */
  readonly dayRestLabel = computed(() => {
    const own = this.dayRest();
    if (own !== null) {
      return secondsToClock(own);
    }
    const fallback = this.programRest();
    if (fallback !== null) {
      return this._translateService.instant('programs.dayEditor.rest.fromProgram', {
        value: secondsToClock(fallback),
      });
    }
    return this._translateService.instant('programs.dayEditor.rest.clientDefault');
  });

  /** Which rest the sheet is choosing: the day's (`DAY_REST`), or one exercise's by key. */
  readonly restFor = signal<string | null>(null);
  readonly restOpen = signal(false);

  readonly restTitle = computed(() => {
    const target = this.restFor();
    if (target === null || target === DAY_REST) {
      return this._translateService.instant('programs.dayEditor.rest.day');
    }
    const row = this._row(target);
    let name = '';
    if (row) {
      name = row.name;
    }
    return this._translateService.instant('workouts.routineBuilder.rest.exercise', { name });
  });

  readonly restOptions = computed(() => {
    const target = this.restFor();
    if (target === null || target === DAY_REST) {
      const program = this.programRest();
      if (program !== null) {
        return builderRestChoices(
          this._translateService.instant('programs.dayEditor.rest.sameAsProgram', {
            value: secondsToClock(program),
          }),
        );
      }
      return builderRestChoices(this._translateService.instant('programs.dayEditor.rest.clientDefault'));
    }
    // A copy's day has no rest of its own: no rest on an exercise is the client's own.
    if (this.isCopy) {
      return builderRestChoices(this._translateService.instant('programs.dayEditor.rest.clientDefault'));
    }
    return builderRestChoices(
      this._translateService.instant('programs.dayEditor.rest.sameAsDay', { value: this.dayRestLabel() }),
    );
  });

  readonly restSelected = computed(() => {
    const target = this.restFor();
    let value: number | null = this.dayRest();
    if (target !== null && target !== DAY_REST) {
      const row = this._row(target);
      value = null;
      if (row) {
        value = exerciseRest(row);
      }
    }
    if (value === null) {
      return NO_REST;
    }
    return String(value);
  });

  // ─── The cards ─────────────────────────────────────────────────

  /** The cell the keypad is editing, or null when it is closed. */
  readonly editing = signal<CellEdit | null>(null);
  readonly draft = signal('');
  readonly typed = signal<string | null>(null);
  private readonly _keypad = viewChild(NumericKeypad);
  private readonly _content = viewChild(IonContent);
  private _revealedKey = '';

  readonly views = computed<ExerciseView[]>(() => {
    const rows = this.drafts();
    const tags = blockTags(rows);
    const editing = this.editing();
    const typed = this.typed();
    const extras = this.extras();
    const dayRest = this.dayRestLabel();
    const cards = this.copyCards();
    return rows.map((row, index): ExerciseView => {
      const fields = draftFields(row);
      const own = exerciseRest(row);
      let restChip = '';
      let restText = this._translateService.instant('workouts.routineBuilder.rest.chip');
      let restName = this._translateService.instant('programs.dayEditor.rest.exerciseInherited', {
        name: row.name,
        value: dayRest,
      });
      if (own !== null) {
        restChip = secondsToClock(own);
        restText = restChip;
        restName = this._translateService.instant('workouts.routineBuilder.rest.exerciseOwn', {
          name: row.name,
          value: restChip,
        });
      }
      let activeField: SetField | null = null;
      let preview: string | null = null;
      if (editing && editing.exerciseKey === row.key && editing.setKey === ALL_SETS) {
        activeField = editing.field;
        preview = typed;
      }
      let mode: TargetMode = TargetModes.All;
      if (row.perSet) {
        mode = TargetModes.PerSet;
      }
      const rpe = exerciseRpe(row, extras);
      let rpeText: string | null = null;
      if (rpe !== null) {
        rpeText = rpeLabel(rpe);
      }
      let copyCard: CopyCardView | null = null;
      const card = cards.get(row.key);
      if (card) {
        copyCard = card;
      }
      return {
        copy: copyCard,
        row,
        index,
        tag: tags[index],
        meta: prescriptionLine(draftTargets(row), row.kind),
        fields,
        activeField,
        preview,
        mode,
        canAddWeight: row.kind === ExerciseKind.Bodyweight && !row.addedWeight,
        restChip,
        restText,
        restName,
        rpe: rpeText,
        tempo: exerciseTempo(row, extras),
        inSuperset: tags[index] !== null,
        canMove: movedOrder(rows, index, -1) !== null || movedOrder(rows, index, 1) !== null,
        rows: row.sets.map((set, i): SetView => {
          const range = repsRangeText(set);
          let setEditing: SetField | null = null;
          let draft: string | null = null;
          let marker: string | null = null;
          if (editing && editing.exerciseKey === row.key && editing.setKey === set.key) {
            setEditing = editing.field;
            draft = typed;
            marker = '';
          }
          let texts: Partial<Record<SetField, string>> = {};
          if (range) {
            texts = { reps: range };
          }
          return { set, badge: setBadge(row.sets, i), editing: setEditing, draft, marker, texts };
        }),
      };
    });
  });

  /** The day in blocks: an exercise on its own, or a superset drawn as one. */
  readonly blocks = computed<BlockView[]>(() => {
    const views = this.views();
    const dayRest = this.dayRestLabel();
    const blocks = dayBlocks(this.drafts());
    return blocks.map((indexes, position): BlockView => {
      const members = indexes.map((index) => views[index]);
      const last = members[members.length - 1];
      let value = dayRest;
      if (last.restChip) {
        value = last.restChip;
      }
      let linkLabel = '';
      const next = blocks[position + 1];
      if (next) {
        linkLabel = this._translateService.instant('workouts.routineBuilder.superset.linkFor', {
          a: last.row.name,
          b: views[next[0]].row.name,
        });
      }
      return {
        linkLabel,
        key: last.row.key,
        number: position + 1,
        members,
        superset: members.length > 1,
        restLabel: this._translateService.instant('programs.dayEditor.superset.restAfter', {
          count: members.length,
          value,
        }),
      };
    });
  });

  /** "5 · ~55 min" beside Exercises; the count alone when there is no estimate. */
  readonly exercisesMeta = computed(() => {
    const count = this.drafts().length;
    const workout = this.workout();
    if (!count || !workout) {
      return '';
    }
    const minutes = estimateWorkoutMinutes(workout);
    if (minutes === null) {
      return String(count);
    }
    return this._translateService.instant('programs.dayEditor.exercisesMeta', { count, minutes });
  });

  readonly editingKey = computed(() => {
    const edit = this.editing();
    if (!edit) {
      return '';
    }
    return `${edit.exerciseKey}:${edit.setKey}:${edit.field}`;
  });

  readonly keypadField = computed<KeypadField>(() => {
    const edit = this.editing();
    if (!edit) {
      return KeypadFields.Reps;
    }
    return KEYPAD_FIELD[edit.field];
  });

  /** "Bench press · Set 3 · kg"; "Bench press · Weight (kg)" for every set at once. */
  readonly keypadLabel = computed(() => {
    const t = (key: string, params?: Record<string, unknown>) => this._translateService.instant(key, params);
    const all = this._editingAll();
    if (all) {
      return `${all.row.name} · ${stepperLabelWithUnit(all.row, all.field, t)}`;
    }
    const found = this._editingCell();
    if (!found) {
      return '';
    }
    return [
      found.row.name,
      setBadge(found.row.sets, found.index).name,
      t(columnLabelKey(found.field, found.row.unilateral)),
    ].join(' · ');
  });

  /** The pad's wide key: on to the next target, then the next set; nothing on the last. */
  readonly keypadAction = computed<{ label: string; icon: string | null; slot: 'start' | 'end' }>(() => {
    const none = { label: '', icon: null, slot: 'start' as const };
    const all = this._editingAll();
    if (all) {
      const rows = stepperFields(all.row);
      const nextRow = rows[rows.indexOf(all.field) + 1];
      if (!nextRow) {
        return none;
      }
      return {
        label: this._translateService.instant(stepperLabelKey(all.row, nextRow)),
        icon: 'arrow-forward-outline',
        slot: 'end',
      };
    }
    const found = this._editingCell();
    if (!found) {
      return none;
    }
    const fields = draftFields(found.row);
    const next = fields[fields.indexOf(found.field) + 1];
    if (next) {
      return {
        label: this._translateService.instant(`workouts.keypad.next.${next}`),
        icon: 'arrow-forward-outline',
        slot: 'end',
      };
    }
    if (found.index < found.row.sets.length - 1) {
      return {
        label: this._translateService.instant('workouts.routineBuilder.keypad.nextSet'),
        icon: 'arrow-forward-outline',
        slot: 'end',
      };
    }
    return none;
  });

  // ─── Sheets on one exercise or set ─────────────────────────────

  /** The exercise whose ⋮ (move) is open. */
  readonly moveFor = signal<string | null>(null);
  readonly moveOpen = signal(false);
  readonly moveTitle = computed(() => {
    const row = this._row(this.moveFor());
    if (!row) {
      return '';
    }
    return row.name;
  });
  /** Move up and Move down, where there is room (a superset moves as one). */
  readonly moveActions = computed(() => {
    const rows = this.drafts();
    const index = rows.findIndex((row) => row.key === this.moveFor());
    if (index < 0) {
      return [];
    }
    return builderExerciseActions(index, rows.length).filter((action) => {
      if (action.id === BuilderExerciseActionIds.MoveUp) {
        return movedOrder(rows, index, -1) !== null;
      }
      if (action.id === BuilderExerciseActionIds.MoveDown) {
        return movedOrder(rows, index, 1) !== null;
      }
      // On a client's copy the movement can be swapped for another.
      if (action.id === BuilderExerciseActionIds.Swap) {
        return this.isCopy;
      }
      return false;
    });
  });

  /** The set whose badge was tapped. */
  readonly menuFor = signal<{ exerciseKey: string; setKey: string; badge: SetBadge } | null>(null);
  readonly menuOpen = signal(false);
  readonly menuBadge = computed(() => {
    const target = this.menuFor();
    if (!target) {
      return null;
    }
    return target.badge;
  });
  readonly menuSet = computed(() => {
    const target = this.menuFor();
    if (!target) {
      return null;
    }
    const row = this._row(target.exerciseKey);
    if (!row) {
      return null;
    }
    const set = row.sets.find((s) => s.key === target.setKey);
    if (!set) {
      return null;
    }
    let notes: string | null = null;
    const own = this.extras()[set.key];
    if (own) {
      notes = own.notes;
    }
    return { setType: set.setType, notes };
  });

  /** The exercise whose effort or tempo sheet is open. */
  readonly rpeFor = signal<string | null>(null);
  readonly rpeOpen = signal(false);
  readonly tempoFor = signal<string | null>(null);
  readonly tempoOpen = signal(false);
  readonly noteFor = signal<string | null>(null);
  readonly noteOpen = signal(false);

  readonly rpeTitle = computed(() =>
    this._translateService.instant('programs.dayEditor.targets.rpeTitle', {
      name: this._nameOf(this.rpeFor()),
    }),
  );
  readonly rpeChoices = computed(() => rpeOptions());
  readonly rpeSelected = computed(() => {
    const row = this._row(this.rpeFor());
    if (!row) {
      return NO_TARGET;
    }
    const rpe = exerciseRpe(row, this.extras());
    if (rpe === null) {
      return NO_TARGET;
    }
    return String(rpe);
  });

  readonly tempoTitle = computed(() =>
    this._translateService.instant('programs.dayEditor.targets.tempoTitle', {
      name: this._nameOf(this.tempoFor()),
    }),
  );
  readonly tempoSelected = computed(() => {
    const row = this._row(this.tempoFor());
    if (!row) {
      return NO_TARGET;
    }
    const tempo = exerciseTempo(row, this.extras());
    if (tempo === null) {
      return NO_TARGET;
    }
    return tempo;
  });
  readonly tempoChoices = computed(() => {
    const selected = this.tempoSelected();
    if (selected === NO_TARGET) {
      return tempoOptions(null);
    }
    return tempoOptions(selected);
  });

  readonly noteName = computed(() => this._nameOf(this.noteFor()));
  readonly noteValue = computed(() => {
    const row = this._row(this.noteFor());
    if (!row) {
      return null;
    }
    return row.notes;
  });

  readonly removeBody = computed(() => {
    const row = this.removeTarget();
    if (!row) {
      return '';
    }
    if (this.isCopy) {
      return this._translateService.instant('programs.clientCopy.removeBody', {
        name: row.name,
        client: this.copyName(),
      });
    }
    return this._translateService.instant('programs.dayEditor.remove.body', { name: row.name });
  });

  /** The picker's title: what Swap replaces, or the day it adds to. */
  readonly pickerTitle = computed(() => {
    const swapped = this._row(this.swapFor());
    if (swapped) {
      return this._translateService.instant('workouts.logger.picker.replacing', { name: swapped.name });
    }
    return this._translateService.instant('programs.dayEditor.addExercises');
  });

  readonly pickerVerb = computed(() => {
    if (this.swapFor() !== null) {
      return this._translateService.instant('workouts.logger.picker.swapFor');
    }
    return this._translateService.instant('button.add');
  });

  constructor() {
    addIcons({ ...WORKOUT_ICONS, ...PROGRAM_ICONS });
    // The pad docks under the list; the cell it types into is kept above it,
    // as in the routine builder.
    afterRenderEffect(() => {
      const key = this.editingKey();
      const opening = this._revealedKey === '';
      this._revealedKey = key;
      if (key) {
        void this._revealEditing(opening);
      }
    });
    // However the page goes, targets still waiting are saved.
    inject(DestroyRef).onDestroy(() => {
      void this.flushSets();
    });
  }

  ionViewWillEnter(): void {
    // The program and its day, or the plan and its copy's day: the source names them.
    const programId = this._route.snapshot.paramMap.get(this._source.params.parent);
    const workoutId = this._route.snapshot.paramMap.get(this._source.params.day);
    if (!programId || !workoutId) {
      return;
    }
    if (programId === this._programId && workoutId === this._workoutId) {
      return;
    }

    this._programId = programId;
    this._workoutId = workoutId;
    this.parentId.set(programId);
    this._fieldsSeeded = false;
    this._perSetKeys.clear();
    this.load();
  }

  /**
   * Leaving by the back button must not lose a rename or a target. Name and
   * note save on blur and targets a moment after they change; this catches
   * what is still waiting on the way out.
   */
  ionViewWillLeave(): void {
    this.closePad();
    void this.saveFields();
    void this.flushSets();
  }

  // ─── Loading ───────────────────────────────────────────────────

  load(): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId) {
      return;
    }
    this.loading.set(true);
    this.error.set(false);

    this._source
      .load(programId, workoutId)
      .pipe(take(1))
      .subscribe({
        next: (read) => {
          this.program.set(read.program);
          this.copy.set(read.copy);
          const day = read.workout;
          this.workout.set(day);
          if (day) {
            this._rebuild(day);
          }
          if (day && !this._fieldsSeeded) {
            this.name.set(day.name);
            this.note.set(day.notes ?? '');
            this._saved = { name: day.name, note: day.notes ?? '' };
            this._fieldsSeeded = true;
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * The drafts from a fresh read. An exercise whose targets are still being
   * saved keeps what is on screen (the read may be older than the save), and
   * an exercise the coach opened set by set stays that way.
   */
  private _rebuild(day: ProgramWorkout): void {
    const exercises = [...(day.exercises ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const local = new Map(this.drafts().map((row) => [row.key, row]));
    const localExtras = this.extras();
    const extras = extrasFromDay(exercises);
    const fallback = this._translateService.instant('programs.dayEditor.exerciseFallback');
    const drafts = exercises.map((exercise) => {
      const kept = local.get(exercise.id);
      if (kept && this._isPending(exercise.id)) {
        for (const set of kept.sets) {
          const own = localExtras[set.key];
          if (own) {
            extras[set.key] = own;
          }
        }
        return { ...kept, supersetGroupId: exercise.supersetGroupId, notes: exercise.notes };
      }
      return draftFromPrescribed(exercise, fallback, this._perSetKeys.has(exercise.id));
    });
    this.drafts.set(drafts);
    this.extras.set(extras);
    // The pad's exercise may be gone (removed on another screen).
    const edit = this.editing();
    if (edit && !drafts.some((row) => row.key === edit.exerciseKey)) {
      this.editing.set(null);
    }
  }

  private _isPending(key: string): boolean {
    return this._dirty.has(key) || this._inFlight.has(key);
  }

  // ─── Targets: steppers, set table, pad ─────────────────────────

  /** One ± on a stepper: the number of sets, or a target of every set. */
  stepTarget(row: DraftExercise, step: PlanStep): void {
    this._keepTyped();
    this.editing.set(null);
    if (step.field === null) {
      const delta = step.delta;
      this._change(row.key, (current) => withSetCount(current, delta, this._newKey()));
      return;
    }
    const field = step.field;
    this._change(row.key, (current) =>
      steppedAll(current, field, step.delta, KEYPAD_STEP[KEYPAD_FIELD[field]]),
    );
  }

  /** A stepper's value was tapped: the pad types that target, for every set at once. */
  editAll(row: DraftExercise, field: SetField): void {
    this._keepTyped();
    this.typed.set(null);
    this.editing.set({ exerciseKey: row.key, setKey: ALL_SETS, field });
    const current = this._row(row.key);
    let first: DraftSet | null = null;
    if (current && current.sets.length) {
      first = current.sets[0];
    }
    const value = cellValue(first, field);
    this._setDraft(value);
  }

  editCell(row: DraftExercise, set: DraftSet, field: SetField): void {
    this._keepTyped();
    this.typed.set(null);
    this.editing.set({ exerciseKey: row.key, setKey: set.key, field });
    const current = this._findSet(row.key, set.key) ?? set;
    this._setDraft(cellValue(current, field));
  }

  /**
   * The segment on a card: the same targets for every set, or set by set.
   * Back to the same for every set flattens: every set takes the first
   * working set's targets.
   */
  setMode(row: DraftExercise, mode: string | number | undefined): void {
    this._keepTyped();
    this.editing.set(null);
    if (mode === TargetModes.PerSet) {
      if (row.perSet) {
        return;
      }
      this._perSetKeys.add(row.key);
      this.drafts.update((rows) =>
        rows.map((current) => {
          if (current.key === row.key) {
            return { ...current, perSet: true };
          }
          return current;
        }),
      );
      return;
    }
    if (mode !== TargetModes.All || !row.perSet) {
      return;
    }
    this._perSetKeys.delete(row.key);
    this._change(row.key, (current) => flattened(current, this._newKey()));
  }

  addSet(row: DraftExercise): void {
    this._keepTyped();
    this.editing.set(null);
    this._change(row.key, (current) => ({
      ...current,
      sets: [...current.sets, nextSet(current, this._newKey())],
    }));
  }

  /** A warm-up before the working sets: lighter, first, and not counted in the numbering. */
  addWarmup(row: DraftExercise): void {
    this._keepTyped();
    this.editing.set(null);
    this._perSetKeys.add(row.key);
    this._change(row.key, (current) => withWarmup(current, this._newKey()));
  }

  /** Weighted pull-ups and dips still deserve a target weight. */
  addWeight(row: DraftExercise): void {
    this.drafts.update((rows) =>
      rows.map((current) => {
        if (current.key === row.key) {
          return { ...current, addedWeight: true };
        }
        return current;
      }),
    );
  }

  copySet(row: DraftExercise, set: DraftSet): void {
    this._keepTyped();
    this.editing.set(null);
    const key = this._newKey();
    const own = this.extras()[set.key];
    if (own) {
      this.extras.update((extras) => ({ ...extras, [key]: { ...own } }));
    }
    this._change(row.key, (current) => {
      const at = current.sets.findIndex((s) => s.key === set.key);
      const source = current.sets[at] ?? set;
      const sets = [...current.sets];
      sets.splice(at + 1, 0, copyOfSet(source, key));
      return { ...current, sets };
    });
  }

  /** A set goes; an exercise keeps at least one (it names the movement). */
  removeSet(row: DraftExercise, set: DraftSet): void {
    const current = this._row(row.key);
    if (!current || current.sets.length <= 1) {
      return;
    }
    const edit = this.editing();
    if (edit && edit.setKey === set.key) {
      this.editing.set(null);
    }
    this._change(row.key, (draft) => ({
      ...draft,
      sets: draft.sets.filter((s) => s.key !== set.key),
    }));
  }

  swipeCopy(sliding: IonItemSliding, row: DraftExercise, set: DraftSet): void {
    void sliding.close();
    this.copySet(row, set);
  }

  swipeDelete(sliding: IonItemSliding, row: DraftExercise, set: DraftSet): void {
    void sliding.close();
    this.removeSet(row, set);
  }

  openMenu(row: DraftExercise, set: DraftSet, badge: SetBadge): void {
    this._keepTyped();
    this.editing.set(null);
    this.menuFor.set({ exerciseKey: row.key, setKey: set.key, badge });
    this.menuOpen.set(true);
  }

  onSetType(type: ExerciseSetType): void {
    const target = this.menuFor();
    if (!target) {
      return;
    }
    this._change(target.exerciseKey, (row) => ({
      ...row,
      sets: row.sets.map((set) => {
        if (set.key === target.setKey) {
          return { ...set, setType: type };
        }
        return set;
      }),
    }));
  }

  onSetCopy(): void {
    const target = this.menuFor();
    if (!target) {
      return;
    }
    const row = this._row(target.exerciseKey);
    const set = this._findSet(target.exerciseKey, target.setKey);
    if (row && set) {
      this.copySet(row, set);
    }
  }

  onSetRemove(): void {
    const target = this.menuFor();
    if (!target) {
      return;
    }
    const row = this._row(target.exerciseKey);
    const set = this._findSet(target.exerciseKey, target.setKey);
    if (row && set) {
      this.removeSet(row, set);
    }
  }

  /** A note on one set, saved with the exercise's targets. */
  onSetNote(note: string | null): void {
    const target = this.menuFor();
    if (!target) {
      return;
    }
    const row = this._row(target.exerciseKey);
    const set = this._findSet(target.exerciseKey, target.setKey);
    if (!row || !set) {
      return;
    }
    const index = row.sets.indexOf(set);
    const current = this._extrasAt(row, index);
    this.extras.update((extras) => ({ ...extras, [set.key]: { ...current, notes: note } }));
    this._scheduleSave(row.key);
  }

  /** The pad's wide key: keep this cell, then the next field, else the next set's first. */
  onPadAction(typed: string): void {
    const all = this._editingAll();
    if (all) {
      this._apply(typed);
      const rows = stepperFields(all.row);
      const nextRow = rows[rows.indexOf(all.field) + 1];
      const fresh = this._row(all.row.key);
      if (fresh && nextRow) {
        this.editAll(fresh, nextRow);
        return;
      }
      this.editing.set(null);
      return;
    }
    const found = this._editingCell();
    this._apply(typed);
    if (!found) {
      this.editing.set(null);
      return;
    }
    const fields = draftFields(found.row);
    const nextField = fields[fields.indexOf(found.field) + 1];
    const fresh = this._row(found.row.key);
    if (fresh) {
      const set = fresh.sets[found.index];
      if (set && nextField) {
        this.editCell(fresh, set, nextField);
        return;
      }
      const after = fresh.sets[found.index + 1];
      if (after && fields[0]) {
        this.editCell(fresh, after, fields[0]);
        return;
      }
    }
    this.editing.set(null);
  }

  /** Close keeps what was typed, like everywhere else. */
  closePad(): void {
    this._keepTyped();
    this.editing.set(null);
  }

  // ─── An exercise's other targets ───────────────────────────────

  openRest(target: string): void {
    this.closePad();
    this.restFor.set(target);
    this.restOpen.set(true);
  }

  /** The day's rest is the day's own field; an exercise's is saved with its sets. */
  pickRest(value: string): void {
    let seconds: number | null = null;
    if (value !== NO_REST) {
      seconds = Number(value);
    }
    const target = this.restFor();
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (target === null || !programId || !workoutId) {
      return;
    }
    if (target === DAY_REST) {
      // The day's rest is the program's; a client's copy has none to set.
      if (this.isCopy) {
        return;
      }
      void this._write(() =>
        this._programService.updateWorkout(programId, workoutId, { defaultRestSeconds: seconds }),
      );
      return;
    }
    this._change(target, (row) => withExerciseRest(row, seconds));
  }

  openRpe(row: DraftExercise): void {
    this.closePad();
    this.rpeFor.set(row.key);
    this.rpeOpen.set(true);
  }

  /** The effort the coach asks for, on every working set of the exercise. */
  pickRpe(value: string): void {
    const row = this._row(this.rpeFor());
    if (!row) {
      return;
    }
    let targetRpe: number | null = null;
    if (value !== NO_TARGET) {
      targetRpe = Number(value);
    }
    this.extras.update((extras) => withWorkingExtras(row, extras, { targetRpe }));
    this._scheduleSave(row.key);
  }

  openTempo(row: DraftExercise): void {
    this.closePad();
    this.tempoFor.set(row.key);
    this.tempoOpen.set(true);
  }

  pickTempo(value: string): void {
    const row = this._row(this.tempoFor());
    if (!row) {
      return;
    }
    let tempo: string | null = null;
    if (value !== NO_TARGET) {
      tempo = value;
    }
    this.extras.update((extras) => withWorkingExtras(row, extras, { tempo }));
    this._scheduleSave(row.key);
  }

  openNote(row: DraftExercise): void {
    this.closePad();
    this.noteFor.set(row.key);
    this.noteOpen.set(true);
  }

  /** The coach's note on the exercise, what the client reads on its card. */
  saveNote(note: string | null): void {
    const key = this.noteFor();
    const programId = this._programId;
    const workoutId = this._workoutId;
    this.noteOpen.set(false);
    if (!key || !programId || !workoutId) {
      return;
    }
    let notes = '';
    if (note) {
      notes = note;
    }
    void this._write(() => this._source.saveNote(programId, workoutId, key, notes));
  }

  // ─── The day's shape: link, move, add, remove ──────────────────

  /** The chip after a block: link it with the next one as a superset (one request). */
  linkWithNext(block: BlockView): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    // Supersets are the program's shape; a client's copy keeps the ones it has.
    if (!programId || !workoutId || this.isCopy) {
      return;
    }
    const last = block.members[block.members.length - 1];
    const changes = linkChanges(this._linkRows(), last.index);
    if (!changes.length) {
      return;
    }
    void this._write(() => this._programService.setSupersets(programId, workoutId, changes));
  }

  /** Unlink on a superset: every member back on its own, in one request. */
  unlink(block: BlockView): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || this.isCopy) {
      return;
    }
    const members = block.members.map((member) => member.index);
    const changes = unlinkChanges(this._linkRows(), members);
    if (!changes.length) {
      return;
    }
    void this._write(() => this._programService.setSupersets(programId, workoutId, changes));
  }

  openMove(row: DraftExercise): void {
    this.closePad();
    this.moveFor.set(row.key);
    this.moveOpen.set(true);
  }

  /**
   * Move up or down: the day's new order in one request; a superset moves as
   * one. Swap (a client's copy only) opens the picker for one movement.
   */
  onMove(id: BuilderExerciseActionId): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    const rows = this.drafts();
    const index = rows.findIndex((row) => row.key === this.moveFor());
    if (!programId || !workoutId || index < 0) {
      return;
    }
    if (id === BuilderExerciseActionIds.Swap) {
      if (this.isCopy) {
        this.swapFor.set(rows[index].key);
        this.pickerOpen.set(true);
      }
      return;
    }
    let delta: -1 | 1 = 1;
    if (id === BuilderExerciseActionIds.MoveUp) {
      delta = -1;
    }
    const order = movedOrder(rows, index, delta);
    if (!order) {
      return;
    }
    const moved = order.map((rowIndex) => rows[rowIndex]);
    // On screen at once; the read after the save confirms it.
    this.drafts.set(moved);
    const items = moved.map((row, orderIndex) => ({ id: row.key, orderIndex }));
    void this._write(() => this._source.reorder(programId, workoutId, items));
  }

  /** The dashed button: the picker adds movements (not a swap). */
  openPicker(): void {
    this.closePad();
    this.swapFor.set(null);
    this.pickerOpen.set(true);
  }

  /**
   * Every movement picked, in one request, each with three sets to fill in.
   * Never one request per movement: that was a loop of writes, slow and
   * half done when one of them failed. With Swap, the one movement picked
   * replaces the exercise and its sets stay.
   */
  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    const swapKey = this.swapFor();
    this.swapFor.set(null);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!programId || !workoutId || !picked.length) {
      return;
    }
    const copySource = this._copySource();
    if (swapKey && copySource) {
      const exerciseId = picked[0].id;
      void this._write(() => copySource.swap(programId, workoutId, swapKey, exerciseId));
      return;
    }
    const exercises = picked.map((exercise) => ({ exerciseId: exercise.id, defaultSets: DEFAULT_SETS }));
    void this._write(
      () => this._source.addExercises(programId, workoutId, exercises),
      'programs.dayEditor.toast.notAdded',
    );
  }

  // ─── A client's copy: back to the program, and the date ────────

  askRevert(row: DraftExercise): void {
    this.closePad();
    this.revertTarget.set(row);
    this.revertOpen.set(true);
  }

  /**
   * "Back to the program's values": the exercise, its note and sets as its
   * program row is now, in one request; its waiting targets are dropped,
   * since the program's replace them.
   */
  confirmRevert(): void {
    const row = this.revertTarget();
    this.revertOpen.set(false);
    this.revertTarget.set(null);
    const programId = this._programId;
    const workoutId = this._workoutId;
    const copySource = this._copySource();
    if (!row || !programId || !workoutId || !copySource) {
      return;
    }
    this._dirty.delete(row.key);
    const timer = this._timers.get(row.key);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(row.key);
    }
    this._perSetKeys.delete(row.key);
    void this._write(() => copySource.revert(programId, workoutId, row.key));
  }

  /** The picker's date: the day moves there (a free date inside the plan, never past). */
  moveDate(value: string | string[] | null | undefined): void {
    const programId = this._programId;
    const workoutId = this._workoutId;
    const copySource = this._copySource();
    if (!programId || !workoutId || !copySource || typeof value !== 'string') {
      return;
    }
    const date = value.slice(0, 10);
    const copy = this.copy();
    if (!copy || date === copy.day.scheduledDate || !canMoveTo(date, copy.move)) {
      return;
    }
    void this._write(
      () => copySource.moveDay(programId, workoutId, date),
      'programs.clientCopy.toast.moveFailed',
    );
  }

  askRemove(row: DraftExercise): void {
    this.closePad();
    this.removeTarget.set(row);
    this.removeOpen.set(true);
  }

  confirmRemove(): void {
    const row = this.removeTarget();
    this.removeOpen.set(false);
    this.removeTarget.set(null);
    const programId = this._programId;
    const workoutId = this._workoutId;
    if (!row || !programId || !workoutId) {
      return;
    }
    // Its waiting targets go with it.
    this._dirty.delete(row.key);
    const timer = this._timers.get(row.key);
    if (timer) {
      clearTimeout(timer);
      this._timers.delete(row.key);
    }
    this._perSetKeys.delete(row.key);
    void this._write(() => this._source.removeExercise(programId, workoutId, row.key));
  }

  openExercise(row: DraftExercise): void {
    void this._router.navigate([this._stack, 'exercise', row.exerciseId]);
  }

  // ─── Name and note ─────────────────────────────────────────────

  /**
   * Write name and note if they differ from what the server has. Resolves
   * to whether the day is now saved; a save already in flight is awaited
   * rather than duplicated.
   */
  saveFields(): Promise<boolean> {
    const programId = this._programId;
    const workoutId = this._workoutId;
    // A client's copy keeps the day's name and note as the program has them.
    if (!programId || !workoutId || !this._fieldsSeeded || this.isCopy) {
      return Promise.resolve(true);
    }

    let name = this.name().trim();
    if (!name) {
      name = this._translateService.instant('programs.dayEditor.untitledDay');
    }
    const note = this.note().trim();
    if (name === this._saved.name && note === this._saved.note) {
      return this._pendingSave ?? Promise.resolve(true);
    }

    const previous = this._saved;
    this._saved = { name, note };
    this._pendingSave = firstValueFrom(
      this._programService.updateWorkout(programId, workoutId, { name, notes: note }),
    )
      .then(() => true)
      .catch((err: unknown) => {
        this._saved = previous;
        void this._feedbackService.error(
          err,
          this._translateService.instant('programs.dayEditor.toast.saveFailed'),
        );
        return false;
      })
      .finally(() => {
        this._pendingSave = null;
      });
    return this._pendingSave;
  }

  async done(): Promise<void> {
    const programId = this._programId;
    if (!programId) {
      return;
    }
    this.closePad();
    this.saving.set(true);
    const saved = await this.saveFields();
    await this.flushSets();
    this.saving.set(false);
    // Back to the week this came from (or the client's copy), but only with the day saved.
    if (saved) {
      void this._router.navigate(this._source.backCommands(this._stack, programId));
    }
  }

  // ─── Saving targets ────────────────────────────────────────────

  /** Save every exercise whose targets are waiting, now, and wait for all of them. */
  async flushSets(): Promise<void> {
    for (const timer of this._timers.values()) {
      clearTimeout(timer);
    }
    this._timers.clear();
    await Promise.all([...this._dirty].map((key) => this._saveSets(key)));
    await Promise.all([...this._inFlight.values()]);
  }

  /** A change to one exercise's targets: on screen now, saved a moment later. */
  private _change(key: string, change: (row: DraftExercise) => DraftExercise): void {
    let changed = false;
    this.drafts.update((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return row;
        }
        changed = true;
        return change(row);
      }),
    );
    if (changed) {
      this._scheduleSave(key);
    }
  }

  private _scheduleSave(key: string): void {
    this._dirty.add(key);
    const timer = this._timers.get(key);
    if (timer) {
      clearTimeout(timer);
    }
    this._timers.set(
      key,
      setTimeout(() => {
        this._timers.delete(key);
        void this._saveSets(key);
      }, SAVE_DELAY_MS),
    );
  }

  /**
   * One exercise's sets in one request. One save per exercise at a time: a
   * change made while one is out is sent after it, with the ids it returns.
   */
  private async _saveSets(key: string): Promise<void> {
    let running = this._inFlight.get(key);
    while (running) {
      await running;
      running = this._inFlight.get(key);
    }
    if (!this._dirty.has(key)) {
      return;
    }
    const programId = this._programId;
    const workoutId = this._workoutId;
    const row = this._row(key);
    this._dirty.delete(key);
    if (!programId || !workoutId || !row || !row.sets.length) {
      return;
    }
    const sent = row.sets.map((set) => set.key);
    const request = firstValueFrom(
      this._source.setSets(programId, workoutId, key, setItems(row, this.extras())),
    )
      .then((saved) => {
        this._afterSave(key, sent, saved);
        this._markCopyChanged(key);
      })
      .catch((err: unknown) => {
        void this._feedbackService.error(
          err,
          this._translateService.instant('programs.dayEditor.toast.saveFailed'),
        );
        // What the server holds is the truth again.
        this.load();
      })
      .finally(() => {
        this._inFlight.delete(key);
      });
    this._inFlight.set(key, request);
    await request;
  }

  /**
   * The saved sets come back in the order sent: a set that was new takes its
   * id as its key, so the next save updates it rather than adding another.
   */
  private _afterSave(key: string, sent: readonly string[], saved: readonly PrescribedSet[]): void {
    const renamed = new Map<string, string>();
    sent.forEach((sentKey, index) => {
      const set = saved[index];
      if (set && isNewSetKey(sentKey)) {
        renamed.set(sentKey, set.id);
      }
    });
    if (renamed.size) {
      this.drafts.update((rows) =>
        rows.map((row) => {
          if (row.key !== key) {
            return row;
          }
          return {
            ...row,
            sets: row.sets.map((set) => {
              const id = renamed.get(set.key);
              if (id) {
                return { ...set, key: id };
              }
              return set;
            }),
          };
        }),
      );
      this.extras.update((extras) => {
        const next = { ...extras };
        renamed.forEach((id, oldKey) => {
          const own = next[oldKey];
          delete next[oldKey];
          const set = saved.find((s) => s.id === id);
          if (own) {
            next[id] = own;
          } else if (set) {
            next[id] = extrasOf(set);
          }
        });
        return next;
      });
      const edit = this.editing();
      if (edit) {
        const id = renamed.get(edit.setKey);
        if (id) {
          this.editing.set({ ...edit, setKey: id });
        }
      }
      const menu = this.menuFor();
      if (menu) {
        const id = renamed.get(menu.setKey);
        if (id) {
          this.menuFor.set({ ...menu, setKey: id });
        }
      }
    }
    // The day's tree follows, so its estimate counts what was saved.
    this.workout.update((day) => {
      if (!day) {
        return day;
      }
      return {
        ...day,
        exercises: (day.exercises ?? []).map((exercise) => {
          if (exercise.id === key) {
            return { ...exercise, sets: [...saved] };
          }
          return exercise;
        }),
      };
    });
  }

  /**
   * A change to the day's shape: the targets still waiting go first, then
   * the one request, then the day is read again.
   */
  private async _write(request: () => Observable<unknown>, failedKey?: string): Promise<void> {
    this.saving.set(true);
    await this.flushSets();
    let failed = 'programs.dayEditor.toast.saveFailed';
    if (failedKey) {
      failed = failedKey;
    }
    request()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(err, this._translateService.instant(failed));
          this.load();
        },
      });
  }

  // ─── Internals ─────────────────────────────────────────────────

  /** The copy's source, for what only a copy does (swap, revert, move the day). */
  private _copySource(): CopyDaySource | null {
    if (this._source instanceof CopyDaySource) {
      return this._source;
    }
    return null;
  }

  /**
   * On a client's copy, an exercise whose sets were just saved carries its
   * label at once ("Changed for Anna"), as the next read will.
   */
  private _markCopyChanged(key: string): void {
    if (!this.isCopy) {
      return;
    }
    this.copy.update((copy) => {
      if (!copy) {
        return copy;
      }
      const exercises = copy.day.exercises.map((row) => {
        if (row.id === key) {
          return markedChanged(row);
        }
        return row;
      });
      return { ...copy, day: { ...copy.day, changed: true, exercises } };
    });
  }

  private _newKey(): string {
    this._keySeq += 1;
    return `${NEW_SET_PREFIX}${this._keySeq}`;
  }

  private _row(key: string | null): DraftExercise | null {
    if (key === null) {
      return null;
    }
    return this.drafts().find((row) => row.key === key) ?? null;
  }

  private _nameOf(key: string | null): string {
    const row = this._row(key);
    if (!row) {
      return '';
    }
    return row.name;
  }

  private _findSet(exerciseKey: string, setKey: string): DraftSet | null {
    const row = this._row(exerciseKey);
    if (!row) {
      return null;
    }
    return row.sets.find((set) => set.key === setKey) ?? null;
  }

  /** The extras one set of a row is saved with (its own, or those it takes from the set before). */
  private _extrasAt(row: DraftExercise, index: number): SetExtras {
    return extrasForSets(row, this.extras())[index] ?? NO_EXTRAS;
  }

  /** The rows as the superset helpers take them: the exercise's id and group. */
  private _linkRows(): { id: string; supersetGroupId: number | null }[] {
    return this.drafts().map((row) => ({ id: row.key, supersetGroupId: row.supersetGroupId }));
  }

  private _setDraft(value: number | null): void {
    if (value === null) {
      this.draft.set('');
      return;
    }
    this.draft.set(String(value));
  }

  /** Saves whatever the open keypad holds, before focus leaves its cell. */
  private _keepTyped(): void {
    const keypad = this._keypad();
    if (this.editing() && keypad) {
      this._apply(keypad.committed());
    }
  }

  private async _revealEditing(opening: boolean): Promise<void> {
    const page = this._elementRef.nativeElement;
    const row = page.querySelector<HTMLElement>('[data-editing]');
    const content = this._content();
    if (!row || !content) {
      return;
    }
    let duration = PAD_REVEAL_MS;
    if (opening || prefersReducedMotion()) {
      duration = 0;
    }
    await revealAbovePad(content, page, row, duration);
  }

  /** Writes the typed value into the cell the pad is bound to. Unchanged is not an edit. */
  private _apply(typed: string): void {
    const edit = this.editing();
    if (!edit) {
      return;
    }
    const raw = typed.trim();
    let value: number | null = null;
    if (raw !== '') {
      value = Number(raw);
    }
    if (value !== null && Number.isNaN(value)) {
      return;
    }
    if (edit.setKey === ALL_SETS) {
      const row = this._row(edit.exerciseKey);
      if (!row) {
        return;
      }
      let first: DraftSet | null = null;
      if (row.sets.length) {
        first = row.sets[0];
      }
      if (cellValue(first, edit.field) === value) {
        return;
      }
      this._change(edit.exerciseKey, (current) => withAll(current, edit.field, value));
      return;
    }
    const set = this._findSet(edit.exerciseKey, edit.setKey);
    if (!set || cellValue(set, edit.field) === value) {
      return;
    }
    this._change(edit.exerciseKey, (row) => ({
      ...row,
      sets: row.sets.map((current) => {
        if (current.key === edit.setKey) {
          return withValue(current, edit.field, value);
        }
        return current;
      }),
    }));
  }

  private _editingAll(): { row: DraftExercise; field: SetField } | null {
    const edit = this.editing();
    if (!edit || edit.setKey !== ALL_SETS) {
      return null;
    }
    const row = this._row(edit.exerciseKey);
    if (!row) {
      return null;
    }
    return { row, field: edit.field };
  }

  private _editingCell(): { row: DraftExercise; index: number; field: SetField } | null {
    const edit = this.editing();
    if (!edit) {
      return null;
    }
    const row = this._row(edit.exerciseKey);
    if (!row) {
      return null;
    }
    const index = row.sets.findIndex((set) => set.key === edit.setKey);
    if (index < 0) {
      return null;
    }
    return { row, index, field: edit.field };
  }
}
