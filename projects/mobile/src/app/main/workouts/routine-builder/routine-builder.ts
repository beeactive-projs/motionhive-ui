import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Config,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonCard,
  IonList,
  IonNote,
  IonReorder,
  IonReorderGroup,
  IonRouterOutlet,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  NavController,
  Platform,
  ReorderEndCustomEvent,
  ViewDidEnter,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Subscription, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';

import {
  AppModeStore,
  AuthStore,
  Exercise,
  ExerciseKind,
  ExerciseSetType,
  LoggedSet,
  NavModes,
  Routine,
  RoutineService,
  RoutineSources,
  SetField,
  WorkoutLogService,
  dayInSentence,
  localDayKey,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { resolveMode } from '../../../_shared/config/tabs.config';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { prefersReducedMotion } from '../../../_shared/utils/motion';
import { PAGE_BACK_PRIORITY, swipeBackDefault } from '../../../_shared/utils/swipe-back';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { kindIcon, kindTone, levelLabel } from '../../exercises/exercises.config';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import { PAD_REVEAL_MS, revealAbovePad } from '../_components/numeric-keypad/pad-reveal';
import { SetRow } from '../_components/set-row/set-row';
import { SetTableHead } from '../_components/set-table-head/set-table-head';
import { OverviewExercise, WorkoutOverview } from '../_components/workout-overview/workout-overview';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { RoutineActionsService } from '../_services/routine-actions.service';
import { WorkoutSettingsStore } from '../_services/workout-settings.store';
import {
  PlanStep,
  PlanSteppers,
  stepperLabelKey,
  stepperLabelWithUnit,
} from '../_components/plan-steppers/plan-steppers';
import { SetMenuSheet } from '../_sheets/set-menu-sheet/set-menu-sheet';
import {
  KEYPAD_FIELD,
  SetBadge,
  SetRowModes,
  cellValue,
  columnLabelKey,
  setBadge,
  setLine,
} from '../logger/logger-flow';
import {
  DEFAULT_SETS,
  KEYPAD_STEP,
  KeypadField,
  KeypadFields,
  ROUTINE_EDIT_PARAM,
  RoutineActionId,
  RoutineActionIds,
  WORKOUT_ICONS,
  contentsLine,
  prescriptionLine,
  routineActions,
  secondsToClock,
} from '../workouts.config';
import {
  BuilderExerciseActionId,
  BuilderExerciseActionIds,
  BuilderOptionId,
  BuilderOptionIds,
  DraftExercise,
  DraftSet,
  KeyMaker,
  NO_REST,
  ROUTINE_REST,
  builderExerciseActions,
  builderOptions,
  builderRestChoices,
  copyOfSet,
  draftFields,
  draftFromPick,
  draftFromRoutine,
  draftSignature,
  exerciseRest,
  flattened,
  linkedToNext,
  moveItem,
  nextSet,
  normalizeSupersets,
  payloadExercises,
  personDefaultLabel,
  repsRangeText,
  routineRestLabel,
  stepperFields,
  steppedAll,
  supersetTags,
  swapped,
  toggledLink,
  withAll,
  withExerciseRest,
  withSetCount,
  withValue,
} from './routine-builder.config';
import { ParkedDraft, RoutineDraftStore } from './routine-draft.store';

/** The keypad's set key when it types one target into every set (a row's value). */
const ALL_SETS = '*';

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
  /** The same set last time, "60 × 8", for the Previous column; empty when none. */
  previous: string;
  previousSet: LoggedSet | null;
  /** The field open in the pad, when it is this set's. */
  editing: SetField | null;
  /** A rep range in its reps cell. */
  texts: Partial<Record<SetField, string>>;
}

/** One exercise of the routine as the page draws it. */
interface ExerciseView {
  row: DraftExercise;
  /** "A1": its superset tag, or null. */
  tag: string | null;
  fields: SetField[];
  /** Its sets, while it is planned set by set; the card shows the table then. */
  rows: SetView[];
  /** The row the pad types into, every set at once; null when none of its rows. */
  activeField: SetField | null;
  canAddWeight: boolean;
  /** "2:00" on its rest chip, or empty when it takes the routine's rest. */
  restChip: string;
  /**
   * The rest chip's accessible name, with the rest it stands for: "Rest for
   * Squat, 2:00", or "…, same as the routine (2:30)". The chip shows only the
   * time or the word, so its name has to say whose and how long.
   */
  restName: string;
  /** Linked to the exercise after it, for the chip between the two cards. */
  linkedToNext: boolean;
}

/** The URL segment that means "a routine that does not exist yet". */
const NEW = 'new';

/**
 * The routine builder: the logger without a stopwatch (user decision,
 * 2026-11-16). The same exercise cards, the same set table and the same
 * number pad as an empty workout, so planning a set and logging one are one
 * learned gesture. A set holds targets rather than what was done: reps or a
 * time, a weight, a distance, by the exercise's kind, and nothing to tick.
 *
 * Handles `new` and an existing id on the same screen: the only difference
 * is whether the save is a create or an update. A saved routine opens read
 * first, in the same overview a plan's day uses, with Start as the one ask
 * and Edit as a quiet text action that swaps the builder in. A starter only
 * ever reads: runnable and copyable, never editable.
 *
 * Each card keeps the controls the builder always had: the sets stepper,
 * its own rest and Remove under the table, and the chip between two cards
 * that links them as a superset. "Save and start" closes the page, in the
 * content rather than fixed over it (user decisions, 2026-11-16).
 *
 * Nothing in the draft is lost by looking away. An exercise's page opens over
 * this one, which waits underneath as it was. A tab tap lands on the tab's
 * first page and throws this one away, so the draft is parked as it goes
 * (`RoutineDraftStore`) and comes back the next time this routine, or a new
 * one in the same tab, opens (user decision, 2026-11-17). Leaving with
 * changes unsaved asks first (the back chevron, Cancel, Android's back), and
 * the iOS edge swipe is off while the builder shows, as in the logger: a set
 * swipes right to Copy, and the back gesture would win.
 */
@Component({
  selector: 'mh-routine-builder',
  imports: [
    ActionSheet,
    ChoiceSheet,
    ConfirmSheet,
    EmptyState,
    ExerciseCard,
    ExercisePickerSheet,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
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
    IonNote,
    IonReorder,
    IonReorderGroup,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    NumericKeypad,
    PlanSteppers,
    SetMenuSheet,
    SetRow,
    SetTableHead,
    SettingsRow,
    TranslatePipe,
    WorkoutOverview,
  ],
  templateUrl: './routine-builder.html',
  styleUrl: './routine-builder.scss',
})
export class RoutineBuilder implements ViewWillEnter, ViewDidEnter, ViewWillLeave {
  private readonly _routineService = inject(RoutineService);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  private readonly _platform = inject(Platform);
  /** Absent in tests: there is no outlet around the page there. */
  private readonly _ionRouterOutlet = inject(IonRouterOutlet, { optional: true });
  private readonly _config = inject(Config);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _activeWorkoutService = inject(ActiveWorkoutService);
  private readonly _translateService = inject(TranslateService);
  private readonly _routineActionsService = inject(RoutineActionsService);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _settingsStore = inject(WorkoutSettingsStore);
  private readonly _routineDraftStore = inject(RoutineDraftStore);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly Modes = SetRowModes;
  readonly RoutineRest = ROUTINE_REST;
  readonly skeletonRows = [1, 2, 3, 4];

