import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonBadge,
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
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  NavController,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import {
  AuthStore,
  Category,
  CategoryStore,
  GroupMember,
  GroupsRefreshService,
  Post,
  displayName,
} from 'core';

import { ActionSheet } from '../../../_shared/components/action-sheet/action-sheet';
import { ConfirmSheet } from '../../../_shared/components/confirm-sheet/confirm-sheet';
import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { StaleBar } from '../../../_shared/components/stale-bar/stale-bar';
import { ACTIVITY_ICONS, categoryIcon } from '../../../_shared/config/category-icons.config';
import { SearchbarLabelDirective } from '../../../_shared/directives/searchbar-label.directive';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { GROUP_AVATAR_TONE, avatarToneFor } from '../../../_shared/utils/avatar-tone.utils';
import { injectOpenDirectMessage } from '../../../_shared/utils/direct-message';
import { groupLinks } from '../../../_shared/utils/stack-paths';
import { ViewPhotoDirective } from '../../../_shared/directives/view-photo.directive';
import { PostCard } from '../_components/post-card/post-card';
import { InvitePeopleSheet } from '../_sheets/invite-people-sheet/invite-people-sheet';
import { JoinLinkSheet } from '../_sheets/join-link-sheet/join-link-sheet';
import { PostActions } from '../_sheets/post-actions/post-actions';
import { PostPermissions, postActions } from '../_sheets/post-actions/post-actions.config';
import {
  GroupActionId,
  GroupActionIds,
  MemberActionId,
  MemberActionIds,
  canDeletePost,
  canEditPost,
  canManageJoinLink,
  canPost,
  groupActions,
  groupRoleLine,
  isStaff,
  joinPolicyLabel,
  joinPolicyTone,
  memberActions,
  memberRoleLabel,
  memberRoleTone,
} from '../groups.config';
import { GroupTab, GroupTabs } from '../groups.filters';
import { GROUP_ICONS } from '../groups.icons';
import { GroupDetailStore } from './group-detail.store';

/**
 * A group, for its members: who it is (picture, name, who runs it, what it
 * trains, how many and how you get in), then Posts, Members and About.
 *
 * Every verb about the group is on the header's ⋯, by role (design
 * 2026-11-14): the owner edits, invites, answers requests, reviews posts or
 * deletes; a moderator reviews posts; a member leaves. A post's verbs are on
 * its own ⋯, a member's on their row. The work waiting on staff also shows
 * at the top of Posts, so it is seen without opening anything.
 */
@Component({
  selector: 'mh-group-detail',
  imports: [
    ActionSheet,
    ConfirmSheet,
    EmptyState,
    HexAvatar,
    InvitePeopleSheet,
    IonBackButton,
    IonBadge,
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
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    JoinLinkSheet,
    PostActions,
    PostCard,
    SearchbarLabelDirective,
    StaleBar,
    TranslatePipe,
    ViewPhotoDirective,
  ],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.scss',
  providers: [GroupDetailStore],
})
export class GroupDetail implements ViewWillEnter {
  readonly store = inject(GroupDetailStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _navController = inject(NavController);
  /** The stack the group was opened in: the Groups tab, or a profile's. */
  private readonly _links = groupLinks(this._router.url);
  readonly backHref = this._links.home;
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _authStore = inject(AuthStore);
  private readonly _categoryStore = inject(CategoryStore);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  private readonly _postActions = viewChild(PostActions);
  private readonly _inviteSheet = viewChild(InvitePeopleSheet);

  readonly Tabs = GroupTabs;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly groupTone = GROUP_AVATAR_TONE;

  readonly groupActionsOpen = signal(false);
  readonly joinLinkOpen = signal(false);
  readonly leaveOpen = signal(false);
  readonly leaving = signal(false);
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);

  readonly memberActionsOpen = signal(false);
  readonly memberInFocus = signal<GroupMember | null>(null);
  readonly removeMemberOpen = signal(false);
  readonly removingMember = signal(false);

  private readonly _viewerId = computed(() => {
    const user = this._authStore.user();
    if (!user) {
      return '';
    }
    return user.id;
  });

  readonly isPosts = computed(() => this.store.tab() === GroupTabs.Posts);
  readonly isMembers = computed(() => this.store.tab() === GroupTabs.Members);

  readonly title = computed(() => {
    const group = this.store.group();
    if (!group) {
      return this._translateService.instant('groups.common.group');
    }
    return group.name;
  });

  // ── The hero ───────────────────────────────────────────────────────────

  readonly ownerName = computed(() => {
    const owner = this.store.group()?.owner;
    if (!owner) {
      return '';
    }
    return displayName(owner, '');
  });

  readonly ownerTone = computed(() => avatarToneFor(this.store.group()?.owner?.id));

