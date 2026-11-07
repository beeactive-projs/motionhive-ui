import {
  Component,
  DestroyRef,
  ElementRef,
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
  IonProgressBar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  Exercise,
  ExerciseKind,
  ExerciseService,
  RestSources,
  ExerciseSetType,
  LogSetPayload,
  LoggedExercise,
  LoggedSet,
  SetField,
  SetFields,
  WorkoutLog,
  WorkoutLogService,
  appLocale,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { RestAlertService } from '../../../_shared/services/rest-alert.service';
import { RestLiveAction, RestLiveActionTypes } from '../../../_shared/native/rest-live';
import { prefersReducedMotion } from '../../../_shared/utils/motion';
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
import { EffortPrompt } from '../_components/effort-prompt/effort-prompt';
import { ExerciseCard } from '../_components/exercise-card/exercise-card';
import { NumericKeypad } from '../_components/numeric-keypad/numeric-keypad';
import { RestTimerBar } from '../_components/rest-timer-bar/rest-timer-bar';
import { SetRow } from '../_components/set-row/set-row';
import { ExerciseActionsSheet } from '../_sheets/exercise-actions-sheet/exercise-actions-sheet';
import { LeaveWorkoutSheet } from '../_sheets/leave-workout-sheet/leave-workout-sheet';
import { RestChange, RestScope, RestScopes, RestSheet } from '../_sheets/rest-sheet/rest-sheet';
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
  KeypadField,
  KeypadFields,
  LeaveChoice,
  LeaveChoices,
  WORKOUT_ICONS,
  formatMeasure,
  secondsToClock,
  isExerciseDone,
  loggerRedirect,
  workoutClock,
} from '../workouts.config';
import {
  EFFORT_PROMPT_MS,
  MeasuredRest,
  PAYLOAD_KEY,
  SetBadge,
  SetRef,
  SetRowMode,
  SetRowModes,
  asksEffort,
  cellValue,
  effortTarget,
  estimatedRest,
  exerciseBlocks,
  memberTag,
  roundCount,
  sameRound,
  fieldsFor,
  focusOf,
  foldedSummary,
  lastLine,
  nextAfter,
  withTicked,
  planLine,
  planNoteOf,
  prefillValue,
  restAfterTick,
  setBadge,
  setLine,
  tappedRest,
} from './logger-flow';
import { LoggerStore } from './logger.store';

/** Which cell the keypad is bound to. */
interface EditTarget {
  exerciseId: string;
  setId: string;
  field: SetField;
}

/** The keypad's step size is keyed to the field, not the exercise kind. */
const KEYPAD_FIELD: Record<SetField, KeypadField> = {
  [SetFields.Weight]: KeypadFields.Weight,
  [SetFields.Reps]: KeypadFields.Reps,
  [SetFields.Duration]: KeypadFields.Duration,
  [SetFields.Distance]: KeypadFields.Distance,
};

/** One set as the list draws it. */
interface SetView {
  set: LoggedSet;
  mode: SetRowMode;
  badge: SetBadge;
  prefill: Partial<Record<SetField, number | null>>;
  last: string;
  /** The set the screen points at: the next one to do. */
  focus: boolean;
  /** The field open in the pad, when it is this set's. */
  editing: SetField | null;
  effortTarget: number | null;
}

/** One exercise as the list draws it. */
interface ExerciseView {
  exercise: LoggedExercise;
  /** Every set ticked: folded to one line until opened again. */
  folded: boolean;
  summary: string;
  fields: SetField[];
  plan: string;
  planNote: string;
  note: string;
  rows: SetView[];
}

/** One round of a superset as the card draws it. */
interface RoundView {
  index: number;
  done: boolean;
  /** One line ("A1 62.5 × 8 · A2 × 15") for a round finished or still ahead; null shows the rows. */
  summary: string | null;
  rows: { tag: string; view: ExerciseView; row: SetView }[];
}

/** What a round of a superset offers when its label is tapped. */
const RoundActionIds = {
  Delete: 'delete',
} as const;
type RoundActionId = (typeof RoundActionIds)[keyof typeof RoundActionIds];