  /**
   * The stack this page was pushed onto. It is mounted under the trainee's
   * Workouts tab and the coach's Programs tab, and back returns to origin,
   * so the back fallback and every way out of the page stay in that stack.
   * Pushing an exercise onto the other tab left back nowhere to return to.
   */
  readonly stackBase = computed(() =>
    this._router.url.startsWith('/tabs/programs') ? '/tabs/programs' : '/tabs/workouts',
  );

  // ─── The draft ────────────────────────────────────────────────

  readonly routine = signal<Routine | null>(null);
  readonly name = signal('');
  /** The routine's own note, what the read view shows as "Your notes". */
  readonly notes = signal('');
  readonly exercises = signal<DraftExercise[]>([]);
  /** "Rest between sets", for every exercise that sets none; null takes the person's. */
  readonly defaultRest = signal<number | null>(null);
  /** What the draft was when last loaded or saved: any difference is unsaved. */
  private readonly _savedSignature = signal(draftSignature('', null, []));
  /** What a save would send now. */
  private readonly _signature = computed(() =>
    draftSignature(this.name(), this.defaultRest(), this.exercises(), this.notes()),
  );
  readonly dirty = computed(() => this._signature() !== this._savedSignature());

  private _keySeq = 0;
  private readonly _nextKey: KeyMaker = () => `k${++this._keySeq}`;

  /** "A1", "A2": the superset tags, one per row. */
  readonly tags = computed(() => supersetTags(this.exercises()));

  /** Per-exercise "last time" sets, keyed by exercise id, for the Previous column. */
  private readonly _previous = signal<Readonly<Record<string, LoggedSet[]>>>({});

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly copying = signal(false);
  readonly deleting = signal(false);
  /** Save or Start tapped with no name: the field says so. */
  readonly nameError = signal(false);

  readonly pickerOpen = signal(false);
  readonly deleteOpen = signal(false);
  readonly actionsOpen = signal(false);
  readonly copyConfirmOpen = signal(false);
  readonly discardOpen = signal(false);
  /** The builder's ⋯ (`options`). */
  readonly optionsOpen = signal(false);
  /** Both lead off this page, so each is closed before navigating (see ConfirmSheet.close). */
  private readonly _copySheet = viewChild<ConfirmSheet>('copySheet');
  private readonly _deleteSheet = viewChild<ConfirmSheet>('deleteSheet');
  private readonly _discardSheet = viewChild<ConfirmSheet>('discardSheet');
  private readonly _nameInput = viewChild<IonInput>('nameInput');
  /** What the discard sheet's Discard does: back out of the page, or out of editing. */
  private _discardThen: 'leave' | 'cancel' = 'leave';

  /** A saved routine reads until Edit is tapped. */
  readonly editMode = signal(false);
  /** The cards folded into a list of handles, to drag into a new order. */
  readonly reordering = signal(false);
  /** The order being dragged, a copy: Done keeps it, back leaves the routine as it was. */
  readonly reorderRows = signal<DraftExercise[]>([]);

  /**
   * A signal, not a field: `isNew` is a computed over it, and a computed
   * cannot see a plain property change.
   */
  private readonly _id = signal<string | null>(null);
  private readonly _onScreen = signal(false);
  /**
   * Set when this page leaves by its own doing (saved, discarded, started),
   * so the next visit starts clean. Any other leaving (an exercise's page,
   * another tab) comes back to the draft as it was.
   */
  private _exiting = false;
  /**
   * Left without exiting, until an entry completes (`ionViewDidEnter`). Not
   * cleared on `ionViewWillEnter`: an iOS edge swipe fires that as it starts,
   * and nothing undoes it when the swipe is let go.
   */
  private _keepDraft = false;
  /**
   * This page's address without its query, where a parked draft is looked
   * for. A saved routine parks under its own address instead (`_parkDraft`),
   * which differs once a new routine is saved without leaving the page.
   */
  private _path = '';
  private _backSubscription: Subscription | null = null;

  readonly isNew = computed(() => {
    const id = this._id();
    return id === NEW || id === null;
  });

  readonly showSkeleton = computed(() => this.loading() && !this.routine());
  readonly showError = computed(() => this.error() && !this.routine());

  /** A starter belongs to nobody: runnable and copyable, never editable. */
  readonly readOnly = computed(() => this.routine()?.source === RoutineSources.System);

  /**
   * The role this person chose, which decides what the page offers. A coach
   * looks at a routine to shape it and hand it out — copy and edit — while
   * a trainee looks at one to do it, so Start leads. Someone who is not an
   * instructor is always training.
   */
  readonly isCoachMode = computed(
    () =>
      resolveMode(this._authStore.isInstructor(), this._appModeStore.mode()) === NavModes.Coach,
  );

  /** What a starter does for this reader: become theirs by starting, or by copying. */
  readonly starterHint = computed(() =>
    this._translateService.instant(
      this.isCoachMode()
        ? 'workouts.routineBuilder.starterNoteCoach'
        : 'workouts.routineBuilder.starterNote',
    ),
  );

  /** The read view: any saved routine, unless you are editing your own. */
  readonly showOverview = computed(
    () => !this.isNew() && !!this.routine() && (this.readOnly() || !this.editMode()),
  );

  /** The builder itself, as against the read view and the loading and error states. */
  readonly showBuilder = computed(
    () => !this.showOverview() && !this.showSkeleton() && !this.showError(),
  );

  /**
   * Editing a routine that already exists — Cancel puts it back. Only once
   * it has loaded: opened to edit and still loading, or failed, there is
   * nothing to put back, and Cancel there left the page where it was.
   */
  readonly editingSaved = computed(
    () => !this.isNew() && this.editMode() && !this.readOnly() && !!this.routine(),
  );

  /** Leaving now would lose something: the back chevron asks first. */
  readonly guarded = computed(() => this.showBuilder() && this.dirty());

  /**
   * Start at the end of the builder, once there is something to start:
   * training only. Coaching, a routine is something to hand out, and Save
   * is the whole job.
   */
  readonly showStart = computed(
    () =>
      this.showBuilder() &&
      !this.reordering() &&
      !this.isCoachMode() &&
      !this.readOnly() &&
      this.exercises().length > 0,
  );

  /** Nothing to save first: just Start. Otherwise the button says it saves. */
  readonly startLabel = computed(() =>
    !this.isNew() && !this.dirty()
      ? 'workouts.common.startWorkout'
      : 'workouts.routineBuilder.saveAndStart',
  );

  /**
   * The ⋯, on your own saved routine while it reads (docs/MOBILE-ACTIONS.md).
   * A starter has one verb, copying it, and that is its footer button.
   */
  readonly showActions = computed(() => this.showOverview() && !this.readOnly());

