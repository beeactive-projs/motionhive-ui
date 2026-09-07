import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  AppModeStore,
  AuthStore,
  Exercise,
  ExerciseMedia,
  ExerciseMediaKind,
  ExerciseOwnershipFilter,
  ExerciseService,
  ExerciseVisibility,
  YoutubeEmbed,
  displayName,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  EXERCISE_ICONS,
  ExerciseChipRow,
  attributionLine,
  exerciseDetailRows,
  instructionSteps,
  kindIcon,
  kindLabel,
  kindTone,
  muscleEquipmentRows,
} from '../exercises.config';

/** How long each frame of a two-frame demo holds before the other takes over. */
const FRAME_MS = 1400;

/**
 * One exercise, in full.
 *
 * The catalogue's seeded rows carry two photographs — the start and end of
 * the movement — so the hero alternates them rather than showing a still.
 * Two JPEGs already on the CDN give the same "this is a motion" read a video
 * would, at none of the cost. A custom exercise usually has a YouTube link
 * instead, which takes the hero as a click-to-play facade; one with neither
 * falls back to the kind tile, never to an empty frame.
 *
 * What you can do here depends on whose exercise it is. Your own gets Edit
 * (delete lives inside it, where the consequences are visible). Someone
 * else's public exercise — including the system catalogue's — gets Fork,
 * which copies it into your library so you can change it without touching
 * theirs. A trainee gets neither: they are here to look, and the API would
 * refuse them anyway.
 */
@Component({
  selector: 'mh-exercise-detail',
  imports: [
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    YoutubeEmbed,
  ],
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
})
export class ExerciseDetail implements ViewWillEnter {
  private readonly _exerciseService = inject(ExerciseService);
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  /** The row being shown, read off the route rather than passed in. */
  readonly exerciseId = signal('');

  readonly exercise = signal<Exercise | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly forkOpen = signal(false);
  readonly forking = signal(false);

  /**
   * Both fork outcomes navigate, so the sheet is dismissed through its own
   * `close()` rather than by flipping `open` — routing away in the same turn
   * would otherwise leave it presented over the exercise it just opened.
   */
  private readonly _forkSheet = viewChild(ConfirmSheet);

  readonly frameIndex = signal(0);

  readonly backHref = '/tabs/exercises';

  /** Kind + level + a couple of traits: the card's usual height, blank. */
  readonly skeletonRows = [1, 2, 3, 4];

  // ── What it is ────────────────────────────────────────────────────────────

  readonly name = computed(() => this.exercise()?.name ?? 'Exercise');

  readonly kindLabel = computed(() => {
    const exercise = this.exercise();
    return exercise ? kindLabel(exercise.kind) : '';
  });

  readonly kindTone = computed(() => {
    const exercise = this.exercise();
    return exercise ? kindTone(exercise.kind) : 'medium';
  });

  readonly kindIcon = computed(() => {
    const exercise = this.exercise();
    return exercise ? kindIcon(exercise.kind) : 'barbell-outline';
  });

  readonly isMine = computed(() => {
    const exercise = this.exercise();
    const me = this._authStore.user();
    return !!exercise && !!me && exercise.ownerId === me.id;
  });

  /** Kind & level, classification, visibility — a category per row, chips under it. */
  readonly detailRows = computed<ExerciseChipRow[]>(() => {
    const exercise = this.exercise();
    return exercise ? exerciseDetailRows(exercise, this.isMine()) : [];
  });

  /** The create form's second step read back: a row per role, then equipment. */
  readonly muscleEquipmentRows = computed<ExerciseChipRow[]>(() => {
    const exercise = this.exercise();
    return exercise ? muscleEquipmentRows(exercise) : [];
  });

  readonly forkedFromName = computed(() => this.exercise()?.forkedFrom?.name ?? null);

  readonly steps = computed(() => instructionSteps(this.exercise()?.instructions ?? null));

  readonly description = computed(() => this.exercise()?.description?.trim() || null);

  readonly ownerName = computed(() => {
    const owner = this.exercise()?.owner;
    return owner ? displayName(owner) : null;
  });

  readonly attribution = computed(() => {
    const exercise = this.exercise();
    return exercise ? attributionLine(exercise, this.ownerName()) : '';
  });

  // ── Media ─────────────────────────────────────────────────────────────────

