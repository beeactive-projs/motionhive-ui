import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
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
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  GroupMember,
  GroupsRefreshService,
  Post,
  displayName,
  formatRelativeShort,
} from 'core';

import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import {
  canDeletePost,
  canLeave,
  canManageGroup,
  canPost,
  joinPolicyLabel,
  joinPolicyTone,
  memberRoleLabel,
  memberRoleTone,
} from '../groups.config';
import { GroupTab, GroupTabs } from '../groups.filters';
import { GROUP_ICONS } from '../groups.icons';
import { GroupDetailStore } from './group-detail.store';

/**
 * One group: its posts, its members, and what it is.
 *
 * Which controls appear is decided per viewer by `groups.config.ts`, off the
 * role the server returns on the group. The asymmetry that matters: a
 * moderator moderates posts and has no power over members, so the two are
 * asked separately and never as one "is staff" question.
 */
@Component({
  selector: 'mh-group-detail',
  imports: [
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
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
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.scss',
  providers: [GroupDetailStore],
})
export class GroupDetail implements ViewWillEnter {
  readonly store = inject(GroupDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _auth = inject(AuthStore);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly Tabs = GroupTabs;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly leaveOpen = signal(false);
  readonly leaving = signal(false);

  readonly deletePostOpen = signal(false);
  readonly postBeingDeleted = signal<Post | null>(null);
  readonly deletingPost = signal(false);

  private readonly _viewerId = computed(() => this._auth.user()?.id ?? '');

  readonly isPosts = computed(() => this.store.tab() === GroupTabs.Posts);
  readonly isMembers = computed(() => this.store.tab() === GroupTabs.Members);
  readonly isAbout = computed(() => this.store.tab() === GroupTabs.About);

  // Each of these asks its own question. `canManageGroup` is the owner
  // alone; a moderator gets `canDeletePost` and nothing on this list.
  readonly canManage = computed(() => canManageGroup(this.store.viewerRole()));
  readonly canLeaveGroup = computed(() => canLeave(this.store.viewerRole()));

  readonly canCompose = computed(() => {
    const group = this.store.group();
    return !!group && canPost(this.store.viewerRole(), group);
  });

  readonly memberCountLabel = computed(() => {
    const count = this.store.group()?.memberCount ?? 0;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  });

  readonly policyLabel = computed(() => {
    const group = this.store.group();
    return group ? joinPolicyLabel(group.joinPolicy) : '';
  });

  readonly policyTone = computed(() => {
    const group = this.store.group();
    return group ? joinPolicyTone(group.joinPolicy) : 'medium';
  });

  /**
   * What a screen reader is told once a member search settles. Nothing on
   * screen says it otherwise: the list simply becomes shorter.
   */
  readonly resultAnnouncement = computed(() => {
    if (!this.isMembers() || !this.store.memberQuery().trim()) return '';
    const count = this.store.visibleMembers().length;
    if (count === 0) return 'No members match that.';
    return `${count} ${count === 1 ? 'member' : 'members'}.`;
  });

  constructor() {
    addIcons(GROUP_ICONS);

    // Via the param stream rather than a snapshot: Ionic reuses this page,
    // so opening a second group from a post or a member has to re-init
    // rather than keep showing the first one. The store ignores a repeat of
    // the id it already holds.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId) this.store.init(groupId);
    });
  }

  /**
   * Ionic keeps this page alive in the stack. Coming back to it — from a
   * post, or the composer — refetches quietly so a post added or a member
   * removed since shows without a flash.
   */
  ionViewWillEnter(): void {
    this.store.reenter();
  }

  setTab(value: string | number | undefined): void {
    if (value !== GroupTabs.Posts && value !== GroupTabs.Members && value !== GroupTabs.About) {
      return;
    }
    this.store.setTab(value as GroupTab);
  }

  onMemberQuery(value: string): void {
    this.store.setMemberQuery(value);
  }

  // ── Display helpers ────────────────────────────────────────────────────

  authorName(post: Post): string {
    return post.author ? displayName(post.author, 'Member') : 'Member';
  }

  postedAt(iso: string): string {
    return formatRelativeShort(iso);
  }

  memberName(member: GroupMember): string {
    return displayName(member.user, 'Member');
  }

  /**
   * A profile is addressed by handle, and an account can still be without
   * one — so a row is only tappable when there is somewhere to go.
   */
  openMember(member: GroupMember): void {
    const handle = member.user?.handle;
    if (!handle) return;
    void this._router.navigate(['/tabs/u', handle]);
  }

  hasProfile(member: GroupMember): boolean {
    return !!member.user?.handle;
  }

  roleLabel(member: GroupMember): string {
    return memberRoleLabel(member.role);
  }

  roleTone(member: GroupMember): string {
    return memberRoleTone(member.role);
  }

  /** The author, or staff moderating the group. */
  mayDelete(post: Post): boolean {
    return canDeletePost(this.store.viewerRole(), this._viewerId(), post.authorId);
  }

  // ── Verbs ──────────────────────────────────────────────────────────────

  like(post: Post): void {
    this.store.toggleReaction(post).subscribe({
      error: (error: unknown) =>
        void this._feedbackService.error(error, 'Could not save that reaction.'),
    });
  }

  confirmDeletePost(post: Post): void {
    this.postBeingDeleted.set(post);
    this.deletePostOpen.set(true);
  }

  deletePost(): void {
    const post = this.postBeingDeleted();
    if (!post || this.deletingPost()) return;

    this.deletingPost.set(true);
    this.store.deletePost(post.id).subscribe({
      next: () => {
        this.deletingPost.set(false);
        this.deletePostOpen.set(false);
        void this._feedbackService.success('Post deleted');
      },
      error: (error: unknown) => {
        this.deletingPost.set(false);
        void this._feedbackService.error(error, 'Could not delete that post.');
      },
    });
  }

  confirmLeave(): void {
    this.leaveOpen.set(true);
  }

  leave(): void {
    if (this.leaving()) return;

    this.leaving.set(true);
    this.store.leave().subscribe({
      next: () => {
        this.leaving.set(false);
        this.leaveOpen.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success('You left the group');
        void this._router.navigateByUrl('/tabs/groups');
      },
      error: (error: unknown) => {
        this.leaving.set(false);
        void this._feedbackService.error(error, 'Could not leave this group.');
      },
    });
  }

  compose(): void {
    void this._router.navigate(['/tabs/groups', this.store.group()?.id ?? '', 'compose']);
  }

  openPost(postId: string): void {
    void this._router.navigate(['/tabs/groups/post', postId]);
  }

  /**
   * The owner's queues. Settings live one tap further in, from there — the
   * kebab would otherwise carry two destinations that read the same.
   */
  manage(): void {
    void this._router.navigate(['/tabs/groups', this.store.group()?.id ?? '', 'manage']);
  }

  editGroup(): void {
    void this._router.navigate(['/tabs/groups', this.store.group()?.id ?? '', 'edit']);
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    const done = () => void event.target.complete();
    if (this.isPosts()) {
      this.store.loadMorePosts(done);
      return;
    }
    if (this.isMembers()) {
      this.store.loadMoreMembers(done);
      return;
    }
    done();
  }

  retry(): void {
    this.store.refresh();
  }
}