  /** Coaching puts Edit in the footer; training puts Start there, so Edit joins the sheet. */
  readonly actions = computed(() =>
    routineActions(this.isCoachMode(), this.routine()?.archived ?? false),
  );

  readonly copyBody = computed(() =>
    this._translateService.instant('workouts.routineBuilder.copyConfirm.body', {
      name: this.routine()?.name ?? '',
    }),
  );

  readonly discardBody = computed(() =>
    this.isNew()
      ? this._translateService.instant('workouts.routineBuilder.discard.newBody')
      : this._translateService.instant('workouts.routineBuilder.discard.editBody', {
          name: this.routine()?.name ?? '',
        }),
  );

  readonly title = computed(() => {
    if (this.reordering()) {
      return this._translateService.instant('workouts.routineBuilder.reorder.title');
    }
    if (this.isNew()) return this._translateService.instant('workouts.common.newRoutine');
    // The overview carries the name as its heading; the bar names the kind of page.
    if (this.showOverview()) return this._translateService.instant('workouts.routineBuilder.title');
    return this.routine()?.name ?? this._translateService.instant('workouts.routineBuilder.title');
  });

  /**
   * The builder's header, the workout's: the name as typed, else "New
   * routine" or the saved name, over what is in it so far ("3 exercises ·
   * 12 sets"), as the workout's name sits over its clock.
   */
  readonly headerName = computed(() => this.name().trim() || this.title());

  readonly headerMeta = computed(() => {
    const rows = this.exercises();
    return contentsLine(
      rows.length,
      rows.reduce((total, row) => total + row.sets.length, 0),
    );
  });

  /** The builder's ⋯: Discard only once there is something to lose. */
  readonly options = computed(() =>
    builderOptions(
      this.exercises().length > 1,
      !this.dirty() ? null : this.isNew() ? 'new' : 'edit',
    ),
  );

  /** Whose it is, or when you last did it — the fact that places it. */
  readonly eyebrow = computed(() => {
    const routine = this.routine();
    if (!routine) return null;
    if (this.readOnly()) return this._translateService.instant('workouts.routineView.starter');
    return routine.lastPerformedAt
      ? this._translateService.instant('workouts.routineRow.lastDone', {
          // Inside a sentence: "today", and Romanian's weekday in lower case.
          day: dayInSentence(localDayKey(new Date(routine.lastPerformedAt))),
        })
      : this._translateService.instant('workouts.routineView.yours');
  });

  /**
   * "6 exercises · 19 sets" under the name, the builder's header line, and
   * a starter's level after it. Counted off the saved tree, as the list
   * under it is, so the two never disagree.
   */
  readonly overviewMeta = computed(() => {
    const routine = this.routine();
    if (!routine) return null;
    const exercises = routine.exercises ?? [];
    const sets = exercises.reduce(
      (total, e) => total + (e.sets.length || e.defaultSets || DEFAULT_SETS),
      0,
    );
    // A list response carries only the count, and no sets to add up.
    const parts = [contentsLine(exercises.length || routine.exerciseCount, sets)];
    if (routine.level) parts.push(levelLabel(routine.level));
    return parts.filter(Boolean).join(' · ') || null;
  });

  /** The saved routine's rest, not the draft's: what Start will rest. */
  readonly overviewRest = computed(() =>
    routineRestLabel(
      this.routine()?.defaultRestSeconds ?? null,
      this._settingsStore.settings().defaultRestSeconds,
    ),
  );

  readonly noteLabel = computed(() =>
    this._translateService.instant(
      this.readOnly() ? 'workouts.routineView.about' : 'workouts.routineView.notes',
    ),
  );

  /**
   * The saved routine, not the draft: the overview shows what Start will run.
   * A routine saved by the simple editor may carry only the flat summary, so
   * that stands in for the per-set rows when there are none.
   */
  readonly overviewExercises = computed<OverviewExercise[]>(() =>
    (this.routine()?.exercises ?? []).map((e) => ({
      key: e.id,
      exercise: {
        id: e.exerciseId,
        name: e.exercise?.name ?? this._translateService.instant('workouts.common.exercise'),
        kind: (e.exercise?.kind as ExerciseKind | undefined) ?? ExerciseKind.Strength,
        thumbnailUrl: e.exercise?.thumbnailUrl ?? null,
      },
      prescription: prescriptionLine(
        e.sets.length
          ? e.sets
          : Array.from({ length: e.defaultSets || DEFAULT_SETS }, () => ({
              targetRepsMin: e.targetRepsMin,
              targetRepsMax: e.targetRepsMax,
              targetWeightKg: e.targetWeightKg,
              targetDurationSeconds: null,
            })),
        e.exercise?.kind ?? null,
      ),
    })),
  );

  /** Something to save: the name is asked for on the tap, so the button never sits dead. */
  readonly canSave = computed(() => this.exercises().length > 0 && !this.readOnly());

  // ─── The set table ────────────────────────────────────────────

  /** The cell the keypad is editing, or null when it is closed. */
  readonly editing = signal<CellEdit | null>(null);
  readonly draft = signal('');
  /**
   * What the keypad has typed so far, echoed into the open cell; null until
   * it is touched.
   */
  readonly typed = signal<string | null>(null);
  /** Read when focus jumps to another cell, so what was typed is kept. */
  private readonly _keypad = viewChild(NumericKeypad);
  private readonly _content = viewChild(IonContent);
  /** The cell the pad was last kept in view for; '' while the pad is closed. */
  private _revealedKey = '';

  readonly views = computed<ExerciseView[]>(() => {
    const rows = this.exercises();
    const tags = this.tags();
    const editing = this.editing();
    const previous = this._previous();
    // What an exercise with no rest of its own rests: the routine's, else the person's.
    const routineRest = secondsToClock(
      this.defaultRest() ?? this._settingsStore.settings().defaultRestSeconds,
    );
    return rows.map((row, index): ExerciseView => {
      const fields = draftFields(row);
      const last = previous[row.exerciseId] ?? [];
      const own = exerciseRest(row);
      return {
        row,
        tag: tags[index],
        fields,
        activeField:
          editing?.exerciseKey === row.key && editing.setKey === ALL_SETS ? editing.field : null,
        canAddWeight: row.kind === ExerciseKind.Bodyweight && !row.addedWeight,
        restChip: own === null ? '' : secondsToClock(own),
        restName:
          own === null
            ? this._translateService.instant('workouts.routineBuilder.rest.exerciseInherited', {
                name: row.name,
                value: routineRest,
              })
            : this._translateService.instant('workouts.routineBuilder.rest.exerciseOwn', {
                name: row.name,
                value: secondsToClock(own),
              }),
        linkedToNext: linkedToNext(rows, index),
        rows: row.sets.map((set, i): SetView => {
          const prev = last[i] ?? null;
          const range = repsRangeText(set);
          return {
            set,
            badge: setBadge(row.sets, i),
            previous: prev ? setLine(fields, (field) => cellValue(prev, field), false) : '',
            previousSet: prev,
            editing:
              editing?.exerciseKey === row.key && editing.setKey === set.key ? editing.field : null,
            texts: range ? { reps: range } : {},
          };
        }),
      };
    });
  });