  /** What the group trains, in the list's order, with each one's glyph. */
  readonly categories = computed(() => {
    const ids = this.store.group()?.categoryIds ?? [];
    const byId = this._categoryStore.byId();
    const picked: Category[] = [];
    for (const id of ids) {
      const category = byId.get(id);
      if (category) {
        picked.push(category);
      }
    }
    return picked;
  });

  /** A glyph this build registered, never a blank box. */
  categoryIcon(name: string): string {
    return categoryIcon(name);
  }

  readonly memberCountLabel = computed(() =>
    this._translateService.instant('count.members', {
      count: this.store.group()?.memberCount ?? 0,
    }),
  );

  readonly policyLabel = computed(() => {
    const group = this.store.group();
    if (!group) {
      return '';
    }
    return joinPolicyLabel(group.joinPolicy);
  });

  readonly policyTone = computed(() => {
    const group = this.store.group();
    if (!group) {
      return 'medium';
    }
    return joinPolicyTone(group.joinPolicy);
  });

  // ── Verbs ──────────────────────────────────────────────────────────────

  readonly groupActions = computed(() => {
    const group = this.store.group();
    if (!group) {
      return [];
    }
    return groupActions(this.store.viewerRole(), group);
  });

  readonly roleLine = computed(() => groupRoleLine(this.store.viewerRole()));

  readonly isStaff = computed(() => isStaff(this.store.viewerRole()));

  readonly pendingRequests = computed(() => this.store.group()?.pendingJoinRequestCount ?? 0);
  readonly pendingPosts = computed(() => this.store.group()?.pendingPostCount ?? 0);

  readonly canShareJoinLink = computed(() =>
    canManageJoinLink(this.store.viewerRole(), this._authStore.isInstructor()),
  );

  readonly canCompose = computed(() => {
    const group = this.store.group();
    return !!group && canPost(this.store.viewerRole(), group);
  });

  readonly viewerName = computed(() => displayName(this._authStore.user(), ''));
  readonly viewerAvatar = computed(() => this._authStore.user()?.avatarUrl ?? null);
  readonly viewerTone = computed(() => avatarToneFor(this._viewerId()));

  readonly memberActions = computed(() => {
    const member = this.memberInFocus();
    if (!member) {
      return [];
    }
    return memberActions(this.store.viewerRole(), member, this._viewerId());
  });

  readonly memberInFocusName = computed(() => {
    const member = this.memberInFocus();
    if (!member) {
      return '';
    }
    return this.memberName(member);
  });

  /** What a screen reader hears once a member search settles. */
  readonly resultAnnouncement = computed(() => {
    if (!this.isMembers() || !this.store.memberQuery().trim()) {
      return '';
    }
    const count = this.store.visibleMembers().length;
    if (count === 0) {
      return this._translateService.instant('groups.detail.announce.none');
    }
    return this._translateService.instant('groups.detail.announce.count', { count });
  });