  /** Start / end frames, in the order the seed recorded them. */
  readonly frames = computed<ExerciseMedia[]>(() =>
    (this.exercise()?.media ?? [])
      .filter((media) => media.kind === ExerciseMediaKind.Image)
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  readonly youtubeUrl = computed(() => this.exercise()?.youtubeUrl?.trim() || null);

  readonly currentFrame = computed(() => {
    const frames = this.frames();
    if (frames.length === 0) return null;
    return frames[this.frameIndex() % frames.length] ?? null;
  });

  readonly hasHeroImage = computed(() => !this.youtubeUrl() && this.frames().length > 0);

  /**
   * The single still to show when there is no frame pair to alternate.
   *
   * A fork copies `thumbnailUrl` but not the source's media rows, so a
   * freshly forked exercise has a picture and no frames — falling straight
   * to the kind tile would hide a photograph we are already holding. Same
   * for any catalogue row seeded with a thumbnail but no start/end pair.
   */
  readonly heroStill = computed(() => {
    if (this.youtubeUrl() || this.frames().length > 0) return null;
    return this.exercise()?.thumbnailUrl || null;
  });

  // ── What you can do ───────────────────────────────────────────────────────

  private readonly _canAuthor = computed(
    () => this._authStore.isInstructor() && this._appModeStore.isCoach()
  );

  readonly canEdit = computed(() => this._canAuthor() && this.isMine());

  /**
   * Forking copies someone else's public exercise into your own library.
   * Your own is already there, and a private one is not yours to see, let
   * alone copy — the API answers 404 for both, so the row is not offered.
   */
  readonly canFork = computed(() => {
    //no one can fork exercises at the moment, so this is disabled for now
    return false;
    // const exercise = this.exercise();
    // return (
    //   this._canAuthor() &&
    //   !!exercise &&
    //   !this.isMine() &&
    //   exercise.visibility === ExerciseVisibility.Public
    // );
  });

  readonly forkTitle = computed(() => `Fork ${this.name()}?`);

  constructor() {
    addIcons(EXERCISE_ICONS);

    // Ionic mounts a fresh page per pushed id — a fork lands on a new detail
    // page over this one — but a same-id return re-enters this instance, so
    // the param stream is read rather than the snapshot, and an id already
    // on screen is not fetched twice.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const id = params.get('exerciseId');
      if (!id || id === this.exerciseId()) return;
      this.exerciseId.set(id);
      this._load(id);
    });

    // Two frames alternating read as a movement; one frame is a photograph
    // and must not blink. The timer only exists while there is something to
    // alternate between, and dies with the effect. A reader who asked the OS
    // for less motion gets the start position, still.
    effect((onCleanup) => {
      const count = this.frames().length;
      if (count < 2 || prefersReducedMotion()) return;
      const timer = setInterval(
        () => this.frameIndex.update((index) => (index + 1) % count),
        FRAME_MS
      );
      onCleanup(() => clearInterval(timer));
    });
  }

  /**
   * Ionic keeps this page alive in the stack, and Edit sits on top of it:
   * saving there returns to this very instance, which would otherwise show
   * the name and cues from before the edit. Re-read quietly on the way back
   * in — the first entry is the route subscription's job, so it is skipped.
   */
  ionViewWillEnter(): void {
    if (this.exercise()) this._load(this.exerciseId(), { silent: true });
  }

  edit(): void {
    void this._router.navigate(['/tabs/exercises', this.exerciseId(), 'edit']);
  }

  confirmFork(): void {
    this.forkOpen.set(true);
  }

  /**
   * One live fork per source is a rule the API enforces with a 409. That is
   * not an error the coach made — they asked for a copy and a copy already
   * exists — so the answer is to take them to it, not to show them a red
   * toast. The 409 body does not name the row, so it is looked up: the fork
   * is theirs, and it descends from this exercise.
   */
  fork(): void {
    const exercise = this.exercise();
    if (!exercise || this.forking()) return;

    this.forking.set(true);
    this._exerciseService
      .fork(exercise.id)
      .pipe(take(1))
      .subscribe({
        next: (fork) => {
          this.forking.set(false);
          void this._leaveFor(['/tabs/exercises', fork.id], 'Copied to your exercises', true);
        },
        error: (error: unknown) => {
          if (isConflict(error)) {
            this._openExistingFork(exercise);
            return;
          }
          this.forking.set(false);
          void this._feedbackService.error(error, 'Could not fork this exercise.');
        },
      });
  }

  retry(): void {
    const id = this.exerciseId();
    if (id) this._load(id);
  }

  /** Dismiss the sheet, then route — in that order, and awaited. */
  private async _leaveFor(commands: unknown[], message: string, succeeded = false): Promise<void> {
    await this._dismissFork(message, succeeded);
    await this._router.navigate(commands);
  }

  /**
   * `succeeded` picks the toast: a fork that was made is worth the success
   * chime, while landing on a copy that already existed is a neutral fact —
   * nothing happened, we just took them somewhere.
   */
  private async _dismissFork(message: string, succeeded = false): Promise<void> {
    await this._forkSheet()?.close();
    await (succeeded
      ? this._feedbackService.success(message)
      : this._feedbackService.info(message));
  }

  private _openExistingFork(source: Exercise): void {
    this._exerciseService
      .list({
        ownership: ExerciseOwnershipFilter.Mine,
        search: source.name,
        limit: 50,
      })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.forking.set(false);
          const existing = response.items.find((row) => row.forkedFromId === source.id);
          if (existing) {
            void this._leaveFor(
              ['/tabs/exercises', existing.id],
              'You already have a copy — here it is'
            );
            return;
          }
          // The copy exists — the API just said so — but the name search did
          // not find it (renamed, or past the first fifty). Say the true
          // thing rather than sending them nowhere.
          void this._dismissFork('You already have a fork of this exercise.');
        },
        error: () => {
          this.forking.set(false);
          void this._dismissFork('You already have a fork of this exercise.');
        },
      });
  }

  /** `silent` keeps the rows on screen — no skeleton over data we already have. */
  private _load(id: string, opts: { silent?: boolean } = {}): void {
    if (!opts.silent) {
      this.loading.set(true);
      this.frameIndex.set(0);
    }
    this.error.set(null);

    this._exerciseService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (exercise) => {
          this.exercise.set(exercise);
          this.loading.set(false);
        },
        error: () => {
          // A quiet re-read that fails leaves what was on screen; only a
          // first load has nothing better to show than the error.
          if (!opts.silent) this.error.set('This exercise is not available.');
          this.loading.set(false);
        },
      });
  }
}

/** The API's "you already have one of these" — the only 409 this screen expects. */
function isConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