  readonly editingKey = computed(() => {
    const edit = this.editing();
    return edit ? `${edit.exerciseKey}:${edit.setKey}:${edit.field}` : '';
  });

  readonly keypadField = computed<KeypadField>(() => {
    const edit = this.editing();
    return edit ? KEYPAD_FIELD[edit.field] : KeypadFields.Reps;
  });

  /**
   * "Back squat · Set 3 · kg": which cell the pad is filling, in the table's
   * words; "Back squat · Weight (kg)" for a row, every set at once.
   */
  readonly keypadLabel = computed(() => {
    const all = this._editingAll();
    if (all) {
      // The row says "Weight" and keeps its kg on the value; the pad's title
      // stands away from both, so it names the unit itself.
      const label = stepperLabelWithUnit(all.row, all.field, (key, params) =>
        this._translateService.instant(key, params),
      );
      return `${all.row.name} · ${label}`;
    }
    const found = this._editingCell();
    if (!found) return '';
    const { row, index, field } = found;
    return [
      row.name,
      setBadge(row.sets, index).name,
      this._translateService.instant(columnLabelKey(field, row.unilateral)),
    ].join(' · ');
  });

  /**
   * The pad's wide key: on to the next field ("Reps →"), then on to the next
   * set, and Done on the last cell of the last set. On a row, on to the next
   * row, and Done on the last.
   */
  readonly keypadAction = computed<{ label: string; icon: string | null; slot: 'start' | 'end' }>(
    () => {
      const all = this._editingAll();
      if (all) {
        const rows = stepperFields(all.row);
        const nextRow = rows[rows.indexOf(all.field) + 1];
        // The next row by the name it wears ("Weight"), not the set
        // table's column word ("kg").
        return nextRow
          ? {
              label: this._translateService.instant(stepperLabelKey(all.row, nextRow)),
              icon: 'arrow-forward-outline',
              slot: 'end',
            }
          : { label: '', icon: null, slot: 'start' };
      }
      const found = this._editingCell();
      if (!found) return { label: '', icon: null, slot: 'start' };
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
      return { label: '', icon: null, slot: 'start' };
    },
  );

  /** What the picker should already show as taken. */
  readonly addedIds = computed(() => this.exercises().map((row) => row.exerciseId));

  /** The exercise being swapped out, or null when the picker is adding. */
  readonly swapTarget = signal<string | null>(null);

  readonly pickerTitle = computed(() =>
    this._translateService.instant(
      this.swapTarget() ? 'workouts.exerciseActions.swap' : 'workouts.common.addExercises',
    ),
  );

  readonly pickerContext = computed(() => {
    const target = this._row(this.swapTarget());
    return (
      target?.name ||
      this.name() ||
      this._translateService.instant('workouts.routineBuilder.thisRoutine')
    );
  });

  // ─── Sheets on one exercise or set ────────────────────────────

  /** The exercise whose ⋮ is open, by key. */
  readonly actionsFor = signal<string | null>(null);
  readonly exerciseSheetOpen = signal(false);
  readonly exerciseTitle = computed(() => this._row(this.actionsFor())?.name ?? '');
  readonly exerciseActions = computed(() => {
    const rows = this.exercises();
    const index = rows.findIndex((row) => row.key === this.actionsFor());
    return builderExerciseActions(Math.max(index, 0), rows.length);
  });

  /** The set whose badge was tapped. */
  readonly menuFor = signal<{ exerciseKey: string; setKey: string; badge: SetBadge } | null>(null);
  readonly menuOpen = signal(false);
  readonly menuSet = computed(() => {
    const target = this.menuFor();
    return (
      this._row(target?.exerciseKey ?? null)?.sets.find((set) => set.key === target?.setKey) ??
      null
    );
  });

  /** Which rest the sheet is choosing: the routine's (`ROUTINE_REST`), or an exercise's (by key). */
  readonly restFor = signal<string | null>(null);
  readonly restOpen = signal(false);
  readonly defaultRestLabel = computed(() =>
    routineRestLabel(this.defaultRest(), this._settingsStore.settings().defaultRestSeconds),
  );
  readonly restSheetTitle = computed(() => {
    const target = this.restFor();
    if (target === null || target === ROUTINE_REST) {
      return this._translateService.instant('workouts.routineBuilder.rest.row');
    }
    return this._translateService.instant('workouts.routineBuilder.rest.exercise', {
      name: this._row(target)?.name ?? '',
    });
  });
  readonly restOptions = computed(() => {
    const target = this.restFor();
    const inherit =
      target === ROUTINE_REST || target === null
        ? personDefaultLabel(this._settingsStore.settings().defaultRestSeconds)
        : this._translateService.instant('workouts.routineBuilder.rest.sameAsRoutine', {
            value: this.defaultRestLabel(),
          });
    return builderRestChoices(inherit);
  });
  readonly restSelected = computed(() => {
    const target = this.restFor();
    const row = target === ROUTINE_REST || target === null ? null : this._row(target);
    const value = row ? exerciseRest(row) : this.defaultRest();
    return value === null ? NO_REST : String(value);
  });

  readonly deleteBody = computed(() => {
    const name =
      this.routine()?.name ??
      this._translateService.instant('workouts.routineBuilder.thisRoutine');
    return this._translateService.instant('workouts.routineBuilder.delete.message', { name });
  });

  constructor() {
    addIcons(WORKOUT_ICONS);
    // The edge swipe is off while the builder shows (its sets swipe right),
    // and back on for the read view. Only while on screen: leaving restores
    // it at once (`ionViewWillLeave`), before the next page sets its own.
    effect(() => {
      if (!this._onScreen()) return;
      this._setSwipeBack(!this.showBuilder());
    });
    // The pad docks below the list and takes its lower part, so the cell it
    // types into, low on the screen, would sit under it. Once the pad is
    // drawn, the list brings that cell up: in the same frame when the pad
    // opens, so nothing shows under it first, and gliding when the pad,
    // already up, moves on to a cell it hides.
    afterRenderEffect(() => {
      const key = this.editingKey();
      const opening = this._revealedKey === '';
      this._revealedKey = key;
      if (key) void this._revealEditing(opening);
    });
    this._destroyRef.onDestroy(() => {
      this._backSubscription?.unsubscribe();
      this._parkDraft();
    });
  }

