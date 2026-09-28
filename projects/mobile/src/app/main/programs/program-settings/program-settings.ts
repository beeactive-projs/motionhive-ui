import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { Program, ProgramService, ProgramStatus } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  DEFAULT_PROGRAM_WEEKS,
  MAX_PROGRAM_WEEKS,
  PROGRAM_ICONS,
  weeksOf,
  weeksToDays,
} from '../programs.config';

/**
 * Metadata, and the one state change that matters.
 *
 * Saving an unfinished draft is always allowed — authoring happens over days
 * and a half-built plan must survive closing the app. What is not allowed is
 * *assigning* one, which is why Assign lives only on a published program and
 * the status card says plainly what is still missing.
 */
@Component({
  selector: 'mh-program-settings',
  imports: [
    ConfirmSheet,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './program-settings.html',
  styleUrl: './program-settings.scss',
})
export class ProgramSettings implements ViewWillEnter {
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly program = signal<Program | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly name = signal('');
  readonly description = signal('');
  /** Authored in weeks; stored as days. */
  readonly weeks = signal(DEFAULT_PROGRAM_WEEKS);

  private _id: string | null = null;

  readonly showSkeleton = computed(() => this.loading() && !this.program());
  readonly showError = computed(() => this.error() && !this.program());

  readonly isPublished = computed(() => this.program()?.status === ProgramStatus.Published);

  readonly dayCount = computed(() => (this.program()?.workouts ?? []).length);

  /**
   * Days that the length now on the stepper would delete.
   *
   * Shortening a program drops the weeks that no longer fit — a declared
   * length the workouts contradict is what gave clients an end date before
   * their own last session. Named before the save, not after.
   */
  readonly doomedDays = computed(() => {
    const workouts = this.program()?.workouts ?? [];
    const weeks = this.weeks();
    return workouts.filter((w) => w.weekIndex >= weeks).length;
  });

  /** "9 days of work so far" — the status card counts what is actually built. */
  readonly dayCountLabel = computed(() =>
    this._translateService.instant('programs.settings.dayCount', { count: this.dayCount() }),
  );

  /** What is still missing before this can be given to anyone. */
  private readonly _needsName = computed(() => !this.name().trim());
  private readonly _needsDays = computed(() => this.dayCount() === 0);

  /** One full sentence per combination — the missing parts are never glued together. */
  readonly blockersLabel = computed(() => {
    const needsName = this._needsName();
    const needsDays = this._needsDays();
    if (needsName && needsDays) return this._translateService.instant('programs.settings.needs.both');
    if (needsName) return this._translateService.instant('programs.settings.needs.name');
    if (needsDays) return this._translateService.instant('programs.settings.needs.days');
    return '';
  });

  readonly canPublish = computed(() => !this._needsName() && !this._needsDays());

  readonly canSave = computed(() => !!this.name().trim() && !this.saving());

  readonly weeksLabel = computed(() =>
    this._translateService.instant('programs.settings.weeksUnit', { count: this.weeks() }),
  );

  readonly deleteBody = computed(() => {
    const name = this.program()?.name;
    return name
      ? this._translateService.instant('programs.settings.delete.body', { name })
      : this._translateService.instant('programs.settings.delete.bodyFallback');
  });

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id || id === this._id) return;
    this._id = id;
    this.load();
  }

  load(): void {
    const id = this._id;
    if (!id) return;

    this.loading.set(true);
    this.error.set(false);
    this._programService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.program.set(program);
          this.name.set(program.name);
          this.description.set(program.description ?? '');
          this.weeks.set(weeksOf(program) ?? DEFAULT_PROGRAM_WEEKS);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  stepWeeks(delta: number): void {
    this.weeks.update((w) => Math.max(1, Math.min(MAX_PROGRAM_WEEKS, w + delta)));
  }

  save(publish = false): void {
    const id = this._id;
    if (!id || !this.canSave()) return;
    if (publish && !this.canPublish()) return;

    this.saving.set(true);
    this._programService
      .update(id, {
        name: this.name().trim(),
        description: this.description().trim() || undefined,
        durationDays: weeksToDays(this.weeks()),
        ...(publish ? { status: ProgramStatus.Published } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.saving.set(false);
          this.program.set(program);
          void this._feedbackService.success(
            this._translateService.instant(
              publish ? 'programs.settings.toast.published' : 'toast.summary.saved',
            ),
          );
          if (publish) void this._router.navigate(['/tabs/programs/program', id]);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('programs.settings.toast.saveFailed'),
          );
        },
      });
  }

  publish(): void {
    this.save(true);
  }

  readonly duplicating = signal(false);

  /**
   * A copy of this program, owned by the caller, as a fresh draft.
   *
   * Lands on the copy rather than staying here: the reason to duplicate is
   * to change something, and the thing to change is the new one.
   */
  duplicate(): void {
    const id = this._id;
    if (!id || this.duplicating()) return;

    this.duplicating.set(true);
    this._programService
      .duplicate(id)
      .pipe(take(1))
      .subscribe({
        next: (copy) => {
          this.duplicating.set(false);
          void this._feedbackService.success(
            this._translateService.instant('programs.settings.toast.duplicated'),
          );
          void this._router.navigate(['/tabs/programs/program', copy.id], {
            replaceUrl: true,
          });
        },
        error: (err) => {
          this.duplicating.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('programs.settings.toast.duplicateFailed'),
          );
        },
      });
  }

  confirmDelete(): void {
    const id = this._id;
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this._programService
      .remove(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteOpen.set(false);
          void this._feedbackService.success(
            this._translateService.instant('programs.settings.toast.deleted'),
          );
          void this._router.navigate(['/tabs/programs'], { replaceUrl: true });
        },
        error: (err) => {
          this.deleting.set(false);
          void this._feedbackService.error(
            err,
            this._translateService.instant('programs.settings.toast.deleteFailed'),
          );
        },
      });
  }

  openAssignments(): void {
    if (this._id) {
      void this._router.navigate(['/tabs/programs/program', this._id, 'assignments']);
    }
  }
}
