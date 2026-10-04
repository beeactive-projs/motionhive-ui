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
  IonRadio,
  IonRadioGroup,
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

/** What a longer program puts in the weeks it gains. */
type NewWeeksChoice = 'repeat' | 'empty';

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
    IonRadio,
    IonRadioGroup,
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
  /** The length as last saved, so lengthening can be told from any other save. */
  private readonly _savedWeeks = signal(DEFAULT_PROGRAM_WEEKS);
  /** The coach's answer for the empty weeks; nothing until they pick. */
  readonly newWeeksChoice = signal<NewWeeksChoice | null>(null);
  /** Set when a save was tried without an answer, so the question says why. */
  readonly newWeeksMissing = signal(false);

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

  /** Weeks 1…n that hold the work so far — the block a longer program repeats. */
  readonly builtWeeks = computed(() =>
    (this.program()?.workouts ?? []).reduce((max, w) => Math.max(max, w.weekIndex + 1), 0),
  );

  /** Empty weeks after the built ones, at the length now on the stepper. */
  readonly emptyWeeks = computed(() =>
    this.builtWeeks() > 0 ? Math.max(0, this.weeks() - this.builtWeeks()) : 0,
  );

  /**
   * Asked only while the program is being made longer, and with neither
   * answer preselected. A ticked default copied training into weeks the
   * coach had not thought about; an unticked one left a ten-week plan with
   * nine empty weeks. Both are a choice, so the coach makes it.
   */
  readonly askNewWeeks = computed(
    () => this.weeks() > this._savedWeeks() && this.emptyWeeks() > 0,
  );

  /** The weeks the question is about, as the label and both answers name them. */
  private readonly _newWeeksParams = computed(() => ({
    built: this.builtWeeks(),
    empty: this.emptyWeeks(),
    first: this.builtWeeks() + 1,
    last: this.weeks(),
  }));

  readonly newWeeksQuestion = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.question', this._newWeeksParams()),
  );

  readonly repeatLabel = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.copy', this._newWeeksParams()),
  );

  readonly leaveEmptyLabel = computed(() =>
    this._translateService.instant('programs.settings.newWeeks.leaveEmpty', this._newWeeksParams()),
  );

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
          this._savedWeeks.set(this.weeks());
          this._resetNewWeeks();
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

  chooseNewWeeks(choice: NewWeeksChoice): void {
    this.newWeeksChoice.set(choice);
    this.newWeeksMissing.set(false);
  }

  save(publish = false): void {
    const id = this._id;
    if (!id || !this.canSave()) return;
    if (publish && !this.canPublish()) return;

    // Save stays tappable and points at the question instead: a disabled
    // button in the toolbar would not say what it is waiting for.
    if (this.askNewWeeks() && !this.newWeeksChoice()) {
      this.newWeeksMissing.set(true);
      document.getElementById('new-weeks')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const repeat = this.askNewWeeks() && this.newWeeksChoice() === 'repeat';

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
        next: (saved) => {
          this._adoptSaved(saved);
          if (!repeat) {
            this._finishSave(id, publish);
            return;
          }
          // A second request on purpose: the length is saved either way, and
          // a failed repeat leaves empty weeks rather than an unsaved form.
          this._programService
            .repeatWeeks(id)
            .pipe(take(1))
            .subscribe({
              next: (full) => {
                this.program.set(full);
                this._finishSave(id, publish);
              },
              error: (err) => {
                this.saving.set(false);
                void this._feedbackService.error(
                  err,
                  this._translateService.instant('programs.settings.toast.repeatFailed'),
                );
              },
            });
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

  /**
   * The update answers with the program alone, not its days. Keep the tree
   * this screen already has, minus the weeks a shorter length just dropped,
   * so the counts on the card still describe the plan.
   */
  private _adoptSaved(saved: Program): void {
    const weeks = this.weeks();
    const kept = (this.program()?.workouts ?? []).filter((w) => w.weekIndex < weeks);
    this.program.set({ ...saved, workouts: saved.workouts ?? kept });
    this._savedWeeks.set(weeks);
    this._resetNewWeeks();
  }

  private _resetNewWeeks(): void {
    this.newWeeksChoice.set(null);
    this.newWeeksMissing.set(false);
  }

  private _finishSave(id: string, publish: boolean): void {
    this.saving.set(false);
    void this._feedbackService.success(
      this._translateService.instant(
        publish ? 'programs.settings.toast.published' : 'toast.summary.saved',
      ),
    );
    if (publish) void this._router.navigate(['/tabs/programs/program', id]);
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