  /**
   * Only what is safe to run twice: an iOS edge swipe back to this page fires
   * this as it starts, and again when the person comes back for real if they
   * let the swipe go. Turning the swipe off here would cut that gesture off
   * mid-drag, so the screen state waits for `ionViewDidEnter`.
   */
  ionViewWillEnter(): void {
    // Back from an exercise's page, or from another tab by a link: the page
    // is as it was.
    if (this._keepDraft) return;

    this._path = this._router.url.split(/[?#]/)[0];
    const id = this._route.snapshot.paramMap.get('id');
    // `new` is not an identity. Two visits to it are two different routines,
    // so one saved or discarded leaves the next clean (guarding on equality
    // here is what left the previous routine sitting in the form). Only a
    // draft the tab bar threw away comes back, parked.
    if (!id || id === NEW) {
      this._startNew();
      this._restoreParked();
      return;
    }

    if (id === this._id()) return;
    this._id.set(id);
    // The list's Edit swipe opens your own routine straight in the builder;
    // a starter still only reads (`showOverview`).
    this.editMode.set(this._route.snapshot.queryParamMap.has(ROUTINE_EDIT_PARAM));
    this.load();
  }

  /** On screen at last; then Android's back: the pad, then the reorder, then the unsaved draft. */
  ionViewDidEnter(): void {
    this._keepDraft = false;
    this._onScreen.set(true);
    this._setSwipeBack(!this.showBuilder());
    this._backSubscription?.unsubscribe();
    this._backSubscription = this._platform.backButton.subscribeWithPriority(
      PAGE_BACK_PRIORITY,
      (processNextHandler) => {
        if (this.editing()) {
          this.closePad();
          return;
        }
        if (this.reordering()) {
          this.cancelReorder();
          return;
        }
        if (this.guarded()) {
          this.askLeave();
          return;
        }
        processNextHandler();
      },
    );
  }

  ionViewWillLeave(): void {
    this._onScreen.set(false);
    this._setSwipeBack(true);
    this._backSubscription?.unsubscribe();
    this._backSubscription = null;
    this._keepTyped();
    this.editing.set(null);
    this._keepDraft = !this._exiting;
    this._exiting = false;
  }

  load(): void {
    const id = this._id();
    if (!id || id === NEW) return;

    // The read view's rest row says the person's default when the routine
    // sets none; once per session.
    this._settingsStore.load();
    this.loading.set(true);
    this.error.set(false);
    // Silent: the page says it couldn't open the routine, so the global
    // error dialog would say it a second time, over it.
    this._routineService
      .get(id, { silent: true })
      .pipe(take(1))
      .subscribe({
        next: (routine) => {
          this.routine.set(routine);
          this._resetDraft(routine);
          this._restoreParked();
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  // ─── Actions (the ⋯) ──────────────────────────────────────────

  openActions(): void {
    this.actionsOpen.set(true);
  }

  /** The sheet reports the verb; this screen decides what it means. */
  onAction(id: RoutineActionId): void {
    switch (id) {
      case RoutineActionIds.Edit:
        this.edit();
        return;
      case RoutineActionIds.Duplicate:
        this.askCopy();
        return;
      case RoutineActionIds.Archive:
      case RoutineActionIds.Unarchive:
        this._setArchived(id === RoutineActionIds.Archive);
        return;
      case RoutineActionIds.Delete:
        this.deleteOpen.set(true);
        return;
    }
  }

  // ─── The builder's ⋯ ──────────────────────────────────────────

  openOptions(): void {
    this._keepTyped();
    this.editing.set(null);
    this.optionsOpen.set(true);
  }

  /** Discard asks first, as the back chevron and Cancel do. */
  onOption(id: BuilderOptionId): void {
    switch (id) {
      case BuilderOptionIds.AddExercises:
        this.addExercise();
        return;
      case BuilderOptionIds.Reorder:
        this.startReorder();
        return;
      case BuilderOptionIds.Discard:
        if (this.editingSaved()) {
          this.askCancel();
        } else {
          this.askLeave();
        }
        return;
    }
  }

  /**
   * Archive puts the routine away and goes back to the list it no longer
   * shows on; Unarchive brings it back and stays.
   */
  private _setArchived(archive: boolean): void {
    const id = this._id();
    if (!id || id === NEW) return;
    this._routineActionsService.setArchived(id, archive).subscribe((saved) => {
      this.routine.update((routine) => (routine ? { ...routine, archived: saved.archived } : routine));
      if (archive) {
        this._exiting = true;
        void this._router.navigate([this.stackBase()]);
      }
    });
  }

  // ─── Copying ──────────────────────────────────────────────────

  /** A copy is a new routine in the library, so it is asked first. */
  askCopy(): void {
    this.copyConfirmOpen.set(true);
  }

  /**
   * A copy of this routine, owned by the caller — how a coach makes a
   * MotionHive starter their own to change or hand out.
   *
   * Lands on the copy, replacing this page, as duplicating a program does:
   * the reason to copy is to change something, and the thing to change is
   * the new one. Back then returns to the list, not to the original.
   */
  makeCopy(): void {
    const id = this._id();
    if (!id || id === NEW || this.copying()) return;
    this.copying.set(true);
    this._routineActionsService
      .copy(id)
      .pipe(finalize(() => this.copying.set(false)))
      .subscribe(async (copy) => {
        await this._copySheet()?.close();
        this._exiting = true;
        void this._router.navigate([this.stackBase(), 'routine', copy.id], { replaceUrl: true });
      });
  }

  // ─── Editing and leaving ──────────────────────────────────────

  edit(): void {
    if (this.readOnly()) return;
    this.editMode.set(true);
    this._loadPrevious();
  }

  /** Drops the draft and returns to the read view of what is saved. */
  cancelEdit(): void {
    const routine = this.routine();
    if (routine) this._resetDraft(routine);
    this.editing.set(null);
    this.pickerOpen.set(false);
    this.reordering.set(false);
    this.nameError.set(false);
    this.editMode.set(false);
  }

  /** Cancel while editing a saved routine: asks first when something changed. */
  askCancel(): void {
    this._keepTyped();
    this.editing.set(null);
    if (!this.dirty()) {
      this.cancelEdit();
      return;
    }
    this._discardThen = 'cancel';
    this.discardOpen.set(true);
  }

  /** Back with changes unsaved: asks before they go. */
  askLeave(): void {
    this._keepTyped();
    this.editing.set(null);
    this._discardThen = 'leave';
    this.discardOpen.set(true);
  }

  async confirmDiscard(): Promise<void> {
    await this._discardSheet()?.close();
    if (this._discardThen === 'cancel') {
      this.cancelEdit();
      return;
    }
    this._exiting = true;
    // As the back button goes: down the stack, else to the stack's root.
    if (this._ionRouterOutlet?.canGoBack()) {
      void this._ionRouterOutlet.pop();
      return;
    }
    void this._navController.navigateBack(this.stackBase());
  }

  onName(value: string): void {
    this.name.set(value);
    if (value.trim()) this.nameError.set(false);
  }

  /**
   * Adds the picked movements, skipping any already in the routine, or puts
   * the one picked in place of the exercise being swapped. Adding the same
   * exercise twice by accident is far more common than wanting it twice on
   * purpose — and wanting more of it is what Add set is for.
   */
  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    const target = this.swapTarget();
    this.swapTarget.set(null);
    if (!picked.length) return;

    if (target) {
      const exercise = picked[0];
      this.exercises.update((rows) =>
        rows.map((row) => (row.key === target ? swapped(row, exercise, this._nextKey()) : row)),
      );
      this._loadPrevious();
      return;
    }

    const have = new Set(this.exercises().map((row) => row.exerciseId));
    const fresh = picked.filter((p) => !have.has(p.id));
    const skipped = picked.length - fresh.length;

    if (fresh.length) {
      this.exercises.update((rows) => [
        ...rows,
        ...fresh.map((p) => draftFromPick(p, this._nextKey)),
      ]);
      this._loadPrevious();
    }

    if (skipped > 0) {
      void this._feedbackService.info(
        this._translateService.instant('workouts.routineBuilder.toast.alreadyIn', {
          count: skipped,
        }),
      );
    }
  }

  addExercise(): void {
    this._keepTyped();
    this.editing.set(null);
    this.swapTarget.set(null);
    this.pickerOpen.set(true);
  }

  /** The catalog page, pushed onto this stack so the draft survives. */
  openExercise(row: DraftExercise): void {
    this.openExerciseById(row.exerciseId);
  }

  openExerciseById(exerciseId: string): void {
    void this._router.navigate([this.stackBase(), 'exercise', exerciseId]);
  }

  setsLabel(row: DraftExercise): string {
    return this._translateService.instant('count.sets', { count: row.sets.length });
  }

  /** The tile a reorder row leads with: the photo, else the kind's glyph. */
  tileOf(row: DraftExercise): { icon: string | null; tone: string; imageUrl: string | null } {
    return {
      icon: row.thumbnailUrl || !row.kind ? null : kindIcon(row.kind),
      tone: row.kind ? kindTone(row.kind) : 'medium',
      imageUrl: row.thumbnailUrl,
    };
  }

  /** Taking one half out of a superset unlinks the other. The pad goes with its exercise. */
  remove(index: number): void {
    const removed = this.exercises()[index];
    if (removed && this.editing()?.exerciseKey === removed.key) this.editing.set(null);
    this.exercises.update((rows) => normalizeSupersets(rows.filter((_, i) => i !== index)));
  }

  // ─── An exercise's ⋮ ──────────────────────────────────────────

  openExerciseActions(row: DraftExercise): void {
    this._keepTyped();
    this.editing.set(null);
    this.actionsFor.set(row.key);
    this.exerciseSheetOpen.set(true);
  }

  onExerciseAction(id: BuilderExerciseActionId): void {
    const key = this.actionsFor();
    const row = this._row(key);
    if (!key || !row) return;
    switch (id) {
      case BuilderExerciseActionIds.MoveUp:
      case BuilderExerciseActionIds.MoveDown:
        this.moveExercise(key, id === BuilderExerciseActionIds.MoveUp ? -1 : 1);
        return;
      case BuilderExerciseActionIds.Reorder:
        this.startReorder();
        return;
      case BuilderExerciseActionIds.Swap:
        this.swapTarget.set(key);
        this.pickerOpen.set(true);
        return;
    }
  }

  // ─── The rows: one target per row, for every set ──────────────

  /** One ± on a row: the number of sets, or a target of every set. */
  stepTarget(row: DraftExercise, step: PlanStep): void {
    this._keepTyped();
    this.editing.set(null);
    if (step.field === null) {
      this.setCount(row, step.delta);
      return;
    }
    const field = step.field;
    this._updateRow(row.key, (current) =>
      steppedAll(current, field, step.delta, KEYPAD_STEP[KEYPAD_FIELD[field]]),
    );
  }

  /** A row's value was tapped: the pad types that target, for every set at once. */
  editAll(row: DraftExercise, field: SetField): void {
    this._keepTyped();
    this.typed.set(null);
    this.editing.set({ exerciseKey: row.key, setKey: ALL_SETS, field });
    const value = cellValue(this._row(row.key)?.sets[0] ?? null, field);
    this.draft.set(value === null ? '' : String(value));
  }

  /**
   * Set by set, in the set table, or back to one row per target. Back
   * flattens: every set takes the first working set's targets.
   */
  togglePerSet(row: DraftExercise): void {
    this._keepTyped();
    this.editing.set(null);
    this._updateRow(row.key, (current) =>
      current.perSet ? flattened(current, this._nextKey()) : { ...current, perSet: true },
    );
  }

  /** The chip between two cards: link them as a superset, or undo it. */
  toggleLink(index: number): void {
    this._keepTyped();
    this.editing.set(null);
    this.exercises.update((rows) => toggledLink(rows, index));
  }

  // ─── Reordering ───────────────────────────────────────────────

  /** The cards fold to their names, over a copy of the order to drag. */
  startReorder(): void {
    this._keepTyped();
    this.editing.set(null);
    this.reorderRows.set(this.exercises());
    this.reordering.set(true);
  }

  /** A drag landed: the copy takes the new order. */
  onReorder(event: ReorderEndCustomEvent): void {
    const { from, to } = event.detail;
    // The page owns the order, so Ionic's own DOM move is cancelled.
    event.detail.complete(false);
    if (from === to) return;
    this.reorderRows.update((rows) => moveItem(rows, from, to));
  }

  /**
   * Done: the routine takes the new order, and supersets split where it
   * broke them. Only once the drags are over, so a pair dragged apart and
   * back together stays a pair.
   */
  doneReorder(): void {
    const rows = this.reorderRows();
    const moved = rows.some((row, i) => row.key !== this.exercises()[i]?.key);
    if (moved) this.exercises.set(normalizeSupersets(rows));
    this.reordering.set(false);
  }

  /** Back: out of the reorder, the order as it was. */
  cancelReorder(): void {
    this.reordering.set(false);
  }

  /**
   * Move up or Move down from an exercise's ⋮: one place, no dragging, so a
   * keyboard and a screen reader can change the order too. Supersets split
   * where the move broke them, as a drag does.
   */
  moveExercise(key: string, delta: -1 | 1): void {
    const rows = this.exercises();
    const from = rows.findIndex((row) => row.key === key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= rows.length) return;
    this.exercises.set(normalizeSupersets(moveItem(rows, from, to)));
  }

  // ─── Rest ─────────────────────────────────────────────────────

  /** The routine's rest (`ROUTINE_REST`), or an exercise's, by its row's key. */
  openRest(target: string): void {
    this._settingsStore.load();
    this.restFor.set(target);
    this.restOpen.set(true);
  }

  pickRest(value: string): void {
    const seconds = value === NO_REST ? null : Number(value);
    const target = this.restFor();
    if (target === ROUTINE_REST) {
      this.defaultRest.set(seconds);
    } else if (target !== null) {
      this._updateRow(target, (row) => withExerciseRest(row, seconds));
    }
  }

  // ─── Sets ─────────────────────────────────────────────────────

  addSet(row: DraftExercise): void {
    this._keepTyped();
    this.editing.set(null);
    this._updateRow(row.key, (current) => ({
      ...current,
      sets: [...current.sets, nextSet(current, this._nextKey())],
    }));
  }

  /** The sets stepper: one more like the last, or the last one off (never below one). */
  setCount(row: DraftExercise, delta: 1 | -1): void {
    this._keepTyped();
    this.editing.set(null);
    this._updateRow(row.key, (current) => withSetCount(current, delta, this._nextKey()));
  }

  /** Weighted pull-ups and dips still deserve a target weight, and push-ups not to be asked. */
  addWeight(row: DraftExercise): void {
    this._updateRow(row.key, (current) => ({ ...current, addedWeight: true }));
  }

  copySet(row: DraftExercise, set: DraftSet): void {
    this._keepTyped();
    this.editing.set(null);
    this._updateRow(row.key, (current) => {
      const at = current.sets.findIndex((s) => s.key === set.key);
      const source = current.sets[at] ?? set;
      const sets = [...current.sets];
      sets.splice(at + 1, 0, copyOfSet(source, this._nextKey()));
      return { ...current, sets };
    });
  }

  removeSet(row: DraftExercise, set: DraftSet): void {
    if (this.editing()?.setKey === set.key) this.editing.set(null);
    this._updateRow(row.key, (current) => ({
      ...current,
      sets: current.sets.filter((s) => s.key !== set.key),
    }));
  }

  /** Swipe right, then Copy: the row closes and a set like it is added after it. */
  swipeCopy(sliding: IonItemSliding, row: DraftExercise, set: DraftSet): void {
    void sliding.close();
    this.copySet(row, set);
  }

  /** Swipe left, then Delete: the row closes and the set goes. */
  swipeDelete(sliding: IonItemSliding, row: DraftExercise, set: DraftSet): void {
    void sliding.close();
    this.removeSet(row, set);
  }

  /** Previous was tapped: last time's numbers become this set's targets. */
  usePrevious(row: DraftExercise, set: DraftSet, previous: LoggedSet | null): void {
    if (!previous) return;
    this._keepTyped();
    this.editing.set(null);
    this._updateSet(row.key, set.key, (current) =>
      draftFields(row).reduce((next, field) => {
        const value = cellValue(previous, field);
        return value === null ? next : withValue(next, field, value);
      }, current),
    );
  }

  openMenu(row: DraftExercise, set: DraftSet, badge: SetBadge): void {
    this._keepTyped();
    this.editing.set(null);
    this.menuFor.set({ exerciseKey: row.key, setKey: set.key, badge });
    this.menuOpen.set(true);
  }

  onSetType(type: ExerciseSetType): void {
    const target = this.menuFor();
    if (!target) return;
    this._updateSet(target.exerciseKey, target.setKey, (set) => ({ ...set, setType: type }));
  }

  onSetCopy(): void {
    const target = this.menuFor();
    const row = this._row(target?.exerciseKey ?? null);
    const set = row?.sets.find((s) => s.key === target?.setKey);
    if (row && set) this.copySet(row, set);
  }

  onSetRemove(): void {
    const target = this.menuFor();
    const row = this._row(target?.exerciseKey ?? null);
    const set = row?.sets.find((s) => s.key === target?.setKey);
    if (row && set) this.removeSet(row, set);
  }

  // ─── The number pad ───────────────────────────────────────────

  editCell(row: DraftExercise, set: DraftSet, field: SetField): void {
    // Tapping another cell is a Done for this one: what was typed stays.
    this._keepTyped();
    this.typed.set(null);
    this.editing.set({ exerciseKey: row.key, setKey: set.key, field });
    const current = this._findSet(row.key, set.key) ?? set;
    const value = cellValue(current, field);
    this.draft.set(value === null ? '' : String(value));
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
    // Its cell is gone: nothing left to type into.
    if (!found) {
      this.editing.set(null);
      return;
    }
    const { row, index, field } = found;
    const fields = draftFields(row);
    const nextField = fields[fields.indexOf(field) + 1];
    const fresh = this._row(row.key);
    const set = fresh?.sets[index];
    if (fresh && set && nextField) {
      this.editCell(fresh, set, nextField);
      return;
    }
    const after = fresh?.sets[index + 1];
    if (fresh && after && fields[0]) {
      this.editCell(fresh, after, fields[0]);
      return;
    }
    this.editing.set(null);
  }

  /** Close keeps what was typed, like everywhere else. */
  closePad(): void {
    this._keepTyped();
    this.editing.set(null);
  }

  /** Saves whatever the open keypad holds — before focus leaves its cell. */
  private _keepTyped(): void {
    const keypad = this._keypad();
    if (this.editing() && keypad) this._apply(keypad.committed());
  }

  /** The row the pad types into, a target row or a set, kept above the pad. */
  private async _revealEditing(opening: boolean): Promise<void> {
    const page = this._elementRef.nativeElement;
    const row = page.querySelector<HTMLElement>('[data-editing]');
    const content = this._content();
    if (!row || !content) return;
    const duration = opening || prefersReducedMotion() ? 0 : PAD_REVEAL_MS;
    await revealAbovePad(content, page, row, duration);
  }

  /** Writes the typed value into the cell the pad is bound to. */
  private _apply(typed: string): void {
    const edit = this.editing();
    if (!edit) return;
    const raw = typed.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    if (edit.setKey === ALL_SETS) {
      const row = this._row(edit.exerciseKey);
      // Unchanged is not an edit: a rep range survives a look at its row.
      if (!row || cellValue(row.sets[0] ?? null, edit.field) === value) return;
      this._updateRow(edit.exerciseKey, (current) => withAll(current, edit.field, value));
      return;
    }
    const set = this._findSet(edit.exerciseKey, edit.setKey);
    // Unchanged is not an edit: a rep range survives a look at its cell.
    if (!set || cellValue(set, edit.field) === value) return;
    this._updateSet(edit.exerciseKey, edit.setKey, (current) =>
      withValue(current, edit.field, value),
    );
  }

  /** The row the pad is typing into, every set at once, or null. */
  private _editingAll(): { row: DraftExercise; field: SetField } | null {
    const edit = this.editing();
    const row = edit?.setKey === ALL_SETS ? this._row(edit.exerciseKey) : null;
    return edit && row ? { row, field: edit.field } : null;
  }

  private _editingCell(): { row: DraftExercise; index: number; field: SetField } | null {
    const edit = this.editing();
    const row = this._row(edit?.exerciseKey ?? null);
    const index = row?.sets.findIndex((set) => set.key === edit?.setKey) ?? -1;
    return edit && row && index >= 0 ? { row, index, field: edit.field } : null;
  }

  // ─── Saving and starting ──────────────────────────────────────

  /**
   * Saves and stays: a new routine goes back to the list it now appears
   * on, an edit lands back on the read view, showing what was saved.
   */
  save(): void {
    if (!this._ready() || this.saving()) return;
    const creating = this.isNew();
    this._persist(() => {
      void this._feedbackService.success(
        this._translateService.instant('workouts.routineBuilder.toast.saved'),
      );
      if (creating) {
        this._exiting = true;
        void this._router.navigate([this.stackBase()]);
        return;
      }
      this.editMode.set(false);
      this.load();
    });
  }

  /**
   * The footer's Start: saves what changed first, since a workout starts
   * from the saved routine, then opens the workout in place of this page.
   */
  saveAndStart(): void {
    if (!this._ready() || this.saving() || this.starting()) return;
    if (!this.isNew() && !this.dirty()) {
      this.start();
      return;
    }
    this._persist((saved) => {
      // Saved now: if the start is put off (another workout is open), the
      // page reads the saved routine and says it was saved, since nothing
      // else on screen does.
      this._id.set(saved.id);
      this.editMode.set(false);
      this.load();
      this.start(
        () =>
          void this._feedbackService.success(
            this._translateService.instant('workouts.routineBuilder.toast.saved'),
          ),
      );
    });
  }

  /** A name and something in it, else the field says what is missing. */
  private _ready(): boolean {
    this._keepTyped();
    this.editing.set(null);
    if (!this.canSave()) return false;
    if (!this.name().trim()) {
      this.nameError.set(true);
      void this._nameInput()?.setFocus();
      return false;
    }
    return true;
  }

  private _persist(done: (saved: Routine) => void): void {
    this.saving.set(true);
    const notes = this.notes().trim();
    const payload = {
      name: this.name().trim(),
      // A new routine leaves out an empty note; an edit sends it, so
      // clearing the note clears it.
      ...(notes || !this.isNew() ? { notes } : {}),
      defaultRestSeconds: this.defaultRest(),
      exercises: payloadExercises(this.exercises()),
    };
    const request = this.isNew()
      ? this._routineService.create(payload)
      : this._routineService.update(this._id()!, payload);

    request.pipe(take(1)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this._savedSignature.set(this._signature());
        done(saved);
      },
      error: (err) => {
        this.saving.set(false);
        void this._feedbackService.error(
          err,
          this._translateService.instant('workouts.routineBuilder.toast.saveFailed'),
        );
      },
    });
  }

  /**
   * After the red confirm, then back to the list it has left. The Workouts
   * list deletes from its More sheet too, through the same service.
   */
  confirmDelete(): void {
    const id = this._id();
    if (!id || id === NEW || this.deleting()) return;
    this.deleting.set(true);
    this._routineActionsService
      .remove(id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe(async () => {
        await this._deleteSheet()?.close();
        this._exiting = true;
        void this._router.navigate([this.stackBase()], { replaceUrl: true });
      });
  }

  /**
   * Starting a starter deep-copies it into your library, server-side.
   * `onBlocked` runs when another workout is open and the start is put off.
   */
  start(onBlocked?: () => void): void {
    const id = this._id();
    if (!id || id === NEW || this.starting()) return;

    this.starting.set(true);
    this._activeWorkoutService.startOrResume(() => this._start(id), {
      onBlocked: () => {
        this.starting.set(false);
        onBlocked?.();
      },
    });
  }

  private _start(id: string): void {
    this._routineService
      .start(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          this.starting.set(false);
          this._exiting = true;
          void this._router.navigate(['/tabs/workouts/log', log.id], { replaceUrl: true });
        },
        error: (err) => {
          this.starting.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.routineBuilder.toast.startFailed'),
          );
        },
      });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /** A new routine: nothing in it, nothing to lose yet. */
  private _startNew(): void {
    this._id.set(NEW);
    this.routine.set(null);
    this.name.set('');
    this.notes.set('');
    this.defaultRest.set(null);
    this.exercises.set([]);
    this.editMode.set(false);
    this.reordering.set(false);
    this.nameError.set(false);
    this.pickerOpen.set(false);
    this.editing.set(null);
    this._savedSignature.set(draftSignature('', null, []));
  }

  /**
   * Thrown away with changes unsaved, by a tab tap rather than by its own
   * doing: the draft waits for the next visit (`RoutineDraftStore`).
   */
  private _parkDraft(): void {
    if (!this._keepDraft || !this.guarded() || !this._path) return;
    const draft: ParkedDraft = {
      name: this.name(),
      notes: this.notes(),
      defaultRest: this.defaultRest(),
      exercises: this.exercises(),
      editMode: this.editMode(),
      keySeq: this._keySeq,
    };
    // Kept under what the page holds, not where it was opened: a "Save and
    // start" whose start was put off leaves a saved routine at `new`, and
    // its edits came back as a new routine there, so Save made a copy.
    const key = this.isNew() ? this._path : `${this.stackBase()}/routine/${this._id()}`;
    this._routineDraftStore.park(key, draft);
  }

  /** A draft parked at this address goes back on the page, still unsaved. */
  private _restoreParked(): void {
    const draft = this._routineDraftStore.take(this._path);
    if (!draft) return;
    this._keySeq = Math.max(this._keySeq, draft.keySeq);
    this.editMode.set(draft.editMode);
    this.name.set(draft.name);
    this.notes.set(draft.notes);
    this.defaultRest.set(draft.defaultRest);
    this.exercises.set(draft.exercises);
    if (this.editMode()) this._loadPrevious();
  }

  /** The builder's rows, rebuilt from what is saved. */
  private _resetDraft(routine: Routine): void {
    const fallback = this._translateService.instant('workouts.common.exercise');
    const rows = (routine.exercises ?? []).map((e) => draftFromRoutine(e, fallback, this._nextKey));
    this.name.set(routine.name);
    this.notes.set(routine.notes ?? '');
    this.defaultRest.set(routine.defaultRestSeconds);
    this.exercises.set(rows);
    this._savedSignature.set(this._signature());
    if (this.editMode()) this._loadPrevious();
  }

  /**
   * "Last time" for every movement in the draft, one call each, once: the
   * table shows a dash until they land, which is also the honest answer for
   * a movement never done before.
   */
  private _loadPrevious(): void {
    const known = this._previous();
    const ids = [...new Set(this.exercises().map((row) => row.exerciseId))].filter(
      (id) => !(id in known),
    );
    for (const id of ids) {
      this._workoutLogService
        .lastForExercise(id)
        .pipe(take(1), catchError(() => of([] as LoggedSet[])))
        .subscribe((sets) => this._previous.update((map) => ({ ...map, [id]: sets })));
    }
  }

  private _setSwipeBack(on: boolean): void {
    if (this._ionRouterOutlet) {
      this._ionRouterOutlet.swipeGesture = on ? swipeBackDefault(this._config) : false;
    }
  }

  private _row(key: string | null): DraftExercise | null {
    return key ? (this.exercises().find((row) => row.key === key) ?? null) : null;
  }

  private _findSet(exerciseKey: string, setKey: string): DraftSet | null {
    return this._row(exerciseKey)?.sets.find((set) => set.key === setKey) ?? null;
  }

  private _updateRow(key: string, change: (row: DraftExercise) => DraftExercise): void {
    this.exercises.update((rows) => rows.map((row) => (row.key === key ? change(row) : row)));
  }

  private _updateSet(
    exerciseKey: string,
    setKey: string,
    change: (set: DraftSet) => DraftSet,
  ): void {
    this._updateRow(exerciseKey, (row) => ({
      ...row,
      sets: row.sets.map((set) => (set.key === setKey ? change(set) : set)),
    }));
  }
}
