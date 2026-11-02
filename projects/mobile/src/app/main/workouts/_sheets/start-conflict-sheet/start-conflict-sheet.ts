import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { SheetAction } from '../../../../_shared/components/action-sheet/action-sheet.model';
import {
  ActiveWorkoutService,
  StartConflictChoice,
  StartConflictChoices,
} from '../../_services/active-workout.service';

/**
 * Starting a workout while another is open: resume that one, finish it and
 * start, or discard it and start. Hosted beside the tab bar so it can follow
 * a start from any screen.
 */
@Component({
  selector: 'mh-start-conflict-sheet',
  imports: [ActionSheet, TranslatePipe],
  template: `
    <mh-action-sheet
      [(open)]="open"
      [title]="title()"
      [subtitle]="'workouts.startConflict.subtitle' | translate"
      [actions]="actions"
      [closeOnChoose]="false"
      (chosen)="onChosen($event)"
    />
  `,
})
export class StartConflictSheet {
  private readonly _service = inject(ActiveWorkoutService);
  private readonly _translateService = inject(TranslateService);

  readonly open = signal(false);
  private _chosen = false;

  readonly title = computed(() =>
    this._translateService.instant('workouts.startConflict.title', {
      name: this._service.conflict()?.open.name ?? '',
    }),
  );

  readonly actions: SheetAction<StartConflictChoice>[] = [
    {
      id: StartConflictChoices.Resume,
      label: 'workouts.startConflict.resume',
      icon: 'play-outline',
      color: 'primary',
    },
    {
      id: StartConflictChoices.FinishAndStart,
      label: 'workouts.startConflict.finishAndStart',
      hint: 'workouts.startConflict.finishHint',
      icon: 'checkmark-outline',
      color: 'medium',
    },
    {
      id: StartConflictChoices.DiscardAndStart,
      label: 'workouts.startConflict.discardAndStart',
      hint: 'workouts.startConflict.discardHint',
      icon: 'trash-outline',
      destructive: true,
    },
  ];

  constructor() {
    // Opens when a start runs into an open workout.
    effect(() => {
      if (this._service.conflict()) {
        this._chosen = false;
        this.open.set(true);
      }
    });
    // Closed without a choice: nothing changes, the start is called off.
    effect(() => {
      if (!this.open() && this._service.conflict() && !this._chosen) {
        queueMicrotask(() => {
          if (!this._chosen) this._service.choose(null);
        });
      }
    });
  }

  /** Reported at the tap (not after the sheet has gone), so a close can't be mistaken for it. */
  onChosen(choice: StartConflictChoice): void {
    this._chosen = true;
    this.open.set(false);
    this._service.choose(choice);
  }
}
