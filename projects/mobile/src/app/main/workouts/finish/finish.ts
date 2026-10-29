import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
  ViewWillLeave,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import {
  AuthStore,
  LoggedExercise,
  PersonalRecord,
  ProfilePrivacy,
  ProfilePrivacyLabels,
  WorkoutLog,
  WorkoutLogService,
  WorkoutLogStatus,
  appLocale,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { ChoiceOption, ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import {
  WORKOUT_VISIBILITY_LEVELS,
  workoutVisibilityHint,
} from '../../../_shared/config/workout-visibility.config';
import { HEX_PATH, HEX_VIEW_BOX } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ThemeService } from '../../../_shared/services/theme.service';
import { FeelingScale } from '../_components/feeling-scale/feeling-scale';
import { SaveRoutineService } from '../_services/save-routine.service';
import { WorkoutPhotoStore, preparePhoto } from '../_services/workout-photo';
import { ShareWorkoutSheet } from '../_sheets/share-workout-sheet/share-workout-sheet';
import {
  NOTE_MAX_LENGTH,
  WORKOUT_ICONS,
  cheerKey,
  durationClock,
  exerciseSetSummary,
  formatMeasure,
  volumeGainPercent,
  workoutTiles,
  workoutVolume,
} from '../workouts.config';

type PhotoAction = 'change' | 'remove';

/** One glyph per level, the same ones the level names suggest. */
const VISIBILITY_ICONS: Record<ProfilePrivacy, string> = {
  [ProfilePrivacy.OnlyMe]: 'lock-closed-outline',
  [ProfilePrivacy.CoachesOnly]: 'people-outline',
  [ProfilePrivacy.Public]: 'globe-outline',
};

/** A streak shorter than this is just training, not yet a streak. */
const STREAK_WORTH_SAYING = 2;
/** The highlights row holds two; past that it stops being a highlight. */
const MAX_HIGHLIGHTS = 2;

interface HeroStat {
  label: string;
  value: string;
}

interface Highlight {
  glyph: string;
  title: string;
  detail: string;
  /** Honey for a record, the one thing worth a colour. */
  honey: boolean;
}

/**
 * Finish and summary: a reward first, a form second.
 *
 * The hero says what was done, in the numbers the session actually holds
 * (volume only where something was loaded, reps for bodyweight, time for
 * holds; never one composite). Highlights appear only when they are true:
 * a record beaten, a streak of weeks, more volume than the last time this
 * routine was done. Never praise that did not happen.
 *
 * The logger completes the workout before opening this, with
 * `?from=logger`; the rating and note then arrive on a second complete
 * call, which the API applies to a finished workout. Without the flag this
 * is the read-only view of a past workout, reached from History.
 */
@Component({
  selector: 'mh-workout-finish',
  imports: [
    ActionSheet,
    ChoiceSheet,
    EmptyState,
    FeelingScale,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    SettingsRow,
    ShareWorkoutSheet,
    TranslatePipe,
  ],
  templateUrl: './finish.html',
  styleUrl: './finish.scss',
})
export class Finish implements ViewWillEnter, ViewWillLeave {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _themeService = inject(ThemeService);
  private readonly _authStore = inject(AuthStore);
  private readonly _saveRoutineService = inject(SaveRoutineService);

  readonly hexPath = HEX_PATH;
  readonly hexViewBox = HEX_VIEW_BOX;
  /** The four small hexes thrown around the tick; each has its own place and colour. */
  readonly sparks = [1, 2, 3, 4];
  readonly skeletonStats = [1, 2, 3];

  readonly log = signal<WorkoutLog | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);

  readonly feeling = signal<number | null>(null);
  readonly note = signal('');
  readonly noteMaxLength = NOTE_MAX_LENGTH;
  /** Sharing is its own deliberate step, never part of saving. */
  readonly shareOpen = signal(false);
  readonly visibilityOpen = signal(false);
  readonly savingVisibility = signal(false);

  /** The workout's photo as an object URL; the bytes only come through the API. */
  readonly photoUrl = signal<string | null>(null);
  readonly uploadingPhoto = signal(false);
  readonly photoActionsOpen = signal(false);
  readonly photoActions: readonly SheetAction<PhotoAction>[] = [
    { id: 'change', label: 'workouts.photo.change', icon: 'image-outline' },
    { id: 'remove', label: 'workouts.photo.remove', icon: 'trash-outline', destructive: true },
  ];
  private readonly _photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');
  private readonly _photoStore = inject(WorkoutPhotoStore);

  readonly visibility = computed(() => this.log()?.visibility ?? ProfilePrivacy.OnlyMe);
  /** The coach whose plan this was; they see it at any level. */
  private readonly _planCoach = computed(() => this.log()?.summary?.coachName ?? null);

  /** "You and Bogdan" on a coach's plan, where "Only me" would not be true. */
  readonly visibilityLabel = computed(() => {
    const coach = this._planCoach();
    return this.visibility() === ProfilePrivacy.OnlyMe && coach
      ? this._translateService.instant('workoutVisibility.youAndCoach', { name: coach })
      : ProfilePrivacyLabels[this.visibility()];
  });

  readonly visibilityIcon = computed(() => VISIBILITY_ICONS[this.visibility()]);

  /** Taken down after a report: it stays off the profile and out of groups. */
  readonly takenDown = computed(() => !!this.log()?.takenDownAt);

  readonly visibilityOptions = computed<ChoiceOption[]>(() =>
    WORKOUT_VISIBILITY_LEVELS.filter(
      (level) => !(this.takenDown() && level === ProfilePrivacy.Public),
    ).map((level) => ({
      value: level,
      label:
        level === ProfilePrivacy.OnlyMe && this._planCoach()
          ? this._translateService.instant('workoutVisibility.youAndCoach', {
              name: this._planCoach(),
            })
          : ProfilePrivacyLabels[level],
      hint: this._translateService.instant(workoutVisibilityHint(level)),
    })),
  );

  readonly visibilityNote = computed(() => {
    if (this.takenDown()) return this._translateService.instant('workoutVisibility.takenDown');
    const coach = this._planCoach();
    return coach
      ? this._translateService.instant('workoutVisibility.planCoachNote', { name: coach })
      : '';
  });

  /** Opened by the logger the moment the workout finished. */
  private readonly _justFinished = signal(false);

  readonly showSkeleton = computed(() => this.loading() && !this.log());
  readonly showError = computed(() => this.error() && !this.log());

  /** A look back from History: the feedback shows as given, not as a form. */
  readonly isReview = computed(() => !this._justFinished());

  /** Only close to the limit: a counter from the first letter is noise. */
  readonly showNoteCounter = computed(() => this.note().length > NOTE_MAX_LENGTH - 200);

  /** "Thu, 22 Oct · 18:47": when it finished, in the reader's calendar. */
  readonly whenLabel = computed(() => {
    const at = this.log()?.completedAt;
    if (!at) return '';
    const date = new Date(at);
    const locale = appLocale();
    return [
      date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
      date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    ].join(' · ');
  });

  /**
   * Straight after finishing, a cheer with the person's name; looking back,
   * the workout's own name, since praise for an old session rings false.
   */
  readonly heroTitle = computed(() => {
    const log = this.log();
    if (!log) return '';
    if (this.isReview()) return log.name;
    const name = this._authStore.user()?.firstName?.trim();
    return name
      ? this._translateService.instant(cheerKey(log.id), { name })
      : this._translateService.instant('workouts.finish.cheerNoName');
  });

  /** "Leg day · your 12th workout", each part only when there is one. */
  readonly heroSubtitle = computed(() => {
    const log = this.log();
    if (!log) return '';
    const parts: string[] = [];
    if (!this.isReview()) parts.push(log.name);
    const number = log.summary?.workoutNumber;
    if (number) {
      parts.push(
        this._translateService.instant('workouts.finish.workoutNumber', { count: number }),
      );
    }
    return parts.join(' · ');
  });

  /** Duration, sets, then the session's own measure: three at most. */
  readonly heroStats = computed<HeroStat[]>(() => {
    const log = this.log();
    if (!log) return [];
    return [
      {
        label: this._translateService.instant('workouts.tiles.duration'),
        value: durationClock(log.durationSeconds),
      },
      ...workoutTiles(log).slice(0, 2),
    ];
  });

  readonly highlights = computed<Highlight[]>(() => {
    const log = this.log();
    if (!log) return [];
    const list: Highlight[] = [];

    const records = log.personalRecords ?? [];
    if (records.length > 0) {
      list.push({
        glyph: '🏆',
        title: this._translateService.instant('workouts.finish.highlights.record', {
          count: records.length,
        }),
        detail: this._recordLine(records[0]),
        honey: true,
      });
    }

    // Today's streak says nothing about an old workout.
    const weeks = log.summary?.streakWeeks ?? 0;
    if (!this.isReview() && weeks >= STREAK_WORTH_SAYING) {
      list.push({
        glyph: '🔥',
        title: this._translateService.instant('workouts.finish.highlights.streak', {
          count: weeks,
        }),
        detail: this._translateService.instant('workouts.finish.highlights.streakDetail'),
        honey: false,
      });
    }

    // A record already says it was a good day; this is for the days without one.
    const gain = volumeGainPercent(workoutVolume(log), log.summary?.previousVolumeKg ?? null);
    if (records.length === 0 && gain !== null) {
      list.push({
        glyph: '📈',
        title: this._translateService.instant('workouts.finish.highlights.volume', {
          percent: gain,
        }),
        detail: this._translateService.instant('workouts.finish.highlights.volumeDetail'),
        honey: false,
      });
    }

    return list.slice(0, MAX_HIGHLIGHTS);
  });

  /** A freestyle session is the one that can become a routine. */
  readonly canSaveAsRoutine = computed(() => {
    const log = this.log();
    return !!log && !log.assignedWorkoutId && !log.sourceProgramId;
  });

  /** Saved as a routine this session, by its name; the offer is not made twice. */
  readonly savedRoutineName = computed(() => {
    const log = this.log();
    return log ? this._saveRoutineService.savedName(log.id) : null;
  });

  readonly exercises = computed<LoggedExercise[]>(() => this.log()?.exercises ?? []);

  constructor() {
    addIcons(WORKOUT_ICONS);
  }

  ionViewWillEnter(): void {
    this._themeService.setDarkTop(true);
    this.load();
  }

  ionViewWillLeave(): void {
    this._themeService.setDarkTop(false);
  }

  load(): void {
    const snapshot = this._route.snapshot;
    const id = snapshot.paramMap.get('id');
    if (!id) {
      void this._router.navigate(['/tabs/workouts'], { replaceUrl: true });
      return;
    }
    const firstLook = !this.log() && snapshot.queryParamMap.get('from') === 'logger';
    this._justFinished.set(snapshot.queryParamMap.get('from') === 'logger');

    this.loading.set(true);
    this.error.set(false);
    this._workoutLogService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (log) => {
          // Still running: a summary of it would be wrong in every number.
          if (log.status === WorkoutLogStatus.InProgress) {
            this.loading.set(false);
            void this._router.navigate(['/tabs/workouts/log', log.id], { replaceUrl: true });
            return;
          }
          this.log.set(log);
          this.feeling.set(log.feelingRating);
          this.note.set(log.notes ?? '');
          this.loading.set(false);
          if (firstLook) void this._celebrate();
          this._loadPhoto(log);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  setSummary(exercise: LoggedExercise): string {
    return exerciseSetSummary(exercise);
  }

  /**
   * Save, and the close button too: what was picked or typed is kept either
   * way, since the workout itself is already saved and walking away should
   * not cost the note.
   */
  done(): void {
    const log = this.log();
    if (!log || this.saving()) return;
    if (!this._hasNewFeedback(log)) {
      this._leave(log);
      return;
    }

    this.saving.set(true);
    this._workoutLogService
      .complete(log.id, {
        feelingRating: this.feeling() ?? undefined,
        notes: this.note().trim() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this._leave(log);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.finish.toast.saveFailed'),
          );
        },
      });
  }

  pickPhoto(): void {
    this._photoInput()?.nativeElement.click();
  }

  /**
   * Re-encoded on the phone first (no location leaves it), then sent; the
   * hero shows the local copy at once rather than fetching it back.
   */
  async onPhotoPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same photo can be picked again after a failure
    const log = this.log();
    if (!file || !log || this.uploadingPhoto()) return;

    this.uploadingPhoto.set(true);
    let jpeg: Blob;
    try {
      jpeg = await preparePhoto(file);
    } catch {
      this.uploadingPhoto.set(false);
      void this._feedbackService.error(
        null,
        this._translateService.instant('workouts.photo.toast.unreadable'),
      );
      return;
    }
    this._photoStore
      .upload(log.id, jpeg)
      .pipe(take(1))
      .subscribe({
        next: ({ url, version }) => {
          this.uploadingPhoto.set(false);
          this.photoUrl.set(url);
          this.log.update((current) =>
            current ? { ...current, hasPhoto: true, photoVersion: version } : current,
          );
        },
        error: (err) => {
          this.uploadingPhoto.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.photo.toast.uploadFailed'),
          );
        },
      });
  }

  onPhotoAction(action: PhotoAction): void {
    if (action === 'change') {
      this.pickPhoto();
      return;
    }
    const log = this.log();
    if (!log) return;
    this._photoStore
      .remove(log.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.photoUrl.set(null);
          this.log.update((current) =>
            current ? { ...current, hasPhoto: false, photoVersion: null } : current,
          );
        },
        error: (err) =>
          void this._feedbackService.error(
            err,
            this._translateService.instant('workouts.photo.toast.removeFailed'),
          ),
      });
  }

  /** Quietly without one: a photo that will not load is not worth an error. */
  private _loadPhoto(log: WorkoutLog): void {
    if (!log.hasPhoto) {
      this.photoUrl.set(null);
      return;
    }
    this._photoStore
      .url(log.id, log.photoVersion ?? null)
      .pipe(take(1))
      .subscribe({ next: (url) => this.photoUrl.set(url), error: () => this.photoUrl.set(null) });
  }

  /** Saves at once, and puts the old level back if the server refuses. */
  onVisibilityPicked(value: string): void {
    const log = this.log();
    const level = WORKOUT_VISIBILITY_LEVELS.find((candidate) => candidate === value);
    if (!log || !level || level === this.visibility() || this.savingVisibility()) return;

    const previous = this.visibility();
    this.log.set({ ...log, visibility: level });
    this.savingVisibility.set(true);
    this._workoutLogService
      .setVisibility(log.id, level)
      .pipe(take(1))
      .subscribe({
        next: () => this.savingVisibility.set(false),
        error: (err) => {
          this.savingVisibility.set(false);
          this.log.update((current) => (current ? { ...current, visibility: previous } : current));
          void this._feedbackService.error(
            err,
            this._translateService.instant('workoutVisibility.saveFailed'),
          );
        },
      });
  }

  /** The message is kept with the workout; sharing again starts from it. */
  onCaptionSaved(caption: string | null): void {
    this.log.update((log) => (log ? { ...log, shareCaption: caption } : log));
  }

  openSaveRoutine(): void {
    const log = this.log();
    if (log)
      this._saveRoutineService.open({ logId: log.id, suggestedName: this._suggestName(log) });
  }

  private _hasNewFeedback(log: WorkoutLog): boolean {
    return this.feeling() !== log.feelingRating || this.note().trim() !== (log.notes ?? '');
  }

  /**
   * Back to the Workouts tab. A freestyle session's toast offers to keep it
   * as a routine; the same offer stays on the workout in History.
   */
  private _leave(log: WorkoutLog): void {
    const offer =
      this.canSaveAsRoutine() && !this.savedRoutineName()
        ? {
            label: this._translateService.instant('workouts.finish.saveAsRoutine.action'),
            run: () =>
              this._saveRoutineService.open({
                logId: log.id,
                suggestedName: this._suggestName(log),
              }),
          }
        : undefined;
    void this._router.navigate(['/tabs/workouts']);
    void this._feedbackService.success(
      this._translateService.instant('workouts.finish.toast.saved'),
      offer,
    );
  }

  /** "Back squat 100 kg × 5": the set that earned it, else what it added. */
  private _recordLine(record: PersonalRecord): string {
    if (record.setWeightKg != null && record.setReps != null) {
      return this._translateService.instant('workouts.finish.highlights.recordSet', {
        name: record.exerciseName,
        weight: formatMeasure(record.setWeightKg),
        reps: record.setReps,
      });
    }
    return this._translateService.instant('workouts.finish.highlights.recordGain', {
      name: record.exerciseName,
      delta: formatMeasure(record.deltaKg),
    });
  }

  /** One buzz as the summary lands, the moment the work is done. */
  private async _celebrate(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // No haptics on this device or platform.
    }
  }

  /** "Bench press day" — the first exercise is what people call a session. */
  private _suggestName(log: WorkoutLog): string {
    const first = log.exercises?.[0]?.exerciseNameSnapshot;
    return first
      ? this._translateService.instant('workouts.finish.suggestedName', { name: first })
      : log.name;
  }
}
