import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { ConfirmSheet } from '../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { PersonRow } from '../../_shared/components/person-row/person-row';
import { ActionSheet } from '../../_shared/components/action-sheet/action-sheet';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { StaleBar } from '../../_shared/components/stale-bar/stale-bar';
import { ClockService } from '../../_shared/services/clock.service';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import {
  CoachAction,
  CoachActionId,
  CoachActionIds,
  CoachRequestRow,
  CoachRowKinds,
  MyCoachRow,
  visibleCoachActions,
} from './coaches.config';
import { COACH_ICONS } from './coaches.icons';
import { CoachesStore } from './coaches.store';

/**
 * The row the verbs sheet is open on, tagged by kind so each branch of
 * `onAction` gets the row type its verbs need and nothing can be handed the
 * wrong one.
 */
type OpenRow =
  | { kind: typeof CoachRowKinds.Invite; row: CoachRequestRow }
  | { kind: typeof CoachRowKinds.Coach; row: MyCoachRow };

/**
 * My coaches — the trainee's side of a coaching relationship.
 *
 * A grouped flat list in two sections: invitations first, since they are the
 * only part of this screen waiting on the reader, then the coaches they
 * already train with. A row opens its verbs in an action sheet, the way a
 * pending client row does on the coach's side, so a request reads the same
 * from either end.
 */
@Component({
  selector: 'mh-coaches',
  imports: [
    ActionSheet,
    ConfirmSheet,
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    PersonRow,
    RowSkeleton,
    StaleBar,
    TranslatePipe,
  ],
  templateUrl: './coaches.html',
  styleUrl: './coaches.scss',
  providers: [CoachesStore],
})
export class Coaches implements ViewWillEnter {
  readonly store = inject(CoachesStore);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _clockService = inject(ClockService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  /** The verbs sheet, and the row it was opened on. */
  readonly sheetOpen = signal(false);
  readonly openRow = signal<OpenRow | null>(null);

  /** Ending a coaching asks first; declining an invitation fires on the tap. */
  readonly leaveOpen = signal(false);
  readonly leaving = signal<MyCoachRow | null>(null);
  readonly leaveSaving = signal(false);

  readonly sheetTitle = computed(() => this.openRow()?.row.person.name ?? '');

  readonly sheetSubtitle = computed(() => this.openRow()?.row.person.subline ?? '');

  readonly actions = computed<readonly CoachAction[]>(() => {
    const open = this.openRow();
    if (!open) return [];
    return visibleCoachActions(open.kind, {
      handle: open.row.handle,
      userId: open.kind === CoachRowKinds.Coach ? open.row.instructorId : open.row.userId,
    });
  });

  readonly leaveTitle = computed(() => {
    const row = this.leaving();
    return row
      ? this._translateService.instant('coaches.confirm.leave.title', { name: row.person.name })
      : this._translateService.instant('coaches.confirm.leave.titleFallback');
  });

  constructor() {
    addIcons(COACH_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack, so an
  // invitation answered on another device has to be picked up on entry.
  // `reenter` holds that back for a few seconds so stepping into a profile
  // and straight back out does not re-fire both calls.
  ionViewWillEnter(): void {
    this._clockService.bump();
    this.store.reenter();
  }

  openInvite(row: CoachRequestRow): void {
    this.openRow.set({ kind: CoachRowKinds.Invite, row });
    this.sheetOpen.set(true);
  }

  openCoach(row: MyCoachRow): void {
    this.openRow.set({ kind: CoachRowKinds.Coach, row });
    this.sheetOpen.set(true);
  }

  /**
   * The sheet has gone by now, so a verb that navigates or opens one is safe.
   *
   * Dispatched on the row's kind before the verb, so each branch has the row
   * type its verbs need: the request verbs key on a request id, leaving on
   * the coach's account, and nothing can be handed the wrong one.
   */
  onAction(id: CoachActionId): void {
    const open = this.openRow();
    if (!open) return;

    if (id === CoachActionIds.ViewProfile) {
      this._openProfile(open.row.handle);
      return;
    }

    if (open.kind === CoachRowKinds.Coach) {
      if (id === CoachActionIds.Message) this._message(open.row);
      if (id === CoachActionIds.Leave) {
        this.leaving.set(open.row);
        this.leaveOpen.set(true);
      }
      return;
    }

    if (id === CoachActionIds.Accept) this._accept(open.row);
    if (id === CoachActionIds.Decline) this._decline(open.row);
  }

  /** Who is asking, before saying yes: their public profile, in this stack. */
  private _openProfile(handle: string | null): void {
    if (handle) void this._router.navigate(['/tabs/more/coaches/person', handle]);
  }

  private _message(row: MyCoachRow): void {
    this._openDirectMessage({
      id: row.instructorId,
      firstName: row.firstName,
      lastName: row.lastName,
    });
  }

  private _accept(row: CoachRequestRow): void {
    this.store.accept(row.id).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('coaches.toast.accepted', { name: row.person.name }),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.acceptFailed'),
        ),
    });
  }

  /** Fires on the tap, as declining does on the coach's side: they can ask again. */
  private _decline(row: CoachRequestRow): void {
    this.store.decline(row.id).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant('coaches.toast.declined'),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.declineFailed'),
        ),
    });
  }

  leave(): void {
    const row = this.leaving();
    if (!row || this.leaveSaving()) return;

    this.leaveSaving.set(true);
    this.store.leave(row.instructorId).subscribe({
      next: () => {
        this.leaveSaving.set(false);
        this.leaveOpen.set(false);
        void this._feedbackService.success(this._translateService.instant('coaches.toast.left'));
      },
      error: (error: unknown) => {
        this.leaveSaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('coaches.toast.leaveFailed'),
        );
      },
    });
  }

  /** Nobody to show: finding a coach is the only thing to do from here. */
  openDiscover(): void {
    void this._router.navigateByUrl('/tabs/discover');
  }

  /**
   * A refresh that fails leaves the rows that were already there, which is
   * right — but silently, they read as fresh. The stale notice above the list
   * says so and offers the retry; no toast on top of it.
   */
  onRefresh(event: RefresherCustomEvent): void {
    this._clockService.bump();
    this.store.refresh(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }
}
