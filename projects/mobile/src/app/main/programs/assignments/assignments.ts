import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { ProgramAssignment, ProgramAssignmentStatus, displayName } from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { clientPath, coachStackOf } from '../../clients/client-paths';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { AssignmentRow } from '../_components/assignment-row/assignment-row';
import { AssignRequest, AssignSheet } from '../_sheets/assign-sheet/assign-sheet';
import { EndPlanRequest, EndPlanSheet } from '../_sheets/end-plan-sheet/end-plan-sheet';
import { endPlanClientName } from '../_sheets/end-plan-sheet/end-plan.config';
import { PROGRAM_ICONS } from '../programs.config';
import { canEditCopy } from '../client-copy/client-copy.config';
import { PlanOptionId, PlanOptionIds, planOptionActions } from './assignments.config';
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
    ActionSheet,
    AssignSheet,
    AssignmentRow,
    EmptyState,
    EndPlanSheet,
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
    TranslatePipe,
  ],
  templateUrl: './assignments.html',
  styleUrl: './assignments.scss',
  providers: [AssignmentsStore],
})
export class Assignments implements ViewWillEnter {
  readonly store = inject(AssignmentsStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  /** Programs, or Clients when the plan was opened from a client's page. */
  readonly stack = coachStackOf(this._router.url);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly Statuses = ProgramAssignmentStatus;
  readonly skeletonRows = [1, 2, 3];

  readonly assignOpen = signal(false);
  readonly assignSaving = signal(false);

  /** The plan whose ⋯ was tapped: the end-plan sheet acts on it. */
  readonly endPlanRow = signal<ProgramAssignment | null>(null);
  readonly endPlanOpen = signal(false);
  readonly endPlanSaving = signal(false);

  /** The ⋯'s verbs for that plan: edit the client's copy, or pause, finish, cancel it. */
  readonly optionsOpen = signal(false);
  readonly optionsTitle = computed(() => {
    const row = this.endPlanRow();
    if (!row) {
      return '';
    }
    return displayName(row.client, this._translateService.instant('programs.common.clientFallback'));
  });
  readonly optionActions = computed(() => {
    const row = this.endPlanRow();
    if (!row) {
      return [];
    }
    const fallback = this._translateService.instant('programs.common.clientFallback');
    return planOptionActions(row, endPlanClientName(row, fallback));
  });

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
    // No program yet and the store would never answer, leaving the sheet spinning.
    if (!this.store.program() || this.assignSaving()) return;
    this.assignSaving.set(true);
    this.store.assign(request, (error) => {
      this.assignSaving.set(false);
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.assignments.toast.assignFailed'),
        );
      } else {
        this.assignOpen.set(false);
        void this._feedbackService.success(
          this._translateService.instant('programs.assignments.toast.assigned'),
        );
      }
    });
  }

  /**
   * The person on this plan, opened in THIS stack so back returns to the
   * plan's list. Their page carries the rest: profile, training, progress.
   */
  openClient(row: ProgramAssignment): void {
    void this._router.navigate(clientPath(this.stack, row.clientId));
  }

  setStatus(row: ProgramAssignment, status: ProgramAssignmentStatus): void {
    this.store.setStatus(row, status, (error) => {
      if (error) {
        void this._feedbackService.error(
          error,
          this._translateService.instant('programs.assignments.toast.statusFailed'),
        );
      }
    });
  }

  /**
   * A plan's ⋯: its verbs, the client's copy first while the plan runs or is
   * paused. With nothing but the status left to change, straight to that sheet.
   */
  openOptions(row: ProgramAssignment): void {
    this.endPlanRow.set(row);
    if (canEditCopy(row.status)) {
      this.optionsOpen.set(true);
      return;
    }
    this.endPlanOpen.set(true);
  }

  /** Emitted once the verbs' sheet has gone, so the next sheet or page opens cleanly. */
  onOption(id: PlanOptionId): void {
    const row = this.endPlanRow();
    if (!row) {
      return;
    }
    if (id === PlanOptionIds.EditCopy) {
      void this._router.navigate([this.stack, 'copy', row.id]);
      return;
    }
    this.endPlanOpen.set(true);
  }

  openEndPlan(row: ProgramAssignment): void {
    this.endPlanRow.set(row);
    this.endPlanOpen.set(true);
  }

  /** Sent from the sheet; it closes once the change is saved and the client told. */
  onEndPlan(request: EndPlanRequest): void {
    const row = this.endPlanRow();
    if (!row || this.endPlanSaving()) {
      return;
    }
    this.endPlanSaving.set(true);
    this.store.setStatus(
      row,
      request.status,
      (error) => {
        this.endPlanSaving.set(false);
        if (error) {
          void this._feedbackService.error(
            error,
            this._translateService.instant('programs.assignments.toast.statusFailed'),
          );
          return;
        }
        this.endPlanOpen.set(false);
        void this._feedbackService.success(
          this._translateService.instant('programs.endPlan.done', { status: request.status }),
        );
      },
      request.message,
    );
  }
}
