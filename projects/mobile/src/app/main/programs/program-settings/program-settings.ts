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
  IonSkeletonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
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
    IonSkeletonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './program-settings.html',
  styleUrl: './program-settings.scss',
})
export class ProgramSettings implements ViewWillEnter {
  private readonly _programService = inject(ProgramService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _feedbackService = inject(FeedbackService);

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

  /** "9 days of work so far" — the status card counts what is actually built. */
  readonly dayCountLabel = computed(() => {
    const n = this.dayCount();
    return `${n} ${n === 1 ? 'day' : 'days'} of work so far.`;
  });

  /** What is still missing before this can be given to anyone. */
  readonly blockers = computed(() => {
    const list: string[] = [];
    if (!this.name().trim()) list.push('a name');
    if (this.dayCount() === 0) list.push('at least one day of work');
    return list;
  });

  readonly blockersLabel = computed(() => {
    const blockers = this.blockers();
    return blockers.length ? `Needs ${blockers.join(' and ')} before it can be assigned.` : '';
  });

  readonly canPublish = computed(() => this.blockers().length === 0);

  readonly canSave = computed(() => !!this.name().trim() && !this.saving());

  readonly weeksLabel = computed(() => (this.weeks() === 1 ? 'week' : 'weeks'));

  readonly deleteBody = computed(
    () =>
      `Delete ${this.program()?.name ?? 'this program'}? Clients already assigned keep their own copy.`,
  );

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
          void this._feedbackService.success(publish ? 'Program published' : 'Saved');
          if (publish) void this._router.navigate(['/tabs/programs/program', id]);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedbackService.error(err, 'Could not save the program');
        },
      });
  }

  publish(): void {
    this.save(true);
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
          void this._feedbackService.success('Program deleted');
          void this._router.navigate(['/tabs/programs'], { replaceUrl: true });
        },
        error: (err) => {
          this.deleting.set(false);
          void this._feedbackService.error(err, 'Could not delete the program');
        },
      });
  }

  openAssignments(): void {
    if (this._id) {
      void this._router.navigate(['/tabs/programs/program', this._id, 'assignments']);
    }
  }
}
