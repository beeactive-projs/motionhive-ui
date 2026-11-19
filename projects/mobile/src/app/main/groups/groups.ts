import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { AuthStore, GroupWithMyRole, PendingGroupInvitation, Post, displayName } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { RowSkeleton } from '../../_shared/components/row-skeleton/row-skeleton';
import { StaleBar } from '../../_shared/components/stale-bar/stale-bar';
import { FeedbackService } from '../../_shared/services/feedback.service';
import { GROUP_AVATAR_TONE } from '../../_shared/utils/avatar-tone.utils';
import { GroupInviteCard } from './_components/group-invite-card/group-invite-card';
import { PostCard } from './_components/post-card/post-card';
import { PostActions } from './_sheets/post-actions/post-actions';
import { PostPermissions, postActions } from './_sheets/post-actions/post-actions.config';
import {
  canDeletePost,
  canEditPost,
  groupRowLine,
  manageTabFor,
  waitingCount,
  waitingLine,
} from './groups.config';
import { GroupsSegments } from './groups.filters';
import { GROUP_ICONS } from './groups.icons';
import { GroupsStore } from './groups.store';

/**
 * Groups home: what is happening in your groups, and the groups themselves.
 *
 * Feed is the landing lens, every post from every group you are in, with
 * the work waiting on you ("Needs you") above it, because the reason to open
 * Groups is usually to read, and for a coach to answer. Your groups lists
 * the groups you run, then the ones you joined. Invitations sit on top of
 * both. Finding a group is the Discover tab's job, so there is no search or
 * directory here (design 2026-11-14).
 */