const ROUND_ACTIONS: readonly SheetAction<RoundActionId>[] = [
  {
    id: RoundActionIds.Delete,
    label: 'workouts.superset.deleteRound',
    hint: 'workouts.superset.deleteRoundHint',
    icon: 'trash-outline',
    color: 'danger',
    destructive: true,
  },
];

/** An exercise on its own, or a superset: what the list draws, in order. */
type BlockView =
  | { kind: 'single'; key: string; view: ExerciseView }
  | {
      kind: 'superset';
      key: string;
      members: { tag: string; view: ExerciseView }[];
      rounds: RoundView[];
      /** The round on now, from 1; the last one once all are done. */
      current: number;
      total: number;
      folded: boolean;
      names: string;
      restLine: string;
    };

type SupersetBlock = Extract<BlockView, { kind: 'superset' }>;

/** What a set shows: what was typed, else its pre-fill. */
function shownValue(row: SetView, field: SetField): number | null {
  const typed = cellValue(row.set, field);
  if (typed !== null) {
    return typed;
  }
  const prefill = row.prefill[field];
  if (prefill === undefined) {
    return null;
  }
  return prefill;
}

/** Programmatic scrolls fire scroll events too; ignore them for this long. */
const PROGRAMMATIC_SCROLL_MS = 900;
/** A tick from the lock screen's ✓: when it was tapped, and what its button showed. */
interface LockScreenTick {
  at: number;
  values: LiveValues;
}

/** How many sets the lock screen knows ahead: the next one and two after it. */
const LIVE_STEPS = 3;

/** Where the focus set sits, as a share of the visible list's height. */
const FOCUS_AT = 0.32;
/** The list's scroll into place after a tick. */
const FOCUS_SCROLL_MS = 320;

