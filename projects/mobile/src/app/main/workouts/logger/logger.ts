import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Config,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonProgressBar,
  IonRouterOutlet,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  Platform,
  ViewDidEnter,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Subscription, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  AuthStore,
  Exercise,
  ExerciseKind,
  ExerciseService,
  RestSources,
  ExerciseSetType,
  LogSetPayload,
  LoggedExercise,
  LoggedSet,
  Routine,
  RoutineService,
  SetField,
  SupersetChange,
  WorkoutLog,
  WorkoutLogService,
  appLocale,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { RestAlertService } from '../../../_shared/services/rest-alert.service';
import { RestLiveAction, RestLiveActionTypes } from '../../../_shared/native/rest-live';
import { prefersReducedMotion } from '../../../_shared/utils/motion';
import { PAGE_BACK_PRIORITY, swipeBackDefault } from '../../../_shared/utils/swipe-back';
import { ActiveSessionStore, LiveStep, LiveValues } from '../_services/active-session.store';
import { ActiveWorkoutService } from '../_services/active-workout.service';
import { liveValues } from '../_services/lock-screen.config';
import { LockScreenService } from '../_services/lock-screen.service';
import { RestCueService } from '../_services/rest-cue.service';
import { ScreenAwakeService } from '../_services/screen-awake.service';
import { StillTrainingService } from '../_services/still-training.service';
import { WorkoutSettingsStore } from '../_services/workout-settings.store';
import { ExerciseNoteSheet } from '../_sheets/exercise-note-sheet/exercise-note-sheet';
import { ExercisePickerSheet } from '../../exercises/_sheets/exercise-picker-sheet/exercise-picker-sheet';
import { ExerciseTile, exerciseTile } from '../../exercises/exercises.config';
import { EffortPrompt } from '../_components/effort-prompt/effort-prompt';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { ExerciseHead } from '../_components/exercise-head/exercise-head';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import {
  PAD_REVEAL_MS,
  ScreenSpan,
  revealAbovePad,
  visibleSpan,
} from '../_components/numeric-keypad/pad-reveal';
import { RestTimerBar } from '../_components/rest-timer-bar/rest-timer-bar';
import { SetRow } from '../_components/set-row/set-row';
import { SetTableHead } from '../_components/set-table-head/set-table-head';
import { ExerciseActionsSheet } from '../_sheets/exercise-actions-sheet/exercise-actions-sheet';
import { LeaveWorkoutSheet } from '../_sheets/leave-workout-sheet/leave-workout-sheet';
import { RestChange, RestScopes, RestSheet } from '../_sheets/rest-sheet/rest-sheet';
import {
  LoggerOptionId,
  LoggerOptionIds,
  LoggerOptionsSheet,
  LoggerPrefs,
} from '../_sheets/logger-options-sheet/logger-options-sheet';
import { SetMenuSheet } from '../_sheets/set-menu-sheet/set-menu-sheet';
import {
  ExerciseActionId,
  ExerciseActionIds,
  finishOptions,
  FinishChoice,
  FinishChoices,
  KeypadField,
  KeypadFields,
  LeaveChoice,
  LeaveChoices,
  WORKOUT_ICONS,
  formatMeasure,
  isExerciseDone,
  loggerRedirect,
  workoutClock,
  workoutVolume,
} from '../workouts.config';
import {
  EFFORT_PROMPT_MS,
  KEYPAD_FIELD,
  MeasuredRest,
  PAYLOAD_KEY,
  columnLabelKey,
  RestChoices,
  SetBadge,
  SetRef,
  SetRowMode,
  SetRowModes,
  afterTick,
  asksEffort,
  cellValue,
  copiedValues,
  effortTarget,
  estimatedRest,
  exerciseBlocks,
  inSuperset,
  isLastLeft,
  linkedToNext,
  memberTag,
  nextSetLine,
  roundCount,
  sharedColumns,
  SetColumns,
  fieldsFor,
  focusOf,
  foldedSummary,
  lastLine,
  withTicked,
  planLine,
  planNoteOf,
  prefillValue,
  setBadge,
  setLine,
  shownValue,
  reshapedCards,
  tappedRest,
  toggledLinks,
  withLinks,
  withoutSuperset,
} from './logger-flow';
import { LoggerStore } from './logger.store';
import {
  ROUTINE_UPDATE_ACTIONS,
  RoutineUpdateChoice,
  RoutineUpdateChoices,
  changeSummary,
  isOwnRoutine,
  routineChanges,
  routineFromWorkout,
  updatableRoutineId,
} from './routine-update';

/** Which cell the keypad is bound to. */
interface EditTarget {
  exerciseId: string;
  setId: string;
  field: SetField;
}

/** One set as the list draws it. */
interface SetView {
  set: LoggedSet;
  mode: SetRowMode;
  badge: SetBadge;
  prefill: Partial<Record<SetField, number | null>>;
  last: string;
  /** The same set last time, "60 × 8", for the Previous column; empty when none. */
  previous: string;
  /** That set itself, so Previous can copy its numbers in. */
  previousSet: LoggedSet | null;
  /** The set the screen points at: the next one to do. */
  focus: boolean;
  /** The field open in the pad, when it is this set's. */
  editing: SetField | null;
  effortTarget: number | null;
}

/** One exercise as the list draws it. */
interface ExerciseView {
  exercise: LoggedExercise;
  /** Every set ticked. */
  done: boolean;
  /** Drawn as one line: finished, or folded by its ⋯'s Collapse (`Logger._folds`). */
  folded: boolean;
  /** The card's tile, which the folded line of an exercise still being worked leads with. */
  tile: ExerciseTile | null;
  summary: string;
  fields: SetField[];
  plan: string;
  planNote: string;
  note: string;
  rows: SetView[];
}

/**
 * One round of a superset as the card draws it: a set row per member, as
 * an exercise's card draws its sets, done, on now or ahead.
 */
interface RoundView {
  index: number;
  done: boolean;
  rows: { tag: string; view: ExerciseView; row: SetView }[];
}

/** An exercise on its own, or a superset: what the list draws, in order. */
type BlockView =
  | { kind: 'single'; key: string; view: ExerciseView }
  | {
      kind: 'superset';
      key: string;
      members: { tag: string; view: ExerciseView }[];
      rounds: RoundView[];
      /** The heading over the rounds, when the members record the same fields; null for none. */
      columns: SetColumns | null;
      /** The round on now, from 1; the last one once all are done. */
      current: number;
      total: number;
      /** Every member still in play is done. */
      done: boolean;
      folded: boolean;
      names: string;
      /** The folded line's "3 rounds", or "Superset · round 2 of 3" mid-way. */
      summary: string;
    };

type SupersetBlock = Extract<BlockView, { kind: 'superset' }>;

/** The link chip after a card: between its last exercise and the next card's first. */
interface BlockLink {
  /** That last exercise's place in the workout. */
  index: number;
  /** Already linked: the chip undoes it. Only while supersets show as cards of their own. */
  linked: boolean;
  /** The two exercises it joins, for its accessible name. */
  a: string;
  b: string;
}

/** A tick from the lock screen's ✓: when it was tapped, and what its button showed. */
interface LockScreenTick {
  at: number;
  values: LiveValues;
}

/** How many sets the lock screen knows ahead: the next one and two after it. */
const LIVE_STEPS = 3;

/** Where the focus set sits, as a share of the visible list's height. */
const FOCUS_AT = 0.32;
/** The list's scroll to the set you are on, as the workout opens. */
const FOCUS_SCROLL_MS = 320;

/**
 * The active workout — the screen a trainee looks at for an hour.
 *
 * One long scrolling list of exercises rather than a pager: the design's
 * argument is that scanning beats swiping when you are re-planning mid
 * session, and add/swap/reorder all fight a pager.
 *
 * The bottom slot is shared and mutually exclusive — the keypad while a cell
 * is being edited, the rest timer while resting, and nothing otherwise. Both
 * dock rather than overlay so the set grid stays readable.
 *
 * Leaving is not ending. The chevron asks whether the clock keeps running or
 * pauses, then takes you back to the Workouts tab with the session still
 * open, where the resume banner waits; Finish and Discard are the two ways a
 * session actually ends.
 */