@Component({
  selector: 'mh-groups',
  imports: [
    EmptyState,
    GroupInviteCard,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
      IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    PostActions,
    PostCard,
    RowSkeleton,
    StaleBar,
    TranslatePipe,
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  providers: [GroupsStore],
})
export class Groups implements ViewWillEnter {
  readonly store = inject(GroupsStore);
  private readonly _router = inject(Router);
  private readonly _authStore = inject(AuthStore);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  private readonly _postActions = viewChild(PostActions);

  readonly Segments = GroupsSegments;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly groupTone = GROUP_AVATAR_TONE;

  readonly isFeed = computed(() => this.store.segment() === GroupsSegments.Feed);

  /**
   * Only a coach is offered "create a group": the API's create route carries
   * `@Roles('INSTRUCTOR')`, so the "+" would 403 for everyone else.
   */
  readonly canCreate = computed(() => this._authStore.isInstructor());

  private readonly _viewerId = computed(() => {
    const user = this._authStore.user();
    if (!user) {
      return '';
    }
    return user.id;
  });

  /** The invitation being answered, and how, so its card can spin. */
  readonly answering = signal<{ id: string; how: 'join' | 'later' } | null>(null);

  constructor() {
    addIcons(GROUP_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack. A group joined,
  // left or posted in elsewhere changes these lists, so entering refetches,
  // quietly, since rows already on screen stay put.
  ionViewWillEnter(): void {
    this.store.reenter();
    // Read off the live URL, not a route snapshot: this page stays alive.
    const segment = this._router.parseUrl(this._router.url).queryParamMap.get('segment');
    if (segment) {
      this.setSegment(segment);
    }
  }

  setSegment(value: string | number | undefined): void {
    if (value !== GroupsSegments.Feed && value !== GroupsSegments.Mine) {
      return;
    }
    this.store.setSegment(value);
  }

  // ── Invitations ────────────────────────────────────────────────────────

  answeringHow(invitation: PendingGroupInvitation): 'join' | 'later' | null {
    const current = this.answering();
    if (!current || current.id !== invitation.id) {
      return null;
    }
    return current.how;
  }

  joinInvitation(invitation: PendingGroupInvitation): void {
    if (this.answering()) {
      return;
    }
    this.answering.set({ id: invitation.id, how: 'join' });
    this.store.acceptInvitation(invitation).subscribe({
      next: () => {
        this.answering.set(null);
        void this._feedbackService.success(
          this._translateService.instant('groups.invite.toast.joined', {
            group: invitation.group.name,
          }),
        );
      },
      error: (error: unknown) => {
        this.answering.set(null);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.invite.toast.joinFailed'),
        );
      },
    });
  }

  /** Here the quiet verb is Decline: Groups is where an invitation is answered. */
  declineInvitation(invitation: PendingGroupInvitation): void {
    if (this.answering()) {
      return;
    }
    this.answering.set({ id: invitation.id, how: 'later' });
    this.store.declineInvitation(invitation).subscribe({
      next: () => {
        this.answering.set(null);
        void this._feedbackService.success(
          this._translateService.instant('groups.invite.toast.declined'),
        );
      },
      error: (error: unknown) => {
        this.answering.set(null);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.invite.toast.declineFailed'),
        );
      },
    });
  }

  // ── Needs you and Your groups ──────────────────────────────────────────

  waitingLine(group: GroupWithMyRole): string {
    return waitingLine(group);
  }

  waitingCount(group: GroupWithMyRole): number {
    return waitingCount(group);
  }

  rowLine(group: GroupWithMyRole): string {
    let ownerName = '';
    if (group.owner) {
      ownerName = displayName(group.owner, '');
    }
    return groupRowLine(group, ownerName);
  }

  /** A Needs you row opens the queue with something in it. */
  openQueue(group: GroupWithMyRole): void {
    void this._router.navigate(['/tabs/groups', group.id, 'manage'], {
      queryParams: { tab: manageTabFor(group) },
    });
  }

  openGroup(groupId: string): void {
    void this._router.navigate(['/tabs/groups', groupId]);
  }

  createGroup(): void {
    void this._router.navigateByUrl('/tabs/groups/create');
  }

  /** Finding a group is the Discover tab's job; its "Groups to join" is there. */
  discoverGroups(): void {
    void this._router.navigateByUrl('/tabs/discover/groups');
  }

  // ── Feed posts ─────────────────────────────────────────────────────────

  groupNameOf(post: Post): string | null {
    if (!post.group) {
      return null;
    }
    return post.group.name;
  }

  private _permissionsFor(post: Post): PostPermissions {
    const viewerId = this._viewerId();
    const role = this.store.roleByGroup().get(post.groupId) ?? null;
    return {
      canEdit: canEditPost(viewerId, post.authorId),
      canDelete: canDeletePost(role, viewerId, post.authorId),
    };
  }

  hasPostActions(post: Post): boolean {
    return postActions(post, this._permissionsFor(post)).length > 0;
  }

  openPostActions(post: Post): void {
    const sheet = this._postActions();
    if (sheet) {
      sheet.show(post, this._permissionsFor(post));
    }
  }

  onPostUpdated(post: Post): void {
    this.store.patchPost(post);
  }

  onPostDeleted(postId: string): void {
    this.store.removePost(postId);
  }

  like(post: Post): void {
    this.store.toggleReaction(post).subscribe({
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.post.toast.reactionFailed'),
        ),
    });
  }

  openPost(postId: string): void {
    void this._router.navigate(['/tabs/groups/post', postId]);
  }

  /** Comment opens the post with the field ready, as Reply does. */
  commentOn(postId: string): void {
    void this._router.navigate(['/tabs/groups/post', postId], {
      queryParams: { comment: 1 },
    });
  }

  /** Straight to the viewer, skipping the post: the tap was on a photo. */
  openPhoto(postId: string, index: number): void {
    void this._router.navigate(['/tabs/groups/post', postId, 'photos'], {
      queryParams: { index },
    });
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  /**
   * A refresh that fails leaves the rows that were already there, which is
   * right, but silently they read as fresh. The stale bar says so and offers
   * the retry.
   */
  retry(): void {
    this.store.refresh();
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMoreFeed(() => void event.target.complete());
  }

  /** Only the feed pages; Your groups is one response. */
  readonly hasMore = computed(() => this.isFeed() && this.store.feedHasMore());
}