/** The set grid's column heading for each field — translation keys. */
const COLUMN_LABELS: Record<SetField, string> = {
  [SetFields.Weight]: 'workouts.logger.columns.weight',
  [SetFields.Reps]: 'workouts.logger.columns.reps',
  [SetFields.Duration]: 'workouts.logger.columns.time',
  [SetFields.Distance]: 'workouts.logger.columns.distance',
};

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
    ExerciseNoteSheet,
    ExercisePickerSheet,
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
    TranslatePipe,
  ],
  providers: [LoggerStore],
  templateUrl: './logger.html',
  styleUrl: './logger.scss',
})
export class Logger implements ViewWillEnter, ViewWillLeave {
  readonly store = inject(LoggerStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _restAlertService = inject(RestAlertService);
  private readonly _translateService = inject(TranslateService);
  private readonly _navController = inject(NavController);
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

  /** The person's logger settings: their default rest, sound, vibration, effort. */
  private readonly _settings = this._settingsStore.settings;
  /** The ⋯ switches, for this workout only, over the person's settings. */
  private readonly _workoutPrefs = signal<Partial<LoggerPrefs>>({});
  readonly prefs = computed<LoggerPrefs>(() => {
    const { sound, vibration, askEffort } = this._settings();
    return { sound, vibration, askEffort, ...this._workoutPrefs() };
  });
  readonly optionsOpen = signal(false);
  /** Which choice the rest sheet opens on: the ⋯ asks for every exercise. */
  readonly restSheetScope = signal<RestScope>(RestScopes.Exercise);
  readonly restForAllLabel = computed(() =>
    secondsToClock(this._restForAll() ?? this._settings().defaultRestSeconds),
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
  /** What the keypad has typed so far, echoed into the open cell. */
  readonly typed = signal('');

  /** The next set to do: the one the list points at and scrolls to. */
  readonly focus = computed<SetRef | null>(() =>
    focusOf(this.store.exercises(), this._rounds(), this._activeSession.passed()),
  );

  /** The set whose "How hard?" row is showing, for a few seconds after its tick. */
  readonly effortFor = signal<string | null>(null);
  private _effortTimer: ReturnType<typeof setTimeout> | null = null;

  /** The set whose badge menu is open. */
  readonly menuOpen = signal(false);
  /** The superset round whose label was tapped, and its sheet. */
  readonly roundMenu = signal<RoundView | null>(null);
  readonly roundMenuOpen = signal(false);
  readonly roundActions = ROUND_ACTIONS;
  readonly roundMenuTitle = computed(() => {
    const round = this.roundMenu();
    if (!round) {
      return '';
    }
    return this._translateService.instant('workouts.superset.round', { number: round.index + 1 });
  });
  readonly menuSet = signal<{ exerciseId: string; set: LoggedSet; badge: SetBadge } | null>(null);

  /**
   * The person scrolled the focus set out of view themselves: the list stops
   * following it until the next tick or a tap on "Back to…".
   */
  readonly userScrolled = signal(false);
  private _programmaticScrollAt = 0;
  private _lastFocusId: string | null = null;
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
   * Done exercises the user has opened again. Folding is otherwise automatic:
   * tick the last set and the exercise folds to its check row.
   */
  private readonly _unfolded = signal<ReadonlySet<string>>(new Set());

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
    return start !== null && end !== null && this.restSheetScope() === RestScopes.Exercise
      ? Math.round((end - start) / 1000)
      : (this._restForAll() ?? this._settings().defaultRestSeconds);
  });
  readonly restExerciseName = computed(() => {
    if (this.restSheetScope() === RestScopes.Workout) return '';
    const id = this._rest()?.exerciseId;
    return this.store.exercises().find((e) => e.id === id)?.exerciseNameSnapshot ?? '';
  });
  /**
   * What the rest bar says comes next, what to load first: "Set 3 · 62.5 kg
   * × 8 · Bench press". The line is cut from the end on a narrow bar.
   */
  readonly nextLine = computed(() => {
    const next = this.nextUp();
    return next ? [next.title, next.detail].filter(Boolean).join(' · ') : '';
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
      exercises = withTicked(exercises, ref.setId);
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

  /** Confirms that would otherwise lose logged work without asking. */
  readonly removeConfirmOpen = signal(false);
  readonly discardConfirmOpen = signal(false);
  readonly finishConfirmOpen = signal(false);
  readonly discarding = signal(false);
  readonly finishing = signal(false);
  /** The discard sheet was opened by Finish with nothing ticked. */
  readonly discardFromFinish = signal(false);
  /** Asked on the way out: keep the clock running, or pause it. */
  readonly leaveOpen = signal(false);

  /**
   * Finish and discard both navigate once confirmed, so those two sheets are
   * dismissed through their own `close()` rather than by flipping `open` —
   * routing away in the same turn would otherwise leave the sheet presented
   * over the page it just opened. Named refs: the logger owns three confirm
   * sheets, so a bare `viewChild(ConfirmSheet)` would pick the wrong one.
   */
  private readonly _discardSheet = viewChild<ConfirmSheet>('discardSheet');
  /** Read when focus jumps to another cell, so what was typed is kept. */
  private readonly _keypad = viewChild(NumericKeypad);
  private readonly _finishSheet = viewChild<ConfirmSheet>('finishSheet');

  /** Per-exercise "last time" sets, keyed by exercise id. */
  private readonly _previous = signal<Record<string, LoggedSet[]>>({});

  /** Every exercise and set as the list draws them, in direction C's three looks. */
  readonly views = computed<ExerciseView[]>(() => {
    const focus = this.focus();
    const editing = this.editing();
    const previous = this._previous();
    const unfolded = this._unfolded();
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
          focus: isFocus,
          editing: isEditing ? (editing?.field ?? null) : null,
          effortTarget: effortTarget(set),
        };
      });

      return {
        exercise,
        folded: isExerciseDone(exercise) && !unfolded.has(exercise.id) && !editingHere,
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
   * rounds. Finished rounds and rounds still ahead read as one line; the
   * round on now (or one being edited) shows its sets.
   */
  readonly blocks = computed<BlockView[]>(() => {
    const views = this.views();
    const exercises = this.store.exercises();
    const effortFor = this.effortFor();
    const unfolded = this._unfolded();
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
        const busy = rows.some(
          (r) => r.row.focus || r.row.editing !== null || r.row.set.id === effortFor,
        );
        const untouched = rows.every((r) => !r.row.set.isCompleted);
        const summary =
          !busy && (done || untouched)
            ? rows
                .map(
                  (r) =>
                    `${r.tag} ${
                      setLine(
                        r.view.fields,
                        (field) => cellValue(r.row.set, field) ?? r.row.prefill[field] ?? null,
                        false,
                      ) || '–'
                    }`,
                )
                .join(' · ')
            : null;
        if (rows.length) rounds.push({ index, done, summary, rows });
      }
      const firstOpen = rounds.findIndex((r) => !r.done);
      const key = block.exercises[0].id;
      const allDone = live.length > 0 && live.every((m) => isExerciseDone(m.view.exercise));
      const editingHere = members.some((m) => m.view.exercise.id === editing?.exerciseId);
      const lastLive = live[live.length - 1]?.view.exercise;
      const round = firstOpen < 0 ? Math.max(0, total - 1) : rounds[firstOpen].index;
      const restSet = lastLive?.sets?.[round] ?? null;
      const rest = restSet
        ? restAfterTick(restSet, restSet, {
            exerciseOverride: lastLive ? (this._restByExercise()[lastLive.id] ?? null) : null,
            workoutDefault: this._restForAll(),
            personDefault: this._settings().defaultRestSeconds,
          })
        : null;
      return {
        kind: 'superset',
        key,
        members,
        rounds,
        current: round + 1,
        total,
        folded: allDone && !unfolded.has(key) && !editingHere,
        names: members.map((m) => m.view.exercise.exerciseNameSnapshot).join(' + '),
        restLine:
          rest !== null
            ? this._translateService.instant('workouts.superset.restAfterRound', {
                value: secondsToClock(rest),
              })
            : '',
      };
    });
  });

  /** "Back to Bench press · Set 3", on the pill shown once the focus scrolls away. */
  readonly backToLabel = computed(() => {
    const focus = this.focus();
    if (!focus) return '';
    const view = this.views().find((v) => v.exercise.id === focus.exerciseId);
    const row = view?.rows.find((r) => r.set.id === focus.setId);
    if (!view || !row) return '';
    return this._translateService.instant('workouts.logger.backTo', {
      value: `${view.exercise.exerciseNameSnapshot} · ${row.badge.short ?? row.badge.name}`,
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

  readonly progressRatio = computed(() => {
    const { done, total } = this.store.progress();
    return total > 0 ? done / total : 0;
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

  readonly discardBody = computed(() =>
    this._translateService.instant(
      this.discardFromFinish()
        ? 'workouts.logger.discard.nothingTicked'
        : 'workouts.logger.discard.message',
    ),
  );

  readonly finishBody = computed(() => {
    const { done, total } = this.store.progress();
    return this._translateService.instant('workouts.logger.finishConfirm.message', {
      count: total - done,
    });
  });

  /**
   * The set to do after this rest: the focus, which a tick has already moved
   * on. Null once everything is ticked.
   */
  readonly nextUp = computed(() => {
    const focus = this.focus();
    const view = focus ? this.views().find((v) => v.exercise.id === focus.exerciseId) : null;
    const row = view?.rows.find((r) => r.set.id === focus?.setId);
    if (!view || !row) return null;
    const sets = view.exercise.sets ?? [];
    const isLast = sets.filter((s) => !s.isCompleted).length === 1;
    const line = setLine(
      view.fields,
      (field) => cellValue(row.set, field) ?? row.prefill[field] ?? null,
      true,
    );
    return {
      title: [row.badge.short ?? row.badge.name, line].filter(Boolean).join(' · '),
      detail: [
        view.exercise.exerciseNameSnapshot,
        isLast ? this._translateService.instant('workouts.restTimer.lastSet') : '',
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });

  readonly showKeypad = computed(() => this.editing() !== null);
  readonly showRest = computed(() => !this.showKeypad() && this.restEndsAt() !== null);

  constructor() {
    addIcons(WORKOUT_ICONS);

    // One place to mirror the countdown to the OS. Every path that starts,
    // extends, skips or abandons rest already routes through `restEndsAt`,
    // so the alert follows it without a call at each of those sites. The
    // service only reaches the OS once the app is backgrounded.
    effect(() => this._restAlertService.track(this.restEndsAt(), this.nextLine()));

    // The screen stays on while the workout is in front, if the person wants.
    effect(() => {
      const keep = this._onScreen() && !!this.store.log() && this._settings().keepScreenOn;
      untracked(() => void (keep ? this._screenAwake.hold() : this._screenAwake.release()));
    });

    // The workout and its rest, for the mini-bar and for after a restart:
    // the clock and the rest live on as timestamps when this page goes.
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
      const next = this.nextLine();
      const steps = this.liveSteps();
      untracked(() => this._activeSession.setNext(next, steps));
    });

    // Follow the focus: whenever it moves (a tick, the list loading), bring
    // it to a third of the way down, unless the person scrolled away.
    effect(() => {
      const id = this.focus()?.setId ?? null;
      if (id === this._lastFocusId) return;
      this._lastFocusId = id;
      if (id && !untracked(this.userScrolled)) this._scrollToFocusSoon();
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

    if (id === 'new') this._startFreestyle();
    else
      this.store.load(
        id,
        () => {
          // Back at the workout is back to work: a paused clock starts again.
          this.store.resumeClock();
          this._loadLastTimes();
          this._adoptRest();
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

  ionViewWillLeave(): void {
    this._onScreen.set(false);
    // The rest carries on in the mini-bar; only what was being typed closes.
    this._keepTyped();
    this.editing.set(null);
    this.dismissEffort();
    // Back on the page, the list finds the focus again.
    this._lastFocusId = null;
    this.userScrolled.set(false);
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
    const values: LiveValues = {};
    for (const field of view.fields) {
      const value = shownValue(row, field);
      if (value !== null) {
        values[PAYLOAD_KEY[field]] = value;
      }
    }
    const after = nextAfter(exercises, ref, rounds, passed);
    let afterSet: LoggedSet | null = null;
    let inRound = false;
    if (after) {
      afterSet = after.set;
      inRound = sameRound(exercises, ref, { exerciseId: after.exercise.id, setId: after.set.id }, rounds);
    }
    const rest = restAfterTick(row.set, afterSet, {
      sameRound: inRound,
      exerciseOverride: this._restByExercise()[ref.exerciseId] ?? null,
      workoutDefault: this._restForAll(),
      personDefault: this._settings().defaultRestSeconds,
    });
    const name = view.exercise.exerciseNameSnapshot;
    const setName = row.badge.short ?? row.badge.name;
    const target = setLine(view.fields, (field) => shownValue(row, field), true);
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
      short: setLine(view.fields, (field) => shownValue(row, field), false),
      rest,
      line: [setName, target, name].filter(Boolean).join(' · '),
      final: after === null,
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
          setLine(member.view.fields, (field) => shownValue(member.row, field), false),
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

    const rounds = this._rounds();
    const here = { exerciseId: exercise.id, setId: fresh.id };
    const next = nextAfter(this.store.exercises(), here, rounds, this._activeSession.passed());
    const rest = restAfterTick(fresh, next?.set ?? null, {
      sameRound:
        !!next &&
        sameRound(this.store.exercises(), here, { exerciseId: next.exercise.id, setId: next.set.id }, rounds),
      exerciseOverride: this._restByExercise()[exercise.id] ?? null,
      workoutDefault: this._restForAll(),
      personDefault: this._settings().defaultRestSeconds,
    });
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
    // A tick brings the list back to the focus, wherever it was scrolled.
    this.userScrolled.set(false);
  }

  /** The set's line was tapped: open it to edit in place, from its first field. */
  openSet(exercise: LoggedExercise, set: LoggedSet): void {
    const field = this._fieldsFor(exercise)[0];
    if (field) this.editCell(exercise, set, field);
  }

  editCell(exercise: LoggedExercise, set: LoggedSet, field: SetField): void {
    // Tapping another cell is a Done for this one: what was typed stays.
    this._keepTyped();
    this.dismissEffort();
    const fresh = this._findSet(exercise.id, set.id) ?? set;
    this.editing.set({ exerciseId: exercise.id, setId: fresh.id, field });
    this.typed.set('');
    // Seeded with the value, else its pre-fill: the steppers work from what
    // the field shows, and the first digit typed replaces it.
    const row = this.views()
      .find((v) => v.exercise.id === exercise.id)
      ?.rows.find((r) => r.set.id === fresh.id);
    const current = cellValue(fresh, field) ?? row?.prefill[field] ?? null;
    this.draft.set(current == null ? '' : String(current));
    this._revealEditingSoon();
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

  onSetRemove(): void {
    const target = this.menuSet();
    const exercise = target
      ? this.store.exercises().find((e) => e.id === target.exerciseId)
      : null;
    if (target && exercise) this.removeSet(exercise, target.set);
  }

  // ─── Scroll and focus ─────────────────────────────────────────

  /** The person scrolled: does the focus set still show? */
  async onScroll(): Promise<void> {
    if (Date.now() - this._programmaticScrollAt < PROGRAMMATIC_SCROLL_MS) return;
    const row = this._row('[data-focus]');
    const content = this._content();
    if (!row || !content) return;
    const box = this._visibleBox(await content.getScrollElement());
    const rect = row.getBoundingClientRect();
    const away = rect.bottom < box.top + 20 || rect.top > box.bottom - 20;
    if (away !== this.userScrolled()) this.userScrolled.set(away);
  }

  backToFocus(): void {
    this.userScrolled.set(false);
    void this._scrollToFocus();
  }

  /** After the list has drawn the new focus. */
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
    this._programmaticScrollAt = Date.now();
    await content.scrollToPoint(
      0,
      Math.max(0, scroller.scrollTop + delta),
      prefersReducedMotion() ? 0 : FOCUS_SCROLL_MS,
    );
  }

  /** Once the pad is up: keep the set being typed into just above it. */
  private _revealEditingSoon(): void {
    setTimeout(() => void this._revealEditing(), 120);
  }

  private async _revealEditing(): Promise<void> {
    const row = this._row('[data-editing]');
    const content = this._content();
    if (!row || !content) return;
    const box = this._visibleBox(await content.getScrollElement());
    const rect = row.getBoundingClientRect();
    let delta = 0;
    if (rect.bottom > box.bottom - 16) delta = rect.bottom - (box.bottom - 16);
    else if (rect.top < box.top + 8) delta = rect.top - (box.top + 8);
    if (delta === 0) return;
    this._programmaticScrollAt = Date.now();
    await content.scrollByPoint(0, delta, prefersReducedMotion() ? 0 : 200);
  }

  /**
   * The part of the list a person can actually see: the content runs behind
   * the header and the docked pad or rest bar, so both are taken off.
   */
  private _visibleBox(scroller: HTMLElement): { top: number; bottom: number } {
    const box = scroller.getBoundingClientRect();
    const host = this._host.nativeElement;
    const header = host.querySelector('ion-header')?.getBoundingClientRect();
    const footer = host.querySelector('ion-footer')?.getBoundingClientRect();
    return {
      top: Math.max(box.top, header?.bottom ?? box.top),
      bottom: footer && footer.height > 0 ? Math.min(box.bottom, footer.top) : box.bottom,
    };
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
    return this._translateService.instant(
      field === SetFields.Reps && this.isUnilateral(exercise)
        ? 'workouts.logger.columns.repsEach'
        : COLUMN_LABELS[field],
    );
  }

  // ─── Folding ──────────────────────────────────────────────────

  /** A finished exercise folds to its check row unless it was opened again. */
  isFolded(exercise: LoggedExercise): boolean {
    return isExerciseDone(exercise) && !this._unfolded().has(exercise.id);
  }

  unfold(exercise: LoggedExercise): void {
    this._unfolded.update((set) => new Set(set).add(exercise.id));
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

  /** A summary line was tapped: open its first set to edit in place. */
  openRound(round: RoundView): void {
    const first = round.rows[0];
    if (first) this.openSet(first.view.exercise, first.row.set);
  }

  removeSet(exercise: LoggedExercise, set: LoggedSet): void {
    this._forgetSets([set.id]);
    this.store.removeSet(exercise.id, set.id, () => {
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.logger.toast.removeSetFailed'),
      );
    });
  }

  /** Swipe left, then Delete: the row closes and the set goes. */
  swipeDelete(sliding: IonItemSliding, exercise: LoggedExercise, set: LoggedSet): void {
    void sliding.close();
    this.removeSet(exercise, set);
  }

  /** A round's label was tapped: what can be done with the whole round. */
  openRoundMenu(round: RoundView): void {
    this._keepTyped();
    this.editing.set(null);
    this.dismissEffort();
    this.roundMenu.set(round);
    this.roundMenuOpen.set(true);
  }

  onRoundAction(id: RoundActionId): void {
    const round = this.roundMenu();
    if (id === RoundActionIds.Delete && round) {
      this.deleteRound(round);
    }
  }

  /** Every set of the round, of every exercise in it, in one go. */
  deleteRound(round: RoundView): void {
    const sets = round.rows.map((item) => ({ exerciseId: item.view.exercise.id, setId: item.row.set.id }));
    this._forgetSets(sets.map((entry) => entry.setId));
    this.store.removeSets(sets, () => {
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.logger.toast.removeRoundFailed'),
      );
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
    this.restSheetScope.set(RestScopes.Exercise);
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

  onOption(id: LoggerOptionId): void {
    switch (id) {
      case LoggerOptionIds.RestForAll:
        this.restSheetScope.set(RestScopes.Workout);
        this.restSheetOpen.set(true);
        return;
      case LoggerOptionIds.Pause:
        this.onLeaveChoice(LeaveChoices.Pause);
        return;
      case LoggerOptionIds.Discard:
        this.openDiscard();
        return;
    }
  }

  /** The new rest for this exercise or for all, and the running one with it. */
  applyRest(change: RestChange): void {
    const rest = this._rest();
    if (change.scope === RestScopes.Exercise && rest) {
      this._restByExercise.update((map) => ({ ...map, [rest.exerciseId]: change.seconds }));
    } else {
      this._restForAll.set(change.seconds);
    }
    // From the timer, the running rest takes the new length too. From the ⋯
    // ("every exercise"), the rest running now keeps what its plan said.
    const fromTimer = this.restSheetScope() === RestScopes.Exercise;
    const start = this.restStartedAt();
    if (fromTimer && start !== null && this.restEndsAt() !== null) {
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
   * because the alternative reading is "I tapped the wrong thing". With
   * nothing ticked at all there is nothing to record, so the way out
   * offered is discard.
   */
  finish(): void {
    if (!this.store.log() || this.finishing()) return;
    // A tap on Finish while typing is a Done for that cell, as everywhere.
    this._keepTyped();
    this.editing.set(null);

    const { done, total } = this.store.progress();
    if (done === 0) {
      this.openDiscard(true);
      return;
    }
    if (done < total) {
      this.finishConfirmOpen.set(true);
      return;
    }
    this._complete();
  }

  confirmFinish(): void {
    this._complete(() => this._finishSheet()?.close());
  }

  /** `fromFinish`: Finish found nothing ticked, so the sheet says why it is here. */
  openDiscard(fromFinish = false): void {
    this.discardFromFinish.set(fromFinish);
    this.discardConfirmOpen.set(true);
  }

  /**
   * Completes the workout here, so the summary opens on a finished one: its
   * duration and records are only set by completing. Waits for set writes
   * still on their way first, or the last tick before Finish is refused.
   */
  private _complete(closeSheet?: () => Promise<void> | undefined): void {
    const log = this.store.log();
    if (!log || this.finishing()) return;
    this.finishing.set(true);
    this.restEndsAt.set(null);

    this.store.whenSettled(() =>
      this._workoutLogService
        .complete(log.id)
        .pipe(take(1))
        .subscribe({
          next: async () => {
            this.finishing.set(false);
            await closeSheet?.();
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

  private _startFreestyle(): void {
    // `from` is a Repeat off the history list: same movements, new session.
    const from = this._route.snapshot.queryParamMap.get('from');
    const name = this._translateService.instant('workouts.logger.defaultName', {
      date: new Date().toLocaleDateString(appLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }),
    });

    // `new` means "start one", so with one already open this route becomes
    // that one — replaced, so back does not land on `new` and try again.
    this._activeWorkoutService.startOrResume(
      () =>
        this._workoutLogService
          .start({ name })
          .pipe(take(1))
          .subscribe({
            next: (log) => {
              this.store.adopt(log);
              this._restAdopted = true;
              // Replace, so a back-swipe does not start a second empty workout.
              void this._router.navigate(['/tabs/workouts/log', log.id], {
                replaceUrl: true,
              });
              if (from) this._carryOver(from);
            },
            error: (err) =>
              void this._feedbackService.error(
                err,
                this._translateService.instant('workouts.common.startFailed'),
              ),
          }),
      {
        onBlocked: (open) =>
          this.store.load(
            open.id,
            () => {
              this._loadLastTimes();
              this._adoptRest();
            },
            (log) => this._toSummaryIfClosed(log),
          ),
        replaceUrl: true,
      },
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
          this.store.addExercises(ids);
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