  constructor() {
    addIcons({ ...GROUP_ICONS, ...ACTIVITY_ICONS });
    this._categoryStore.ensureLoaded();

    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const groupId = params.get('groupId');
      if (groupId) {
        this.store.init(groupId);
      }
    });
  }

  // Ionic keeps the page alive in its stack; a post written or a setting
  // changed elsewhere has to show on the way back.
  ionViewWillEnter(): void {
    this.store.reenter();
  }

  setTab(value: string | number | undefined): void {
    if (value !== GroupTabs.Posts && value !== GroupTabs.Members && value !== GroupTabs.About) {
      return;
    }
    this.store.setTab(value as GroupTab);
  }

  // ── The group's ⋯ ─────────────────────────────────────────────────────

  openGroupActions(): void {
    this.groupActionsOpen.set(true);
  }

  onGroupAction(id: GroupActionId): void {
    const groupId = this.store.group()?.id ?? '';
    if (id === GroupActionIds.Edit) {
      void this._router.navigate(this._links.group(groupId, 'edit'));
      return;
    }
    if (id === GroupActionIds.Invite) {
      this.openInvite();
      return;
    }
    if (id === GroupActionIds.Requests) {
      this.openQueue('requests');
      return;
    }
    if (id === GroupActionIds.ReviewPosts) {
      this.openQueue('posts');
      return;
    }
    if (id === GroupActionIds.Delete) {
      this.deleteOpen.set(true);
      return;
    }
    this.leaveOpen.set(true);
  }

  openQueue(tab: 'requests' | 'posts'): void {
    void this._router.navigate(this._links.group(this.store.group()?.id ?? '', 'manage'), {
      queryParams: { tab },
    });
  }

  openInvite(): void {
    const sheet = this._inviteSheet();
    if (sheet) {
      sheet.show();
    }
  }

  onInvited(): void {
    this._groupsRefresh.notify();
  }

  openJoinLink(): void {
    this.joinLinkOpen.set(true);
  }

  onJoinLinkChanged(): void {
    this.store.reloadGroup();
  }

  /** "Run by": the coach's profile, in this stack. */
  openOwner(): void {
    const handle = this.store.group()?.owner?.handle;
    if (handle) {
      void this._router.navigate(this._links.person(handle));
    }
  }

  deleteGroup(): void {
    if (this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.store.deleteGroup().subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant('groups.edit.toast.deleted'),
        );
        this._leavePage();
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.edit.toast.deleteFailed'),
        );
      },
    });
  }

  leave(): void {
    if (this.leaving()) {
      return;
    }
    this.leaving.set(true);
    this.store.leave().subscribe({
      next: () => {
        this.leaving.set(false);
        this.leaveOpen.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant('groups.detail.toast.left'),
        );
        this._leavePage();
      },
      error: (error: unknown) => {
        this.leaving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.detail.toast.leaveFailed'),
        );
      },
    });
  }

  /** Out of a group you just left or closed: Groups home, or back where you came from. */
  private _leavePage(): void {
    if (this._links.inGroupsTab) {
      void this._router.navigateByUrl(this._links.home);
      return;
    }
    void this._navController.back();
  }

  // ── Posts ──────────────────────────────────────────────────────────────

  compose(): void {
    void this._router.navigate(this._links.group(this.store.group()?.id ?? '', 'compose'));
  }

  private _permissionsFor(post: Post): PostPermissions {
    const viewerId = this._viewerId();
    return {
      canEdit: canEditPost(viewerId, post.authorId),
      canDelete: canDeletePost(this.store.viewerRole(), viewerId, post.authorId),
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
    void this._router.navigate(this._links.post(postId));
  }

  commentOn(postId: string): void {
    void this._router.navigate(this._links.post(postId), { queryParams: { comment: 1 } });
  }

  openPhoto(post: Post, index: number): void {
    void this._router.navigate(this._links.post(post.id, 'photos'), {
      queryParams: { index },
    });
  }

  // ── Members ────────────────────────────────────────────────────────────

  memberName(member: GroupMember): string {
    return displayName(member.user, this._translateService.instant('groups.common.member'));
  }

  memberTone(member: GroupMember): string {
    return avatarToneFor(member.userId);
  }

  roleLabel(member: GroupMember): string {
    return memberRoleLabel(member.role);
  }

  roleTone(member: GroupMember): string {
    return memberRoleTone(member.role);
  }

  /** Whether a row has anything to offer: a profile, a message, the owner's verbs. */
  hasMemberActions(member: GroupMember): boolean {
    return memberActions(this.store.viewerRole(), member, this._viewerId()).length > 0;
  }

  openMember(member: GroupMember): void {
    if (!this.hasMemberActions(member)) {
      return;
    }
    this.memberInFocus.set(member);
    this.memberActionsOpen.set(true);
  }

  onMemberAction(id: MemberActionId): void {
    const member = this.memberInFocus();
    if (!member) {
      return;
    }
    if (id === MemberActionIds.Profile) {
      const handle = member.user?.handle;
      if (handle) {
        void this._router.navigate(this._links.person(handle));
      }
      return;
    }
    if (id === MemberActionIds.Message) {
      this._openDirectMessage({
        id: member.userId,
        firstName: member.user?.firstName,
        lastName: member.user?.lastName,
      });
      return;
    }
    if (id === MemberActionIds.Remove) {
      this.removeMemberOpen.set(true);
      return;
    }
    let role: 'MEMBER' | 'MODERATOR' = 'MEMBER';
    let done = 'groups.members.toast.moderatorRemoved';
    if (id === MemberActionIds.MakeModerator) {
      role = 'MODERATOR';
      done = 'groups.members.toast.moderatorMade';
    }
    this.store.updateMemberRole(member.userId, role).subscribe({
      next: () =>
        void this._feedbackService.success(
          this._translateService.instant(done, { name: this.memberName(member) }),
        ),
      error: (error: unknown) =>
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.members.toast.roleFailed'),
        ),
    });
  }

  removeMember(): void {
    const member = this.memberInFocus();
    if (!member || this.removingMember()) {
      return;
    }
    this.removingMember.set(true);
    this.store.removeMember(member.userId).subscribe({
      next: () => {
        this.removingMember.set(false);
        this.removeMemberOpen.set(false);
        this._groupsRefresh.notify();
        void this._feedbackService.success(
          this._translateService.instant('groups.members.toast.removed', {
            name: this.memberName(member),
          }),
        );
      },
      error: (error: unknown) => {
        this.removingMember.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('groups.members.toast.removeFailed'),
        );
      },
    });
  }

  onMemberQuery(value: string): void {
    this.store.setMemberQuery(value);
  }

  loadMoreMembers(): void {
    this.store.loadMoreMembers();
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
