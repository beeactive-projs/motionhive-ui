import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { GroupJoinRequest, Post, displayName, formatRelativeShort } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { GROUP_ICONS } from '../groups.icons';
import { GroupManageStore } from './group-manage.store';

/** The two queues this screen exists for. */
const ManageTabs = {
  Requests: 'requests',
  Posts: 'posts',
} as const;

type ManageTab = (typeof ManageTabs)[keyof typeof ManageTabs];

/**
 * What the owner has to decide: who gets in, and what gets published.
 *
 * Its own screen rather than a tab inside the group, because it is reached
 * from a notification as often as from the group itself — and because both
 * queues are work, not browsing.
 */
@Component({
  selector: 'mh-group-manage',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './group-manage.html',
  styleUrl: './group-manage.scss',
  providers: [GroupManageStore],
})
export class GroupManage implements ViewWillEnter {
  readonly store = inject(GroupManageStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly Tabs = ManageTabs;
  readonly skeletonRows = [1, 2, 3];

  readonly tab = signal<ManageTab>(ManageTabs.Requests);

  readonly isRequests = computed(() => this.tab() === ManageTabs.Requests);

  constructor() {
    addIcons(GROUP_ICONS);

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId) this.store.init(groupId);
    });
  }

  ionViewWillEnter(): void {
    // A queue is the one thing that must never be stale: deciding on a
    // request someone already withdrew is a wasted tap and a confusing error.
    this.store.refresh();
  }

  setTab(value: string | number | undefined): void {
    if (value !== ManageTabs.Requests && value !== ManageTabs.Posts) return;
    this.tab.set(value);
  }

  requesterName(request: GroupJoinRequest): string {
    return displayName(request.user, 'Someone');
  }

  authorName(post: Post): string {
    return post.author ? displayName(post.author, 'Member') : 'Member';
  }

  askedAt(iso: string): string {
    return formatRelativeShort(iso);
  }

  approveRequest(request: GroupJoinRequest): void {
    this._decide(request, 'APPROVE', `${this.requesterName(request)} joined`);
  }

  rejectRequest(request: GroupJoinRequest): void {
    this._decide(request, 'REJECT', 'Request declined');
  }

  publishPost(post: Post): void {
    this._moderate(post, 'APPROVED', 'Post published');
  }

  rejectPost(post: Post): void {
    this._moderate(post, 'REJECTED', 'Post rejected');
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  retry(): void {
    this.store.refresh();
  }

  private _decide(
    request: GroupJoinRequest,
    action: 'APPROVE' | 'REJECT',
    success: string,
  ): void {
    if (this.store.isBusy(request.id)) return;
    this.store.decideRequest(request, action).subscribe({
      next: () => void this._feedbackService.success(success),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not save that decision.'),
    });
  }

  private _moderate(post: Post, decision: 'APPROVED' | 'REJECTED', success: string): void {
    if (this.store.isBusy(post.id)) return;
    this.store.moderatePost(post, decision).subscribe({
      next: () => void this._feedbackService.success(success),
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not save that decision.'),
    });
  }
}
