import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { ProgramAssignment, ProgramAssignmentStatus } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AssignmentRow } from '../_components/assignment-row/assignment-row';
import { AssignRequest, AssignSheet } from '../_sheets/assign-sheet/assign-sheet';
import { PROGRAM_ICONS } from '../programs.config';
import { AssignmentsStore } from './assignments.store';

/**
 * Who is on this program, in all five states.
 *
 * ACTIVE carries no chip on purpose: it is what most rows are, and a chip on
 * every row is a chip that says nothing. Only the exceptions speak.
 */
@Component({
  selector: 'mh-assignments',
  imports: [
    AssignSheet,
    AssignmentRow,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
  providers: [AssignmentsStore],
})
export class Assignments implements ViewWillEnter {
  readonly store = inject(AssignmentsStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _feedbackService = inject(FeedbackService);

  readonly Statuses = ProgramAssignmentStatus;
  readonly skeletonRows = [1, 2, 3];

  readonly assignOpen = signal(false);

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  // Always re-read: an assignment made or changed elsewhere belongs here.
  ionViewWillEnter(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  openAssign(): void {
    this.assignOpen.set(true);
  }

  onAssign(request: AssignRequest): void {
    this.store.assign(request, (error) => {
      if (error) void this._feedbackService.error(error, 'Could not assign the program');
      else void this._feedbackService.success('Program assigned');
    });
  }

  setStatus(row: ProgramAssignment, status: ProgramAssignmentStatus): void {
    this.store.setStatus(row, status, (error) => {
      if (error) void this._feedbackService.error(error, 'Could not change that assignment');
    });
  }
}
