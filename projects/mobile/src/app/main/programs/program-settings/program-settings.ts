import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs/operators';

import { Program, ProgramService } from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { PROGRAM_ICONS, weeksOf, weeksToDays } from '../programs.config';

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
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './program-settings.html',
  styleUrl: './program-settings.scss',
})
export class ProgramSettings implements ViewWillEnter {
  private readonly _programService = inject(ProgramService);
  private readonly _router = inject(Router);
  private readonly _feedback = inject(FeedbackService);

  readonly program = signal<Program | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly name = signal('');
  readonly description = signal('');
  /** Authored in weeks; stored as days. */
  readonly weeks = signal(4);

  private _id: string | null = null;

  readonly isPublished = computed(() => this.program()?.status === 'PUBLISHED');

  readonly dayCount = computed(() => (this.program()?.workouts ?? []).length);

  /** What is still missing before this can be given to anyone. */
  readonly blockers = computed(() => {
    const list: string[] = [];
    if (!this.name().trim()) list.push('a name');
    if (this.dayCount() === 0) list.push('at least one day of work');
    return list;
  });

  readonly canPublish = computed(() => this.blockers().length === 0);

  readonly canSave = computed(() => !!this.name().trim() && !this.saving());

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  ionViewWillEnter(): void {
    const parts = this._router.url.split('?')[0].split('/');
    const id = parts[parts.indexOf('program') + 1] ?? null;
    if (!id || id === this._id) return;
    this._id = id;

    this.loading.set(true);
    this._programService
      .get(id)
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.program.set(program);
          this.name.set(program.name);
          this.description.set(program.description ?? '');
          this.weeks.set(weeksOf(program) ?? 4);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          void this._feedback.error(err, 'Could not open the program');
        },
      });
  }

  stepWeeks(delta: number): void {
    this.weeks.update((w) => Math.max(1, Math.min(52, w + delta)));
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
        ...(publish ? { status: 'PUBLISHED' as const } : {}),
      })
      .pipe(take(1))
      .subscribe({
        next: (program) => {
          this.saving.set(false);
          this.program.set(program);
          void this._feedback.success(publish ? 'Program published' : 'Saved');
          if (publish) void this._router.navigate(['/tabs/programs/program', id]);
        },
        error: (err) => {
          this.saving.set(false);
          void this._feedback.error(err, 'Could not save the program');
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
          void this._feedback.success('Program deleted');
          void this._router.navigate(['/tabs/programs'], { replaceUrl: true });
        },
        error: (err) => {
          this.deleting.set(false);
          void this._feedback.error(err, 'Could not delete the program');
        },
      });
  }

  openAssignments(): void {
    if (this._id) {
      void this._router.navigate(['/tabs/programs/program', this._id, 'assignments']);
    }
  }
}