@Component({
  selector: 'mh-logger',
  imports: [
    ConfirmSheet,
    EffortPrompt,
    EmptyState,
    ExerciseActionsSheet,
    ExerciseCard,
    ExerciseHead,
    ExerciseNoteSheet,
    ExercisePickerSheet,
    HexAvatar,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    ActionSheet,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonProgressBar,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    LeaveWorkoutSheet,
    LoggerOptionsSheet,
    NgTemplateOutlet,
    NumericKeypad,
    RestSheet,
    RestTimerBar,
    SetMenuSheet,
    SetRow,
    SetTableHead,
    TranslatePipe,
  ],
  providers: [LoggerStore],
  templateUrl: './logger.html',
  styleUrl: './logger.scss',
})
export class Logger implements ViewWillEnter, ViewDidEnter, ViewWillLeave {
  readonly store = inject(LoggerStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _restAlertService = inject(RestAlertService);
  private readonly _translateService = inject(TranslateService);
  private readonly _navController = inject(NavController);
  /** The stack's swipe back, held off while the logger is on screen: see `ionViewDidEnter`. */
  private readonly _ionRouterOutlet = inject(IonRouterOutlet, { optional: true });
  private readonly _config = inject(Config);
  /** Android's back, taken while the logger is on screen: see `ionViewDidEnter`. */
  private readonly _platform = inject(Platform);
  private _backSubscription: Subscription | null = null;
  private readonly _activeWorkoutService = inject(ActiveWorkoutService);
  private readonly _restCueService = inject(RestCueService);
  private readonly _activeSession = inject(ActiveSessionStore);
  private readonly _stillTraining = inject(StillTrainingService);
  private readonly _screenAwake = inject(ScreenAwakeService);
  private readonly _lockScreen = inject(LockScreenService);
  /** Lets go of the lock screen's buttons; set once the kept rest is picked up. */
  private _detachLockScreen: (() => void) | null = null;
  /** True while this page is the one in front. */
  private readonly _onScreen = signal(false);
  private readonly _settingsStore = inject(WorkoutSettingsStore);
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _routineService = inject(RoutineService);
  private readonly _authStore = inject(AuthStore);

  /** The person's logger settings: their default rest, sound, vibration, effort. */
  private readonly _settings = this._settingsStore.settings;
  /** The ⋯ switches, for this workout only, over the person's settings. */
  private readonly _workoutPrefs = signal<Partial<LoggerPrefs>>({});
  readonly prefs = computed<LoggerPrefs>(() => {
    const { sound, vibration, askEffort } = this._settings();
    return { sound, vibration, askEffort, ...this._workoutPrefs() };
  });
  readonly optionsOpen = signal(false);
  readonly restForAllSeconds = computed(
    () => this._restForAll() ?? this._settings().defaultRestSeconds,
  );

  /** Supersets go round by round unless the person turned that off. */
  private readonly _rounds = computed(() => this._settings().supersetJump);

  /** The exercise whose personal note is being written. */
  readonly noteFor = signal<LoggedExercise | null>(null);
  readonly noteOpen = signal(false);
  readonly noteSaving = signal(false);

  /** Asked once, at the first workout, before the system's own question. */
  readonly notifyAskOpen = signal(false);

  /** A gap too long to be rest, asked about once: pause the workout for it? */
  readonly awayOpen = signal(false);
  readonly awayMinutes = signal(0);
  private _awaySeconds = 0;
  private readonly _destroyRef = inject(DestroyRef);

  readonly skeletonCards = [1, 2];

  /** The cell bound to the keypad, or null when nothing is being edited. */
  readonly editing = signal<EditTarget | null>(null);
  readonly draft = signal('');
  /** What the keypad has typed so far, echoed into the open cell; null until it is touched. */
  readonly typed = signal<string | null>(null);

  /** The next set to do: the one the list points at, and opens on. */
  readonly focus = computed<SetRef | null>(() =>
    focusOf(this.store.exercises(), this._rounds(), this._activeSession.passed()),
  );

  /** The set whose "How hard?" row is showing, for a few seconds after its tick. */
  readonly effortFor = signal<string | null>(null);
  private _effortTimer: ReturnType<typeof setTimeout> | null = null;

  /** The set whose badge menu is open. */
  readonly menuOpen = signal(false);
  readonly menuSet = signal<{ exerciseId: string; set: LoggedSet; badge: SetBadge } | null>(null);
  /**
   * The superset round that set is in, when it is in one: its menu then
   * offers to remove the whole round, which has no menu of its own.
   */
  readonly menuRound = computed<RoundView | null>(() => {
    const setId = this.menuSet()?.set.id;
    if (!setId) return null;
    for (const block of this.blocks()) {
      if (block.kind !== 'superset') continue;
      const round = block.rounds.find((r) => r.rows.some((item) => item.row.set.id === setId));
      if (round) return round;
    }
    return null;
  });
  /** That round as people count it, from 1, for the menu's row. */
  readonly menuRoundNumber = computed(() => {
    const round = this.menuRound();
    return round ? round.index + 1 : null;
  });

  /** The list has been brought to the set you are on, which it does once. */
  private _shownFocus = false;
  /** The cell the pad was last kept in view for; '' while the pad is closed. */
  private _revealedKey = '';
  private readonly _content = viewChild(IonContent);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Ticks once a second for as long as this page exists — the session clock
   * is the one number here that should visibly move. Not tied to Ionic's
   * enter/leave hooks: a missed re-enter would leave the clock frozen on a
   * workout that is still running. One page at a time, one signal write a
   * second; the time itself always comes from `startedAt`, never a count.
   */
  private readonly _now = signal(Date.now());
  private _ticker: ReturnType<typeof setInterval> | null = null;

  /**
   * Exercises folded or opened by hand, by their card's key (an exercise's
   * own id, a superset's first member's), over the default: a finished one
   * folds to its check row, one still being worked is open. Every exercise
   * folds, finished or not (user decision, 2026-11-18). An entry is kept
   * only while it differs from the default, so one folded by hand stays
   * folded once finished, and one opened again by hand before it was
   * finished still folds when its last set is ticked.
   */
  private readonly _folds = signal<ReadonlyMap<string, boolean>>(new Map());

  /** Epoch ms when rest ends. Null parks the timer and frees the slot. */
  readonly restEndsAt = signal<number | null>(null);
  /** When the current rest began — the bar's progress measures from it. */
  readonly restStartedAt = signal<number | null>(null);
  /**
   * The rest being measured: which set it follows, when it began, how long
   * it was meant to be. Outlives the bar (Hide puts the bar away, the rest
   * goes on) until the next tick or a Start set records it.
   */
  private readonly _rest = signal<{
    exerciseId: string;
    setId: string;
    startedAt: number;
    planned: number;
  } | null>(null);
  /** The set "Other value" on the lock screen asked for, until the workout has loaded it. */
  private readonly _openSetId = signal<string | null>(null);
  /** Until the rest kept from before is picked up, this page must not overwrite it. */
  private _restAdopted = false;
  /** "This exercise": rests changed during this workout, by exercise. */
  private readonly _restByExercise = signal<Readonly<Record<string, number>>>({});
  /** "Every exercise in this workout": where nothing else sets a rest. */
  private readonly _restForAll = signal<number | null>(null);
  readonly restSheetOpen = signal(false);
  /** The rest the sheet starts from: the one running now. */
  readonly restSheetSeconds = computed(() => {
    const start = this.restStartedAt();
    const end = this.restEndsAt();
    return start !== null && end !== null
      ? Math.round((end - start) / 1000)
      : this.restForAllSeconds();
  });
  readonly restExerciseName = computed(() => {
    const id = this._rest()?.exerciseId;
    return this.store.exercises().find((e) => e.id === id)?.exerciseNameSnapshot ?? '';
  });
  /**
   * What the rest bar says comes next, what to load first: "Set 3 · 62.5 kg
   * × 8 · Bench press", and "Last set" on an exercise's last. The set to do
   * after this rest is the focus, which a tick has already moved on; empty
   * once everything is ticked. The line is cut from the end on a narrow bar.
   */
  readonly nextLine = computed(() => {
    const focus = this.focus();
    if (!focus) {
      return '';
    }
    const view = this.views().find((v) => v.exercise.id === focus.exerciseId);
    if (!view) {
      return '';
    }
    const row = view.rows.find((r) => r.set.id === focus.setId);
    if (!row) {
      return '';
    }
    const name = view.exercise.exerciseNameSnapshot;
    const target = setLine(view.fields, (field) => shownValue(row, field), true);
    const lastSet = this._lastSetWords(view.exercise.sets ?? []);
    return nextSetLine(row.badge.short ?? row.badge.name, target, name, lastSet);
  });

  /**
   * The next sets in pieces, for the lock screen: it lays them out on its
   * own and cuts the exercise's name before the weight. In a superset, the
   * whole round in order ("A1 Incline press 22 × 10 → A2 Push-ups × 15").
   * The first is the next set; the ones after it are worked out as if the
   * sets before them were ticked, so the lock screen's ✓ and Skip set can
   * move on with the app asleep.
   */
  readonly liveSteps = computed<LiveStep[]>(() => {
    const rounds = this._rounds();
    const passed = this._activeSession.passed();
    let exercises: readonly LoggedExercise[] = this.store.exercises();
    const steps: LiveStep[] = [];
    let ref = focusOf(exercises, rounds, passed);
    while (ref && steps.length < LIVE_STEPS) {
      const step = this._liveStep(ref, exercises, rounds, passed);
      if (!step) {
        break;
      }
      steps.push(step);
      exercises = withTicked(exercises, ref.setId, step.values);
      ref = focusOf(exercises, rounds, passed);
    }
    return steps;
  });

  readonly pickerOpen = signal(false);
  /**
   * Bodyweight exercises the user has chosen to load. Per exercise and
   * opt-in, so weighted pull-ups get a weight column without cluttering
   * push-ups with one.
   */
  private readonly _loaded = signal<ReadonlySet<string>>(new Set());
  /**
   * The exercise being swapped out, or null when the picker is adding. One
   * sheet serves both: swapping is adding with something taken away.
   */
  readonly swapTarget = signal<LoggedExercise | null>(null);

  /** The exercise whose verb sheet is open. */
  readonly actionsFor = signal<LoggedExercise | null>(null);
  readonly actionsOpen = signal(false);
  /** The ⋯ sheet's exercise can fold to one line: see `_foldTarget`. */
  readonly actionsCanCollapse = computed(() => {
    const exercise = this.actionsFor();
    return !!exercise && this._foldTarget(exercise) !== null;
  });
  /** The ⋯ sheet's exercise is in a superset, so it can be taken out of it. */
  readonly actionsCanUnlink = computed(() => {
    const exercise = this.actionsFor();
    const exercises = this.store.exercises();
    return !!exercise && inSuperset(exercises, exercises.findIndex((e) => e.id === exercise.id));
  });

  /** Confirms that would otherwise lose logged work without asking. */
  readonly removeConfirmOpen = signal(false);
  readonly discardConfirmOpen = signal(false);
  /** Finish while sets are unticked, or none are: save as it stands, or discard. */
  readonly finishSheetOpen = signal(false);
  /** Finish early, or Discard alone when nothing is ticked: nothing to save. */
  readonly finishActions = computed(() => finishOptions(this.store.progress().done));
  readonly discarding = signal(false);
  readonly finishing = signal(false);

  /**
   * The routine this workout was started from, when it is yours to change:
   * read with the workout, so Finish can say at once what changed in it.
   */
  private readonly _sourceRoutine = signal<Routine | null>(null);
  /** What the workout changed in its routine's shape; null when nothing did. */
  readonly routineChanges = computed(() => {
    const routine = this._sourceRoutine();
    return routine ? routineChanges(routine, this.store.exercises()) : null;
  });
  /** "Update Leg day?", asked at Finish when the routine's shape changed. */
  readonly updateAskOpen = signal(false);
  readonly updateActions = ROUTINE_UPDATE_ACTIONS;
  readonly updateTitle = computed(() =>
    this._translateService.instant('workouts.updateRoutine.title', {
      name: this._sourceRoutine()?.name ?? '',
    }),
  );
  readonly updateNote = computed(() => {
    const changes = this.routineChanges();
    return changes ? changeSummary(changes) : '';
  });
  /** Asked on the way out: keep the clock running, or pause it. */
  readonly leaveOpen = signal(false);

  /**
   * Finish and discard both navigate once confirmed, so those two sheets are
   * dismissed through their own `close()` rather than by flipping `open` —
   * routing away in the same turn would otherwise leave the sheet presented
   * over the page it just opened. Named refs: the logger owns several confirm
   * sheets, so a bare `viewChild(ConfirmSheet)` would pick the wrong one.
   * Finish's own sheet is an action sheet, which reports its choice only
   * once it has gone, so it needs no ref.
   */
  private readonly _discardSheet = viewChild<ConfirmSheet>('discardSheet');
  /** Read when focus jumps to another cell, so what was typed is kept. */
  private readonly _keypad = viewChild(NumericKeypad);

  /** Per-exercise "last time" sets, keyed by exercise id. */
  private readonly _previous = signal<Record<string, LoggedSet[]>>({});

  /** Every exercise and set as the list draws them, in direction C's three looks. */
  readonly views = computed<ExerciseView[]>(() => {
    const focus = this.focus();
    const editing = this.editing();
    const previous = this._previous();
    const folds = this._folds();
    const loaded = this._loaded();

    const exercises = this.store.exercises();
    const blocks = this._rounds() ? exerciseBlocks(exercises) : [];
    return exercises.map((exercise) => {
      const block = blocks.find((b) => b.exercises.some((e) => e.id === exercise.id));
      const tag = block ? memberTag(block, exercise.id) : null;
      const member = tag ? { tag, name: exercise.exerciseNameSnapshot } : null;
      const fields = fieldsFor(exercise.exercise?.kind, loaded.has(exercise.id));
      const sets = exercise.sets ?? [];
      const last = exercise.exerciseId ? (previous[exercise.exerciseId] ?? []) : [];
      const editingHere = editing?.exerciseId === exercise.id;

      const rows = sets.map((set, index): SetView => {
        const before = index > 0 ? sets[index - 1] : null;
        const prev = last[index] ?? null;
        const isEditing = editing?.setId === set.id;
        const isFocus = focus?.setId === set.id;
        return {
          set,
          mode:
            isEditing || (isFocus && !set.isCompleted)
              ? SetRowModes.Focus
              : set.isCompleted
                ? SetRowModes.Done
                : SetRowModes.Future,
          badge: setBadge(sets, index, member),
          prefill: Object.fromEntries(
            fields.map((field) => [field, prefillValue(set, field, prev, before)]),
          ),
          last: lastLine(fields, prev),
          previous: prev ? setLine(fields, (field) => cellValue(prev, field), false) : '',
          previousSet: prev,
          focus: isFocus,
          editing: isEditing ? (editing?.field ?? null) : null,
          effortTarget: effortTarget(set),
        };
      });

      const done = isExerciseDone(exercise);
      return {
        exercise,
        done,
        // A skipped card has no sets to fold away, and nothing would open it
        // again (`_foldTarget`), whatever a fold left over from a superset says.
        folded: !exercise.isSkipped && (folds.get(exercise.id) ?? done) && !editingHere,
        tile: exerciseTile(
          exercise.exercise?.kind ?? null,
          exercise.exercise?.thumbnailUrl || exercise.exerciseThumbnailUrlSnapshot || null,
        ),
        summary: foldedSummary(exercise, exercise.exercise?.kind ?? null),
        fields,
        plan: planLine(exercise),
        planNote: planNoteOf(exercise),
        note: exercise.personalNote?.trim() ?? '',
        rows,
      };
    });
  });

  /**
   * The list in blocks: an exercise on its own, or a superset laid out in
   * rounds. Every round shows its sets, as an exercise's card shows all of
   * its own, under one heading when the members record the same fields.
   */
  readonly blocks = computed<BlockView[]>(() => {
    const views = this.views();
    const exercises = this.store.exercises();
    const folds = this._folds();
    const editing = this.editing();
    const byId = new Map(views.map((view) => [view.exercise.id, view]));
    if (!this._rounds()) {
      return views.map((view) => ({ kind: 'single' as const, key: view.exercise.id, view }));
    }

    return exerciseBlocks(exercises).map((block): BlockView => {
      const first = byId.get(block.exercises[0].id);
      if (block.letter === null && first) {
        return { kind: 'single', key: first.exercise.id, view: first };
      }
      const members = block.exercises.flatMap((e) => {
        const view = byId.get(e.id);
        return view ? [{ tag: memberTag(block, e.id) ?? '', view }] : [];
      });
      const live = members.filter((m) => !m.view.exercise.isSkipped);
      const total = roundCount(block);
      const rounds: RoundView[] = [];
      for (let index = 0; index < total; index++) {
        const rows = live
          .map((m) => ({ tag: m.tag, view: m.view, row: m.view.rows[index] }))
          .filter((r) => !!r.row);
        const done = rows.length > 0 && rows.every((r) => r.row.set.isCompleted);
        if (rows.length) rounds.push({ index, done, rows });
      }
      const firstOpen = rounds.findIndex((r) => !r.done);
      const key = block.exercises[0].id;
      const allDone = live.length > 0 && live.every((m) => isExerciseDone(m.view.exercise));
      const editingHere = members.some((m) => m.view.exercise.id === editing?.exerciseId);
      const round = firstOpen < 0 ? Math.max(0, total - 1) : rounds[firstOpen].index;
      return {
        kind: 'superset',
        key,
        members,
        rounds,
        columns: sharedColumns(
          live.map((m) => ({
            fields: m.view.fields,
            unilateral: this.isUnilateral(m.view.exercise),
          })),
        ),
        current: round + 1,
        total,
        done: allDone,
        // Every member skipped leaves no sets to fold, as for a skipped exercise.
        folded: live.length > 0 && (folds.get(key) ?? allDone) && !editingHere,
        names: members.map((m) => m.view.exercise.exerciseNameSnapshot).join(' + '),
        summary: allDone
          ? this._translateService.instant('workouts.superset.rounds', { count: total })
          : this._translateService.instant('workouts.superset.kicker', { round: round + 1, total }),
      };
    });
  });

  /**
   * The link chip after each card but the last, as the routine builder has
   * between its cards: "Link as superset" joins the card's last exercise
   * with the next card's first. In rounds a superset is one card, so a chip
   * there always links; with rounds off every exercise is its own card and
   * the chip between two linked ones undoes the link, as in the builder.
   * Aligned with `blocks`, by position.
   */
  readonly links = computed<(BlockLink | null)[]>(() => {
    const exercises = this.store.exercises();
    const blocks = this.blocks();
    let end = -1;
    return blocks.map((block, i) => {
      end += block.kind === 'single' ? 1 : block.members.length;
      if (i === blocks.length - 1) return null;
      return {
        index: end,
        linked: linkedToNext(exercises, end),
        a: exercises[end]?.exerciseNameSnapshot ?? '',
        b: exercises[end + 1]?.exerciseNameSnapshot ?? '',
      };
    });
  });

  /**
   * The pad's wide key: on to the next field ("Reps →"), else tick the set
   * ("Log set"), or Done when the set is already ticked.
   */
  readonly keypadAction = computed<{ label: string; icon: string | null; slot: 'start' | 'end' }>(() => {
    const target = this.editing();
    const view = target ? this.views().find((v) => v.exercise.id === target.exerciseId) : null;
    const row = view?.rows.find((r) => r.set.id === target?.setId);
    if (!target || !view || !row) return { label: '', icon: null, slot: 'start' };
    const at = view.fields.indexOf(target.field);
    const next = view.fields[at + 1];
    if (next) {
      return {
        label: this._translateService.instant(`workouts.keypad.next.${next}`),
        icon: 'arrow-forward-outline',
        slot: 'end',
      };
    }
    if (row.set.isCompleted) return { label: '', icon: null, slot: 'start' };
    return {
      label: this._translateService.instant('workouts.keypad.logSet'),
      icon: 'checkmark-outline',
      slot: 'start',
    };
  });

  /** Identifies the open cell for the keypad, so it re-seeds on every move. */
  readonly editingKey = computed(() => {
    const target = this.editing();
    return target ? `${target.setId}:${target.field}` : '';
  });

  readonly keypadField = computed<KeypadField>(() => {
    const target = this.editing();
    return target ? KEYPAD_FIELD[target.field] : KeypadFields.Reps;
  });

  /** "Back squat · Set 3 · kg" — which cell the pad is filling, in the grid's words. */
  readonly keypadLabel = computed(() => {
    const target = this.editing();
    if (!target) return '';
    const exercise = this.store.exercises().find((e) => e.id === target.exerciseId);
    const sets = exercise?.sets ?? [];
    const index = sets.findIndex((s) => s.id === target.setId);
    return [
      exercise?.exerciseNameSnapshot,
      exercise && index >= 0 ? this._labelOf(exercise, index) : '',
      exercise ? this._columnLabel(exercise, target.field) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  readonly elapsed = computed(() => {
    const log = this.store.log();
    return log ? workoutClock(log, this._now()) : '';
  });

  /**
   * "1,250 kg": the weight lifted in ticked sets so far (warm-ups count for
   * nothing, as on the summary). Empty until something loaded is ticked, so
   * a bodyweight session never shows "0 kg".
   */
  readonly volumeLabel = computed(() => {
    const log = this.store.log();
    const volume = log ? Math.round(workoutVolume(log)) : 0;
    return volume > 0
      ? this._translateService.instant('workouts.units.kg', {
          value: new Intl.NumberFormat(appLocale()).format(volume),
        })
      : '';
  });

  readonly progressRatio = computed(() => {
    const { done, total } = this.store.progress();
    return total > 0 ? done / total : 0;
  });

  /**
   * "1/3 exercises" on the finish-early line: exercises with every set
   * ticked, skipped ones left out.
   */
  readonly exerciseProgress = computed(() => {
    const live = this.store.exercises().filter((exercise) => !exercise.isSkipped);
    return { done: live.filter(isExerciseDone).length, total: live.length };
  });

  readonly pickerTitle = computed(() =>
    this._translateService.instant(
      this.swapTarget() ? 'workouts.exerciseActions.swap' : 'workouts.common.addExercises',
    ),
  );

  readonly pickerContext = computed(() => {
    const target = this.swapTarget();
    return target
      ? this._translateService.instant('workouts.logger.picker.replacing', {
          name: target.exerciseNameSnapshot,
        })
      : (this.store.log()?.name ?? '');
  });

  /** Already in this workout, so the sheet does not offer them again. */
  readonly addedIds = computed(() =>
    this.store
      .exercises()
      .map((e) => e.exerciseId)
      .filter((id): id is string => !!id),
  );

  /** What removing this exercise would throw away. */
  readonly removeBody = computed(() => {
    const exercise = this.actionsFor();
    if (!exercise) return '';
    const done = (exercise.sets ?? []).filter((s) => s.isCompleted).length;
    const name = exercise.exerciseNameSnapshot;
    return done > 0
      ? this._translateService.instant('workouts.logger.remove.messageWithSets', { name, count: done })
      : this._translateService.instant('workouts.logger.remove.message', { name });
  });

  /** "Nothing logged yet" with no set ticked, else "Finish early?". */
  readonly finishTitle = computed(() =>
    this._translateService.instant(
      this.store.progress().done === 0
        ? 'workouts.logger.finishSheet.nothing.title'
        : 'workouts.logger.finishSheet.early.title',
    ),
  );

  readonly finishNote = computed(() => {
    const { done, total } = this.store.progress();
    return done === 0
      ? this._translateService.instant('workouts.logger.finishSheet.nothing.message')
      : this._translateService.instant('workouts.logger.finishSheet.early.message', {
          count: total - done,
        });
  });

  readonly showKeypad = computed(() => this.editing() !== null);
  readonly showRest = computed(() => !this.showKeypad() && this.restEndsAt() !== null);

  constructor() {
    addIcons(WORKOUT_ICONS);

    // The screen stays on while the workout is in front, if the person wants.
    effect(() => {
      const keep = this._onScreen() && !!this.store.log() && this._settings().keepScreenOn;
      untracked(() => void (keep ? this._screenAwake.hold() : this._screenAwake.release()));
    });

    // The workout and its rest, for the mini-bar and for after a restart:
    // the clock and the rest live on as timestamps when this page goes.
    // The rest-over alert follows the rest kept there (`LockScreenService`).
    effect(() => {
      const log = this.store.log();
      if (log) untracked(() => this._activeSession.track(log));
    });
    effect(() => {
      const log = this.store.log();
      const rest = this._rest();
      const endsAt = this.restEndsAt();
      const next = this.nextLine();
      if (!log || !this._restAdopted) return;
      untracked(() =>
        this._activeSession.setRest(rest ? { logId: log.id, ...rest, endsAt, next } : null),
      );
    });
    // What comes next, for the lock screen between rests too.
    effect(() => {
      const log = this.store.log();
      const next = this.nextLine();
      const steps = this.liveSteps();
      if (!log) {
        return;
      }
      untracked(() => this._activeSession.setNext(log.id, next, steps));
    });

    // Opening the workout brings the set you are on into view, once. After
    // that the list stays where the person put it: a tick never scrolls it
    // (user decision, 2026-11-18), since a list that moved on its own read
    // on a phone as a jump.
    effect(() => {
      if (this._shownFocus || !this.focus()) return;
      this._shownFocus = true;
      this._scrollToFocusSoon();
    });

    // Once the pad is drawn, the set it types into shows above it: in the
    // same frame when the pad opens, so the set never shows under it first,
    // and gliding when the pad, already up, moves on to a set it hides.
    afterRenderEffect(() => {
      const key = this.editingKey();
      const opening = this._revealedKey === '';
      this._revealedKey = key;
      if (key) void this._revealEditing(opening);
    });

    // "Other value" on the lock screen opens the logger on that set, to type it.
    this._route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const setId = params.get('set');
      if (setId) {
        this._openSetId.set(setId);
      }
    });
    effect(() => {
      const setId = this._openSetId();
      if (!setId) {
        return;
      }
      const exercise = this.store.exercises().find((e) => (e.sets ?? []).some((set) => set.id === setId));
      if (!exercise) {
        return;
      }
      const set = this._findSet(exercise.id, setId);
      untracked(() => {
        this._openSetId.set(null);
        void this._router.navigate([], {
          relativeTo: this._route,
          queryParams: { set: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        if (set) {
          this.openSet(exercise, set);
        }
      });
    });

    this._startTicker();
    this._destroyRef.onDestroy(() => {
      this._backSubscription?.unsubscribe();
      this._detachLockScreen?.();
      void this._screenAwake.release();
      this._stopTicker();
      this._clearEffortTimer();
    });
  }

  ionViewWillEnter(): void {
    this._onScreen.set(true);
    // Catch the clock up at once rather than on the next tick.
    this._now.set(Date.now());
    this._settingsStore.load();

    const id = this._route.snapshot.paramMap.get('id');
    if (!id) return;

    // `new` is only a fallback now (an old link): every button starts the
    // workout first (`ActiveWorkoutService.startFreestyle`) and opens this
    // page once, on it. Here it starts one and replaces this page.
    if (id === 'new') {
      this._activeWorkoutService.startFreestyle(
        this._route.snapshot.queryParamMap.get('from'),
        true,
      );
      return;
    }
    this.store.load(
      id,
      () => {
        // Back at the workout is back to work: a paused clock starts again.
        this.store.resumeClock();
        this._loadLastTimes();
        this._loadSourceRoutine();
        this._adoptRest();
        // A Repeat just started: its movements, into this page's store.
        const from = this._activeWorkoutService.takeCarryOver(id);
        if (from) this._carryOver(from);
        void this._maybeAskNotifications();
      },
      (log) => this._toSummaryIfClosed(log),
    );
  }

  /** The first workout: say why notifications help, then let the system ask. */
  private async _maybeAskNotifications(): Promise<void> {
    if (await this._restAlertService.shouldAsk()) this.notifyAskOpen.set(true);
  }

  allowNotifications(): void {
    this.notifyAskOpen.set(false);
    void this._restAlertService.askNow();
  }

  notNowNotifications(): void {
    this.notifyAskOpen.set(false);
    void this._restAlertService.declineForNow();
  }

  /**
   * A rest that kept running while this page was away (minimised, or the app
   * closed) carries on here, measured from when it began.
   */
  private _adoptRest(): void {
    const log = this.store.log();
    const kept = this._activeSession.rest();
    if (log && kept && kept.logId === log.id && !this._rest()) {
      this._rest.set({
        exerciseId: kept.exerciseId,
        setId: kept.setId,
        startedAt: kept.startedAt,
        planned: kept.planned,
      });
      this.restStartedAt.set(kept.startedAt);
      this.restEndsAt.set(kept.endsAt);
    }
    this._restAdopted = true;
    // From now on the lock screen's buttons act on this page's rest.
    this._detachLockScreen ??= this._lockScreen.attach((action) => this._onLockScreen(action));
  }

  /**
   * The lock screen's buttons, as if tapped here at that moment: +15, Skip
   * and Start set on the bar, ✓ on the set, Skip set passing it over,
   * Continue on a paused workout.
   */
  private _onLockScreen(action: RestLiveAction): void {
    if (action.type === RestLiveActionTypes.Extend) {
      if (action.endsAt && this.restEndsAt() !== null) {
        this.restEndsAt.set(action.endsAt);
      }
      return;
    }
    if (action.type === RestLiveActionTypes.Log) {
      this._tickFromLockScreen(action);
      return;
    }
    if (action.type === RestLiveActionTypes.SkipSet) {
      const log = this.store.log();
      if (log && action.setId) {
        this._activeSession.pass(log.id, action.setId);
      }
      return;
    }
    if (action.type === RestLiveActionTypes.Resume) {
      this.store.resumeClock(action.at);
      return;
    }
    this._recordTappedRest(action.at);
  }

  /** ✓ on the lock screen: the set ticked with what its button showed, at that moment. */
  private _tickFromLockScreen(action: RestLiveAction): void {
    if (!action.exerciseId || !action.setId) {
      return;
    }
    const exercise = this.store.exercises().find((e) => e.id === action.exerciseId);
    const set = this._findSet(action.exerciseId, action.setId);
    if (!exercise || !set || set.isCompleted) {
      return;
    }
    this.tick(exercise, set, { at: action.at, values: liveValues(action.values) });
  }

  /**
   * A workout that is no longer running opens on its summary, replacing this
   * page, so back returns to wherever it was opened from (`loggerRedirect`).
   */
  private _toSummaryIfClosed(log: WorkoutLog): boolean {
    const route = loggerRedirect(log);
    if (!route) return false;
    void this._router.navigate(route, { replaceUrl: true });
    return true;
  }

  /**
   * A set swipes right to Copy, and on iOS a drag from the left edge is the
   * back gesture, which outranks the row's: a copy started on the set number
   * popped the page instead, past the leave sheet's question. The way out is
   * the ⌄, which asks it. Turned off here, not on will-enter: an iOS swipe
   * back to this page fires that as it starts, and switching the gesture off
   * mid-drag snapped every such swipe back and left it dead.
   *
   * Android's back is not that gesture: the button, and the system's swipe
   * in from either edge, popped the page with the workout still running.
   * It closes the pad first, then asks as the ⌄ does. An open sheet closes
   * before either, its handler being above this one.
   */
  ionViewDidEnter(): void {
    if (this._ionRouterOutlet) this._ionRouterOutlet.swipeGesture = false;
    this._backSubscription?.unsubscribe();
    this._backSubscription = this._platform.backButton.subscribeWithPriority(
      PAGE_BACK_PRIORITY,
      (processNextHandler) => {
        if (this.editing()) {
          this.closePad();
          return;
        }
        if (this.store.log()) {
          this.leave();
          return;
        }
        processNextHandler();
      },
    );
  }

  ionViewWillLeave(): void {
    this._onScreen.set(false);
    // The page in front owns the back now.
    this._backSubscription?.unsubscribe();
    this._backSubscription = null;
    // The pages after this one swipe back as the app does everywhere else.
    if (this._ionRouterOutlet) this._ionRouterOutlet.swipeGesture = swipeBackDefault(this._config);
    // The rest carries on in the mini-bar; only what was being typed closes.
    this._keepTyped();
    this.editing.set(null);
    this.dismissEffort();
  }

  /** Asks whether the clock keeps running while away, then goes. */
  leave(): void {
    if (!this.store.log()) {
      this._goBack();
      return;
    }
    this._keepTyped();
    this.editing.set(null);
    this.leaveOpen.set(true);
  }

  onLeaveChoice(choice: LeaveChoice): void {
    if (choice === LeaveChoices.KeepRunning) {
      this._goBack();
      return;
    }
    // A paused workout has no rest running, and nothing to ask about.
    this.restEndsAt.set(null);
    this._rest.set(null);
    void this._stillTraining.cancel();
    this.store.pause(
      () => this._goBack(),
      () =>
        void this._feedbackService.error(
          null,
          this._translateService.instant('workouts.logger.toast.pauseFailed'),
        ),
    );
  }

  private _goBack(): void {
    void this._navController.navigateBack('/tabs/workouts');
  }

  retry(): void {
    this.ionViewWillEnter();
  }

  /**
   * One set for the lock screen, counted in `exercises` (the sets before it
   * taken as ticked): what it shows, what its ✓ saves, the rest after it.
   */
  private _liveStep(
    ref: SetRef,
    exercises: readonly LoggedExercise[],
    rounds: boolean,
    passed: ReadonlySet<string>,
  ): LiveStep | null {
    const view = this.views().find((v) => v.exercise.id === ref.exerciseId);
    if (!view) {
      return null;
    }
    const row = view.rows.find((r) => r.set.id === ref.setId);
    if (!row) {
      return null;
    }
    const exercise = exercises.find((e) => e.id === ref.exerciseId);
    let sets: LoggedSet[] = [];
    if (exercise && exercise.sets) {
      sets = exercise.sets;
    }
    const everySet = exercises.filter((e) => !e.isSkipped).flatMap((e) => e.sets ?? []);
    const shown = (field: SetField) => this._stepValue(row, ref.exerciseId, exercises, field);
    const values: LiveValues = {};
    for (const field of view.fields) {
      const value = shown(field);
      if (value !== null) {
        values[PAYLOAD_KEY[field]] = value;
      }
    }
    const choices = this._restChoices(ref.exerciseId);
    const { rest, final } = afterTick(exercises, ref, row.set, rounds, passed, choices);
    const name = view.exercise.exerciseNameSnapshot;
    const setName = row.badge.short ?? row.badge.name;
    const target = setLine(view.fields, shown, true);
    const step: LiveStep = {
      exercise: name,
      set: setName,
      target,
      last: row.last,
      done: sets.filter((set) => set.isCompleted).length,
      total: sets.length,
      workoutDone: everySet.filter((set) => set.isCompleted).length,
      workoutTotal: everySet.length,
      kicker: '',
      order: '',
      exerciseId: ref.exerciseId,
      setId: ref.setId,
      values,
      short: setLine(view.fields, shown, false),
      rest,
      line: nextSetLine(setName, target, name, this._lastSetWords(sets)),
      final,
    };
    const block = this.blocks().find(
      (b): b is SupersetBlock =>
        b.kind === 'superset' && b.members.some((m) => m.view.exercise.id === ref.exerciseId),
    );
    if (!block) {
      return step;
    }
    const round = block.rounds.find((r) => r.rows.some((member) => member.row.set.id === ref.setId));
    if (!round) {
      return step;
    }
    const ticked = new Set(everySet.filter((set) => set.isCompleted).map((set) => set.id));
    const order = round.rows
      .map((member) =>
        [
          member.tag,
          member.view.exercise.exerciseNameSnapshot,
          setLine(
            member.view.fields,
            (field) => this._stepValue(member.row, member.view.exercise.id, exercises, field),
            false,
          ),
        ]
          .filter(Boolean)
          .join(' '),
      )
      .join(' → ');
    return {
      ...step,
      done: block.rounds.filter((r) => r.rows.every((member) => ticked.has(member.row.set.id))).length,
      total: block.total,
      kicker: this._translateService.instant('workouts.superset.kicker', {
        round: round.index + 1,
        total: block.total,
      }),
      order,
    };
  }

  /**
   * What a set logs once the lock screen reaches it: its own value, else its
   * pre-fill, read against `exercises`, where the steps before it are
   * already ticked with the values their ✓ carried. So a later step still
   * pre-fills from the set before, which a pre-fill only does once that set
   * is ticked. For the first step this is the list's own `shownValue`.
   */
  private _stepValue(
    row: SetView,
    exerciseId: string,
    exercises: readonly LoggedExercise[],
    field: SetField,
  ): number | null {
    const own = cellValue(row.set, field);
    if (own !== null) return own;
    const sets = exercises.find((e) => e.id === exerciseId)?.sets ?? [];
    const index = sets.findIndex((set) => set.id === row.set.id);
    return prefillValue(row.set, field, row.previousSet, index > 0 ? sets[index - 1] : null);
  }

  /** What bends the rest after this exercise's sets: the rest sheet, the person's default. */
  private _restChoices(exerciseId: string): Omit<RestChoices, 'sameRound'> {
    return {
      exerciseOverride: this._restByExercise()[exerciseId] ?? null,
      workoutDefault: this._restForAll(),
      personDefault: this._settings().defaultRestSeconds,
    };
  }

  /** "Last set", when the exercise with these sets has one left; else empty. */
  private _lastSetWords(sets: readonly LoggedSet[]): string {
    if (!isLastLeft(sets)) {
      return '';
    }
    return this._translateService.instant('workouts.restTimer.lastSet');
  }

  // ─── Sets ─────────────────────────────────────────────────────

  /**
   * ✓ on a set. Values still showing their grey pre-fill are saved as they
   * are: if the numbers were right, the tick is the only tap. Then rest
   * starts (none before a drop set, 45 s after a warm-up), "How hard?" shows
   * where it should, and the focus moves on.
   *
   * On a set already ticked (opened to edit), the tick takes it back.
   */
  tick(exercise: LoggedExercise, set: LoggedSet, from: LockScreenTick | null = null): void {
    this._keepTyped();
    this.editing.set(null);
    this.dismissEffort();

    const fresh = this._findSet(exercise.id, set.id) ?? set;
    if (fresh.isCompleted) {
      if (from) {
        return;
      }
      this.store.logSet(exercise.id, fresh.id, { isCompleted: false });
      if (this._rest()?.setId === fresh.id) {
        this.restEndsAt.set(null);
        this._rest.set(null);
      }
      return;
    }

    let now = Date.now();
    if (from) {
      now = from.at;
    }
    // The rest before this set ends here, unless it was ended by hand.
    this._recordRest(fresh, now);

    let payload: LogSetPayload = { isCompleted: true };
    if (from) {
      // Exactly what the lock screen's button said, stamped when it was tapped.
      payload = { ...from.values, isCompleted: true, completedAt: new Date(from.at).toISOString() };
    } else {
      this._restCueService.unlock();
      const view = this.views().find((v) => v.exercise.id === exercise.id);
      const row = view?.rows.find((r) => r.set.id === fresh.id);
      for (const field of view?.fields ?? []) {
        const prefill = row?.prefill[field] ?? null;
        if (cellValue(fresh, field) == null && prefill != null) {
          payload[PAYLOAD_KEY[field]] = prefill;
        }
      }
    }
    this.store.logSet(exercise.id, fresh.id, payload);

    const { rest } = afterTick(
      this.store.exercises(),
      { exerciseId: exercise.id, setId: fresh.id },
      fresh,
      this._rounds(),
      this._activeSession.passed(),
      this._restChoices(exercise.id),
    );
    if (rest !== null) {
      this.restStartedAt.set(now);
      this.restEndsAt.set(now + rest * 1000);
      this._rest.set({ exerciseId: exercise.id, setId: fresh.id, startedAt: now, planned: rest });
    } else {
      this.restEndsAt.set(null);
      this._rest.set(null);
    }

    // "How hard?" asks right after the set; from the lock screen that moment has passed.
    if (!from && asksEffort(fresh, this.prefs().askEffort)) {
      this._showEffort(fresh.id);
    }
    const log = this.store.log();
    if (log) void this._stillTraining.remind(log.id, log.name);
  }

  /**
   * Previous was tapped: this set takes last time's numbers, the fields this
   * exercise records only. Not a tick: the person still confirms the set.
   */
  usePrevious(exercise: LoggedExercise, set: LoggedSet, previous: LoggedSet | null): void {
    if (!previous || set.isCompleted) return;
    this._keepTyped();
    this.editing.set(null);
    const payload: LogSetPayload = {};
    for (const field of this._fieldsFor(exercise)) {
      const value = cellValue(previous, field);
      if (value !== null) payload[PAYLOAD_KEY[field]] = value;
    }
    if (Object.keys(payload).length) this.store.logSet(exercise.id, set.id, payload);
  }

  /** A summary line was tapped: open the set to edit in place, from its first field. */
  openSet(exercise: LoggedExercise, set: LoggedSet): void {
    const field = this._fieldsFor(exercise)[0];
    if (field) this.editCell(exercise, set, field);
  }

  editCell(exercise: LoggedExercise, set: LoggedSet, field: SetField): void {
    // Tapping another cell is a Done for this one: what was typed stays.
    this._keepTyped();
    this.dismissEffort();
    const fresh = this._findSet(exercise.id, set.id) ?? set;
    // A set opened in a card folded by hand (from the lock screen) opens the
    // card for good: the person is working there again.
    const fold = this._foldTarget(exercise);
    if (fold && this._folds().get(fold.key) === true) this._setFold(fold.key, null);
    this.editing.set({ exerciseId: exercise.id, setId: fresh.id, field });
    this.typed.set(null);
    // Seeded with the value, else its pre-fill: the steppers work from what
    // the field shows, and the first digit typed replaces it.
    const row = this.views()
      .find((v) => v.exercise.id === exercise.id)
      ?.rows.find((r) => r.set.id === fresh.id);
    const current = cellValue(fresh, field) ?? row?.prefill[field] ?? null;
    this.draft.set(current == null ? '' : String(current));
  }

  /**
   * The pad's wide key: save this field, then the next field of the same set,
   * else tick the set, or close when it is already ticked.
   */
  onPadAction(typed: string): void {
    const target = this.editing();
    this._save(typed);
    if (!target) return;
    const exercise = this.store.exercises().find((e) => e.id === target.exerciseId);
    const set = exercise ? this._findSet(exercise.id, target.setId) : null;
    if (!exercise || !set) {
      this.editing.set(null);
      return;
    }
    const fields = this._fieldsFor(exercise);
    const next = fields[fields.indexOf(target.field) + 1];
    if (next) {
      this.editCell(exercise, set, next);
      return;
    }
    this.editing.set(null);
    if (!set.isCompleted) this.tick(exercise, set);
  }

  /** "Set 2", or "Round 2" in a superset: the set as labels name it after the exercise. */
  private _labelOf(exercise: LoggedExercise, index: number): string {
    const row = this.views()
      .find((v) => v.exercise.id === exercise.id)
      ?.rows[index];
    return row ? (row.badge.short ?? row.badge.name) : '';
  }

  /** Close keeps what was typed, like everywhere else. */
  closePad(): void {
    this._keepTyped();
    this.editing.set(null);
  }

  private _findSet(exerciseId: string, setId: string): LoggedSet | null {
    return (
      this.store
        .exercises()
        .find((e) => e.id === exerciseId)
        ?.sets?.find((s) => s.id === setId) ?? null
    );
  }

  // ─── Effort ───────────────────────────────────────────────────

  pickEffort(exercise: LoggedExercise, set: LoggedSet, value: number): void {
    this.dismissEffort();
    this.store.logSet(exercise.id, set.id, { rpe: value });
  }

  dismissEffort(): void {
    this._clearEffortTimer();
    this.effortFor.set(null);
  }

  private _showEffort(setId: string): void {
    this._clearEffortTimer();
    this.effortFor.set(setId);
    this._effortTimer = setTimeout(() => {
      if (this.effortFor() === setId) this.effortFor.set(null);
    }, EFFORT_PROMPT_MS);
  }

  private _clearEffortTimer(): void {
    if (this._effortTimer !== null) clearTimeout(this._effortTimer);
    this._effortTimer = null;
  }

  // ─── Set menu ─────────────────────────────────────────────────

  openMenu(exercise: LoggedExercise, set: LoggedSet, badge: SetBadge): void {
    this._keepTyped();
    this.editing.set(null);
    this.dismissEffort();
    this.menuSet.set({ exerciseId: exercise.id, set, badge });
    this.menuOpen.set(true);
  }

  onSetType(type: ExerciseSetType): void {
    const target = this.menuSet();
    if (target) this.store.logSet(target.exerciseId, target.set.id, { setType: type });
  }

  onSetNote(note: string | null): void {
    const target = this.menuSet();
    if (target) this.store.logSet(target.exerciseId, target.set.id, { notes: note });
  }

  /** From the set's menu: another set like it. */
  onSetCopy(): void {
    const target = this.menuSet();
    if (target) this.copySet(target.exerciseId, target.set);
  }

  onSetRemove(): void {
    const target = this.menuSet();
    const exercise = target
      ? this.store.exercises().find((e) => e.id === target.exerciseId)
      : null;
    if (target && exercise) this.removeSet(exercise, target.set);
  }

  /** From the set's menu: the whole superset round it is in. */
  onRoundRemove(): void {
    const round = this.menuRound();
    if (round) this.deleteRound(round);
  }

  // ─── Scroll and focus ─────────────────────────────────────────

  /** After the list has drawn the focus. */
  private _scrollToFocusSoon(): void {
    setTimeout(() => void this._scrollToFocus(), 120);
  }

  /** The focus set to a third of the way down: above the pad and the rest bar. */
  private async _scrollToFocus(): Promise<void> {
    const row = this._row('[data-focus]');
    const content = this._content();
    if (!row || !content) return;
    const scroller = await content.getScrollElement();
    const box = this._visibleBox(scroller);
    const want = box.top + (box.bottom - box.top) * FOCUS_AT;
    const delta = row.getBoundingClientRect().top - want;
    if (Math.abs(delta) < 4) return;
    await content.scrollToPoint(
      0,
      Math.max(0, scroller.scrollTop + delta),
      prefersReducedMotion() ? 0 : FOCUS_SCROLL_MS,
    );
  }

  /** The set the pad types into, kept above the pad (`revealAbovePad`). */
  private async _revealEditing(opening: boolean): Promise<void> {
    const row = this._row('[data-editing]');
    const content = this._content();
    if (!row || !content) return;
    const duration = opening || prefersReducedMotion() ? 0 : PAD_REVEAL_MS;
    await revealAbovePad(content, this._host.nativeElement, row, duration);
  }

  /** The part of the list a person can see, between the header and the pad or rest bar. */
  private _visibleBox(scroller: HTMLElement): ScreenSpan {
    return visibleSpan(this._host.nativeElement, scroller);
  }

  private _row(selector: string): HTMLElement | null {
    return this._host.nativeElement.querySelector<HTMLElement>(`mh-set-row${selector}`);
  }

  /** Saves whatever the open keypad holds — before focus leaves its cell. */
  private _keepTyped(): void {
    const keypad = this._keypad();
    if (this.editing() && keypad) this._save(keypad.committed());
  }

  /** Writes the typed value into the cell the pad is bound to. */
  private _save(typed: string): void {
    const target = this.editing();
    if (!target) return;

    const raw = typed.trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;

    // Unchanged is not a write: moving through cells should not hit the API.
    const set = this.store
      .exercises()
      .find((e) => e.id === target.exerciseId)
      ?.sets?.find((s) => s.id === target.setId);
    // `?? null`: a cleared cell is patched to undefined locally, never null.
    if (set && (cellValue(set, target.field) ?? null) === value) return;

    this.store.logSet(target.exerciseId, target.setId, {
      [PAYLOAD_KEY[target.field]]: value ?? undefined,
    });
  }

  /** Offer the weight column only where it is missing and would mean something. */
  canAddWeight(exercise: LoggedExercise): boolean {
    return exercise.exercise?.kind === ExerciseKind.Bodyweight && !this.hasAddedWeight(exercise);
  }

  hasAddedWeight(exercise: LoggedExercise): boolean {
    return this._loaded().has(exercise.id);
  }

  addWeight(exercise: LoggedExercise): void {
    this._loaded.update((set) => new Set(set).add(exercise.id));
  }

  isUnilateral(exercise: LoggedExercise): boolean {
    return exercise.exercise?.isUnilateral ?? false;
  }

  /** The cells a set row draws for this exercise, in order. */
  private _fieldsFor(exercise: LoggedExercise): SetField[] {
    return fieldsFor(exercise.exercise?.kind, this.hasAddedWeight(exercise));
  }

  private _columnLabel(exercise: LoggedExercise, field: SetField): string {
    return this._translateService.instant(columnLabelKey(field, this.isUnilateral(exercise)));
  }

  // ─── Folding ──────────────────────────────────────────────────

  /** The card `exercise` is in shows as one line: see `_folds`. */
  isFolded(exercise: LoggedExercise): boolean {
    const block = this._blockOf(exercise);
    return block?.kind === 'single' ? block.view.folded : !!block?.folded;
  }

  /** A folded line was tapped: its sets show again. */
  unfold(exercise: LoggedExercise): void {
    const target = this._foldTarget(exercise);
    if (target) this._setFold(target.key, target.done ? false : null);
  }

  /**
   * Folds an exercise, or the superset it is in, to one line: the ⋯ sheet's
   * Collapse. A set open in the pad there closes first, keeping what was
   * typed, since an exercise being edited never folds.
   */
  fold(exercise: LoggedExercise): void {
    const target = this._foldTarget(exercise);
    if (!target) return;
    const block = this._blockOf(exercise);
    const ids =
      block?.kind === 'superset' ? block.members.map((m) => m.view.exercise.id) : [exercise.id];
    if (ids.includes(this.editing()?.exerciseId ?? '')) this.closePad();
    this._setFold(target.key, target.done ? null : true);
  }

  /** The card `exercise` is drawn in: its own, or its superset's. */
  private _blockOf(exercise: LoggedExercise): BlockView | null {
    return (
      this.blocks().find((block) =>
        block.kind === 'single'
          ? block.view.exercise.id === exercise.id
          : block.members.some((m) => m.view.exercise.id === exercise.id),
      ) ?? null
    );
  }

  /**
   * What folds `exercise`'s card, and whether it is finished (which folds it
   * without asking), or null when there is nothing to fold: a skipped
   * exercise, whose card has no sets, or a superset with every member skipped.
   */
  private _foldTarget(exercise: LoggedExercise): { key: string; done: boolean } | null {
    const block = this._blockOf(exercise);
    if (!block) return null;
    if (block.kind === 'single') {
      return block.view.exercise.isSkipped ? null : { key: block.key, done: block.view.done };
    }
    return block.members.some((m) => !m.view.exercise.isSkipped)
      ? { key: block.key, done: block.done }
      : null;
  }

  /** Folds (true) or opens (false) the card by hand; null goes back to the default. */
  private _setFold(key: string, folded: boolean | null): void {
    this._folds.update((folds) => {
      const next = new Map(folds);
      if (folded === null) next.delete(key);
      else next.set(key, folded);
      return next;
    });
  }

  // ─── Superset links ───────────────────────────────────────────

  /** The chip between two cards: link them as a superset, or undo it. */
  toggleLink(index: number): void {
    this._setSupersets(toggledLinks(this.store.exercises(), index));
  }

  /** The ⋯ sheet's Unlink from superset: the exercise leaves its superset. */
  unlink(exercise: LoggedExercise): void {
    const exercises = this.store.exercises();
    const index = exercises.findIndex((e) => e.id === exercise.id);
    if (index >= 0) this._setSupersets(withoutSuperset(exercises, index));
  }

  /**
   * The cards change shape, so a set open in the pad closes first, keeping
   * what was typed. A card folded or opened by hand that the link reshapes
   * (it joins, leaves or gains a member) goes back to the default: the new
   * card is a different one. Any other card stays as it was left, including
   * a superset the change only renumbers.
   */
  private _setSupersets(changes: SupersetChange[]): void {
    if (!changes.length) return;
    if (this.editing()) this.closePad();
    const exercises = this.store.exercises();
    const reshaped = reshapedCards(exercises, withLinks(exercises, changes), this._rounds());
    if (reshaped.size) {
      this._folds.update((folds) => new Map([...folds].filter(([key]) => !reshaped.has(key))));
    }
    this.store.setSupersets(changes, (error) => {
      void this._feedbackService.error(
        error,
        this._translateService.instant('workouts.logger.toast.supersetFailed'),
      );
    });
  }

  addSet(exercise: LoggedExercise): void {
    this.store.addSet(exercise.id);
  }

  /** "+ Round": one more set on every exercise of the superset still in play. */
  addRound(members: { view: ExerciseView }[]): void {
    for (const { view } of members) {
      if (!view.exercise.isSkipped) this.store.addSet(view.exercise.id);
    }
  }

  removeSet(exercise: LoggedExercise, set: LoggedSet): void {
    this._removeSets(
      [{ exerciseId: exercise.id, setId: set.id }],
      'workouts.logger.toast.removeSetFailed',
    );
  }

  /** Swipe left, then Delete: the row closes and the set goes. */
  swipeDelete(sliding: IonItemSliding, exercise: LoggedExercise, set: LoggedSet): void {
    void sliding.close();
    this.removeSet(exercise, set);
  }

  /** Swipe right, then Copy: the row closes and a set like it is added. */
  swipeCopy(sliding: IonItemSliding, exercise: LoggedExercise, set: LoggedSet): void {
    void sliding.close();
    this.copySet(exercise.id, set);
  }

  /**
   * Adds a set like `set` to its exercise: its type and the numbers it shows,
   * typed or grey, unticked. What was typed into it but not yet kept is kept
   * first, so the copy carries the numbers on screen.
   */
  copySet(exerciseId: string, set: LoggedSet): void {
    this._keepTyped();
    this.editing.set(null);
    const exercise = this.store.exercises().find((e) => e.id === exerciseId);
    if (!exercise) return;
    const row = this.views()
      .find((v) => v.exercise.id === exerciseId)
      ?.rows.find((r) => r.set.id === set.id);
    const current = row?.set ?? exercise.sets?.find((s) => s.id === set.id) ?? set;
    const values = copiedValues(row ?? { set: current, prefill: {} }, this._fieldsFor(exercise));
    this.store.copySet(exerciseId, current.setType, values, (error) =>
      void this._feedbackService.error(
        error,
        this._translateService.instant('workouts.logger.toast.copySetFailed'),
      ),
    );
  }

  /** Every set of the round, of every exercise in it, in one go. */
  deleteRound(round: RoundView): void {
    const sets = round.rows.map((item) => ({ exerciseId: item.view.exercise.id, setId: item.row.set.id }));
    this._removeSets(sets, 'workouts.logger.toast.removeRoundFailed');
  }

  /** Sets gone from the screen now; `failedKey` says so when the server kept them. */
  private _removeSets(
    sets: readonly { exerciseId: string; setId: string }[],
    failedKey: string,
  ): void {
    this._forgetSets(sets.map((entry) => entry.setId));
    this.store.removeSets(sets, (error) => {
      void this._feedbackService.error(error, this._translateService.instant(failedKey));
    });
  }

  /** Sets about to go: nothing may keep editing them or timing a rest after them. */
  private _forgetSets(setIds: readonly string[]): void {
    const editingId = this.editing()?.setId;
    if (editingId && setIds.includes(editingId)) {
      this.editing.set(null);
    }
    const restSetId = this._rest()?.setId;
    if (restSetId && setIds.includes(restSetId)) {
      this.restEndsAt.set(null);
      this._rest.set(null);
    }
  }

  // ─── Rest ─────────────────────────────────────────────────────

  nudgeRest(seconds: number): void {
    const end = this.restEndsAt();
    if (end === null) return;
    this.restEndsAt.set(Math.max(Date.now(), end + seconds * 1000));
  }

  /** Skip, before zero: the rest ends now, and that is its exact length. */
  skipRest(): void {
    this._recordTappedRest();
  }

  /** Start set, from zero on: the same, with the set about to begin. */
  startSet(): void {
    this._recordTappedRest();
  }

  /** Hide, in overtime: the bar goes, the rest is still measured at the next tick. */
  hideRest(): void {
    this.restEndsAt.set(null);
  }

  /** Ten minutes over: no longer rest. The bar goes; the next tick calls it a break. */
  onRestExpired(): void {
    this.restEndsAt.set(null);
  }

  onRestSoon(): void {
    this._restCueService.soon(this.prefs().vibration);
  }

  onRestFinished(): void {
    const { sound, vibration } = this.prefs();
    this._restCueService.done({ sound, vibrate: vibration });
  }

  openRestSheet(): void {
    this.restSheetOpen.set(true);
  }

  // ─── This workout's ⋯ ─────────────────────────────────────────

  openOptions(): void {
    this._keepTyped();
    this.editing.set(null);
    this.optionsOpen.set(true);
  }

  onPrefs(change: Partial<LoggerPrefs>): void {
    this._workoutPrefs.update((prefs) => ({ ...prefs, ...change }));
  }

  /**
   * The ⋯'s rest for every exercise, on each tap there. The rest running now
   * keeps what its plan said; the next one takes the new length.
   */
  onRestForAll(seconds: number): void {
    this._restForAll.set(seconds);
  }

  onOption(id: LoggerOptionId): void {
    switch (id) {
      case LoggerOptionIds.AddExercises:
        this.addExercise();
        return;
      case LoggerOptionIds.Pause:
        this.onLeaveChoice(LeaveChoices.Pause);
        return;
      case LoggerOptionIds.Discard:
        this.openDiscard();
        return;
    }
  }

  /** The timer's new rest for this exercise or for all, and the running one with it. */
  applyRest(change: RestChange): void {
    const rest = this._rest();
    if (change.scope === RestScopes.Exercise && rest) {
      this._restByExercise.update((map) => ({ ...map, [rest.exerciseId]: change.seconds }));
    } else {
      this._restForAll.set(change.seconds);
    }
    // The sheet opens from the timer, so the running rest takes the new
    // length too, whoever it is for.
    const start = this.restStartedAt();
    if (start !== null && this.restEndsAt() !== null) {
      this.restEndsAt.set(start + change.seconds * 1000);
      if (rest) this._rest.set({ ...rest, planned: change.seconds });
    }
  }

  /** `at`: when it was ended, which is now unless it was on the lock screen. */
  private _recordTappedRest(at = Date.now()): void {
    const rest = this._rest();
    this.restEndsAt.set(null);
    this._rest.set(null);
    if (rest) this._saveRest(rest, tappedRest((at - rest.startedAt) / 1000));
  }

  /** At a tick, a rest nobody ended by hand is estimated from the gap. */
  private _recordRest(ticked: LoggedSet, at = Date.now()): void {
    const rest = this._rest();
    if (!rest || rest.setId === ticked.id) return;
    this._rest.set(null);
    const gap = (at - rest.startedAt) / 1000;
    const measured = estimatedRest(gap, rest.planned, ticked);
    if (!measured) return;
    this._saveRest(rest, measured);
    // Away too long to be rest: ask once whether that time should count.
    if (measured.source === RestSources.Break) {
      this._awaySeconds = Math.max(60, Math.round(gap - rest.planned));
      this.awayMinutes.set(Math.round(gap / 60));
      this.awayOpen.set(true);
    }
  }

  /** "Pause it": the time away comes off the workout's duration. */
  confirmAway(): void {
    this.awayOpen.set(false);
    this.store.pauseGap(
      this._awaySeconds,
      () =>
        void this._feedbackService.error(
          null,
          this._translateService.instant('workouts.logger.toast.pauseFailed'),
        ),
    );
  }

  // ─── Your note ────────────────────────────────────────────────

  openNote(exercise: LoggedExercise): void {
    if (!exercise.exerciseId) return;
    this._keepTyped();
    this.editing.set(null);
    this.noteFor.set(exercise);
    this.noteOpen.set(true);
  }

  saveNote(note: string | null): void {
    const exercise = this.noteFor();
    const id = exercise?.exerciseId;
    if (!id || this.noteSaving()) return;
    this.noteSaving.set(true);
    this._exerciseService
      .setNote(id, note)
      .pipe(take(1))
      .subscribe({
        next: (saved) => {
          this.noteSaving.set(false);
          this.store.setPersonalNote(id, saved.note);
          this.noteOpen.set(false);
        },
        error: (err) => {
          this.noteSaving.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.exerciseNote.saveFailed'),
          );
        },
      });
  }

  private _saveRest(rest: { exerciseId: string; setId: string }, measured: MeasuredRest): void {
    this.store.logSet(rest.exerciseId, rest.setId, {
      restAfterSeconds: measured.seconds,
      restSource: measured.source,
    });
  }

  // ─── Exercises ────────────────────────────────────────────────

  openActions(exercise: LoggedExercise): void {
    this.actionsFor.set(exercise);
    this.actionsOpen.set(true);
  }

  onAction(id: ExerciseActionId): void {
    const exercise = this.actionsFor();
    this.actionsFor.set(null);
    if (!exercise) return;

    switch (id) {
      case ExerciseActionIds.Collapse:
        this.fold(exercise);
        return;
      case ExerciseActionIds.History:
        this.openHistory(exercise);
        return;
      case ExerciseActionIds.Note:
        this.openNote(exercise);
        return;
      case ExerciseActionIds.Swap:
        this.swapTarget.set(exercise);
        this.pickerOpen.set(true);
        return;
      case ExerciseActionIds.Unlink:
        this.unlink(exercise);
        return;
      case ExerciseActionIds.Skip:
        this.store.setSkipped(exercise.id, !exercise.isSkipped);
        return;
      case ExerciseActionIds.Remove:
        // Asked, not assumed: an exercise can hold sets that are already logged.
        this.actionsFor.set(exercise);
        this.removeConfirmOpen.set(true);
        return;
    }
  }

  confirmRemove(): void {
    const exercise = this.actionsFor();
    this.removeConfirmOpen.set(false);
    this.actionsFor.set(null);
    if (!exercise) return;
    this.store.removeExercise(exercise.id);
    void this._feedbackService.success(
      this._translateService.instant('workouts.logger.toast.removed', {
        name: exercise.exerciseNameSnapshot,
      }),
    );
  }

  /** Abandon the whole session — the "changed my mind" path, not a skip. */
  confirmDiscard(): void {
    const log = this.store.log();
    if (!log || this.discarding()) return;
    this.discarding.set(true);
    this._workoutLogService
      .discard(log.id)
      .pipe(take(1))
      .subscribe({
        next: async () => {
          this.discarding.set(false);
          this._activeSession.end();
          void this._stillTraining.cancel();
          await this._discardSheet()?.close();
          void this._feedbackService.success(
            this._translateService.instant('workouts.logger.toast.discarded'),
          );
          void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
        },
        error: (err) => {
          this.discarding.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.logger.toast.discardFailed'),
          );
        },
      });
  }

  addExercise(): void {
    this.swapTarget.set(null);
    this.pickerOpen.set(true);
  }

  /** One handler for both jobs — whether it swaps depends on `swapTarget`. */
  onPicked(picked: Exercise[]): void {
    this.pickerOpen.set(false);
    if (!picked.length) return;

    const target = this.swapTarget();
    this.swapTarget.set(null);

    if (target) {
      this.store.swapExercise(target.id, picked[0].id, () => this._loadLastTimes());
      return;
    }
    this.store.addExercises(
      picked.map((e) => e.id),
      () => this._loadLastTimes(),
    );
  }

  /**
   * The exercise's history, pushed onto the workouts stack over the running
   * workout, so back returns to it. A value still on the keypad is kept first.
   */
  openHistory(exercise: LoggedExercise): void {
    if (!exercise.exerciseId) return;
    this._keepTyped();
    this.editing.set(null);
    void this._router.navigate(['/tabs/workouts/progress', exercise.exerciseId]);
  }

  /** The catalog page for this movement, pushed onto the workouts stack. */
  openExercise(exercise: LoggedExercise): void {
    if (!exercise.exerciseId) return;
    void this._router.navigate(['/tabs/workouts/exercise', exercise.exerciseId]);
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Finishing with sets still unticked is allowed — an explicit finish marks
   * the workout complete even when partial — but it is worth one question,
   * because the alternative reading is "I tapped the wrong thing". The same
   * sheet answers a Finish with nothing ticked, with Discard alone: there is
   * nothing to save (`finishOptions`). With every set ticked there is nothing
   * to ask.
   */
  finish(): void {
    if (!this.store.log() || this.finishing()) return;
    // A tap on Finish while typing is a Done for that cell, as everywhere.
    this._keepTyped();
    this.editing.set(null);

    const { done, total } = this.store.progress();
    if (done < total || done === 0) {
      this.finishSheetOpen.set(true);
      return;
    }
    this._completeOrAsk();
  }

  /** The finish sheet's answer, reported once the sheet has gone. */
  onFinishChoice(choice: FinishChoice): void {
    if (choice === FinishChoices.Save) {
      this._completeOrAsk();
      return;
    }
    this.openDiscard();
  }

  /**
   * A routine whose shape this workout changed asks first whether the
   * routine should change with it (user decision, 2026-11-16). Closing that
   * sheet without an answer goes back to the workout, unfinished.
   */
  private _completeOrAsk(): void {
    if (this.routineChanges()) {
      this.updateAskOpen.set(true);
      return;
    }
    this._complete();
  }

  /** The update sheet's answer: both finish the workout; one also updates the routine. */
  onUpdateChoice(choice: RoutineUpdateChoice): void {
    this._complete(choice === RoutineUpdateChoices.Update);
  }

  /**
   * Yours, and started as a routine: read now, quietly. Without it Finish
   * simply does not ask.
   */
  private _loadSourceRoutine(): void {
    const log = this.store.log();
    const id = log ? updatableRoutineId(log) : null;
    if (!id || this._sourceRoutine()?.id === id) return;
    this._routineService
      .get(id)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((routine) => {
        const own = routine && isOwnRoutine(routine, this._authStore.user()?.id);
        this._sourceRoutine.set(own ? routine : null);
      });
  }

  /**
   * The routine takes the workout's shape. After the workout is saved, so a
   * failure here loses nothing logged; it says so and the routine stays.
   */
  private _updateRoutine(routine: Routine, exercises: readonly LoggedExercise[]): void {
    this._routineService
      .update(routine.id, { exercises: routineFromWorkout(routine, exercises) })
      .pipe(take(1))
      .subscribe({
        next: () =>
          void this._feedbackService.success(
            this._translateService.instant('workouts.updateRoutine.toast.updated', {
              name: routine.name,
            }),
          ),
        error: (err) =>
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.updateRoutine.toast.failed', {
              name: routine.name,
            }),
          ),
      });
  }

  /** The red confirm, from the ⋯ sheet or the finish sheet. */
  openDiscard(): void {
    this.discardConfirmOpen.set(true);
  }

  /**
   * Completes the workout here, so the summary opens on a finished one: its
   * duration and records are only set by completing. Waits for set writes
   * still on their way first, or the last tick before Finish is refused.
   */
  private _complete(updateRoutine = false): void {
    const log = this.store.log();
    if (!log || this.finishing()) return;
    this.finishing.set(true);
    this.restEndsAt.set(null);
    const routine = updateRoutine ? this._sourceRoutine() : null;

    this.store.whenSettled(() =>
      this._workoutLogService
        .complete(log.id)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.finishing.set(false);
            // Read once every set write has landed, as the workout was saved.
            if (routine) this._updateRoutine(routine, this.store.exercises());
            // Replaced, so back from the summary returns to wherever the
            // workout was opened from rather than into a finished logger.
            this._activeSession.end();
            void this._stillTraining.cancel();
            void this._router.navigate(['/tabs/workouts/finish', log.id], {
              queryParams: { from: 'logger' },
              replaceUrl: true,
            });
          },
          error: (err) => {
            this.finishing.set(false);
            void this._feedbackService.error(
              err,
              this._translateService.instant('workouts.logger.toast.finishFailed'),
            );
          },
        }),
    );
  }

  /**
   * "Last time" for every movement in the workout, one call each.
   *
   * Fetched once on open rather than per row: the set grid renders before
   * these land and simply shows an em dash until they do, which is also the
   * honest answer for a movement never done before.
   */
  private _loadLastTimes(): void {
    const ids = Array.from(
      new Set(
        this.store
          .exercises()
          .map((e) => e.exerciseId)
          .filter((id): id is string => !!id),
      ),
    ).filter((id) => !(id in this._previous()));
    if (!ids.length) return;

    for (const id of ids) {
      this._workoutLogService
        .lastForExercise(id)
        .pipe(take(1), catchError(() => of([] as LoggedSet[])))
        .subscribe((sets) => {
          this._previous.update((map) => ({ ...map, [id]: sets }));
        });
    }
  }

  /** Copy the movements out of a past workout into the one just started. */
  private _carryOver(sourceLogId: string): void {
    this._workoutLogService
      .get(sourceLogId)
      .pipe(take(1))
      .subscribe({
        next: (source) => {
          const ids = (source.exercises ?? [])
            .filter((e) => !e.isSkipped)
            .map((e) => e.exerciseId)
            .filter((id): id is string => !!id);
          if (!ids.length) {
            void this._feedbackService.info(
              this._translateService.instant('workouts.logger.toast.nothingToRepeat'),
            );
            return;
          }
          // With their last times, as a pick from the picker gets.
          this.store.addExercises(ids, () => this._loadLastTimes());
        },
        error: () =>
          void this._feedbackService.info(
            this._translateService.instant('workouts.logger.toast.repeatFailed'),
          ),
      });
  }

  private _startTicker(): void {
    this._stopTicker();
    this._now.set(Date.now());
    this._ticker = setInterval(() => this._now.set(Date.now()), 1000);
  }

  private _stopTicker(): void {
    if (this._ticker !== null) clearInterval(this._ticker);
    this._ticker = null;
  }
}
