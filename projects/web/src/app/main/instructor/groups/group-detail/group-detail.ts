import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuthStore,
  Group,
  GroupMember,
  GroupMemberPostPolicies,
  GroupMemberRoles,
  GroupService,
  JoinPolicy,
  Post,
  showApiError,
  TagSeverity,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AddMembersDialog } from '../../_dialogs/add-members-dialog/add-members-dialog';
import { CreatePostDialog } from '../../_dialogs/create-post-dialog/create-post-dialog';
import { DeletePostDialog } from '../../_dialogs/delete-post-dialog/delete-post-dialog';
import { PostFeed } from './_components/post-feed/post-feed';
import { PostPendingQueue } from './_components/post-pending-queue/post-pending-queue';

@Component({
  selector: 'mh-group-detail',
  imports: [
    DatePipe,
    ButtonModule,
    TagModule,
    TableModule,
    AvatarModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    AddMembersDialog,
    CreatePostDialog,
    DeletePostDialog,
    PostFeed,
    PostPendingQueue,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetail implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  readonly postFeed = viewChild(PostFeed);

  readonly GroupMemberRoles = GroupMemberRoles;
  readonly activeTab = signal<string | number | undefined>('discussion');

  group = signal<Group | null>(null);
  members = signal<GroupMember[]>([]);
  loading = signal(true);
  membersLoading = signal(true);
  totalMembers = signal(0);
  generatingLink = signal(false);
  showAddMembersDialog = signal(false);
  joinLink = signal<string | null>(null);

  // ── Posts wiring ─────────────────────────
  myGroups = signal<Group[]>([]);
  showCreatePostDialog = signal(false);
  showDeletePostDialog = signal(false);
  postBeingDeleted = signal<Post | null>(null);
  promotingMemberId = signal<string | null>(null);

  groupName = computed(() => this.group()?.name ?? 'Group');
  isGroupOwner = computed(() => {
    const group = this.group();
    const user = this._authStore.user();
    return !!group && !!user && group.instructorId === user.id;
  });

  /** A post can be created when the viewer is owner, OR the group allows non-owner posting. */
  canPost = computed(() => {
    const group = this.group();
    if (!group) return false;
    if (this.isGroupOwner()) return true;
    return group.memberPostPolicy !== GroupMemberPostPolicies.Disabled;
  });

  /** OWNER/MODERATOR of *this* group (used to gate the moderation queue + delete-as-mod). */
  canModerate = computed(() => {
    if (this.isGroupOwner()) return true;
    const userId = this._authStore.user()?.id;
    if (!userId) return false;
    const me = this.members().find((m) => m.userId === userId);
    return me?.role === GroupMemberRoles.Owner || me?.role === GroupMemberRoles.Moderator;
  });

  readonly memberRows = 10;

  ngOnInit(): void {
    const groupId = this._route.snapshot.paramMap.get('id');
    if (groupId) {
      this.loadGroup(groupId);
      this.loadMembers(groupId);
      this.loadMyGroups();
    }
  }

  loadGroup(groupId: string): void {
    this.loading.set(true);
    this._groupService.getById(groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load group details',
        });
      },
    });
  }

  loadMembers(groupId: string): void {
    this.membersLoading.set(true);
    this._groupService.getMembers(groupId).subscribe({
      next: (response) => {
        this.members.set(response.items);
        this.totalMembers.set(response.total);
        this.membersLoading.set(false);
      },
      error: () => {
        this.membersLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load group members',
        });
      },
    });
  }

  loadMyGroups(): void {
    this._groupService.getMyGroups().subscribe({
      next: (groups) => this.myGroups.set(groups),
      // Silently fail — the create-post dialog will show "no groups" if needed.
      error: () => this.myGroups.set([]),
    });
  }

  openAddMembersDialog(): void {
    this.showAddMembersDialog.set(true);
  }

  goBack(): void {
    this._router.navigate(['coaching/groups']);
  }

  generateJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this.generatingLink.set(true);
    this._groupService.generateJoinLink(group.id).subscribe({
      next: (response) => {
        this.generatingLink.set(false);
        const link = `${window.location.origin}/join/${response.token}`;
        this.joinLink.set(link);
        this.copyToClipboard(link);
        this._messageService.add({
          severity: 'success',
          summary: 'Join Link Generated',
          detail: 'Link has been copied to your clipboard',
        });
      },
      error: () => {
        this.generatingLink.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to generate join link',
        });
      },
    });
  }

  revokeJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this._confirmationService.confirm({
      message:
        'Are you sure you want to revoke the current join link? Existing links will stop working.',
      header: 'Revoke Join Link',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._groupService.revokeJoinLink(group.id).subscribe({
          next: () => {
            this.joinLink.set(null);
            this._messageService.add({
              severity: 'success',
              summary: 'Link Revoked',
              detail: 'The join link has been revoked',
            });
            this.loadGroup(group.id);
          },
          error: () => {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to revoke join link',
            });
          },
        });
      },
    });
  }

  copyExistingLink(): void {
    const link = this.joinLink();
    if (link) {
      this.copyToClipboard(link);
      this._messageService.add({
        severity: 'info',
        summary: 'Copied',
        detail: 'Join link copied to clipboard',
      });
    } else {
      this._messageService.add({
        severity: 'warn',
        summary: 'Link Unavailable',
        detail: 'Please generate a new join link to copy it.',
      });
    }
  }

  confirmRemoveMember(member: GroupMember): void {
    const name = member.user ? `${member.user.firstName} ${member.user.lastName}` : 'this member';
    this._confirmationService.confirm({
      message: `Are you sure you want to remove ${name} from this group?`,
      header: 'Remove Member',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.removeMember(member),
    });
  }

  private removeMember(member: GroupMember): void {
    const group = this.group();
    if (!group) return;

    this._groupService.removeMember(group.id, member.userId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Member Removed',
          detail: 'Member has been removed from the group',
        });
        this.loadMembers(group.id);
        this.loadGroup(group.id);
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to remove member',
        });
      },
    });
  }

  // ── Promote / demote ─────────────────────

  promoteMember(member: GroupMember): void {
    this._setRole(member, 'MODERATOR');
  }

  demoteMember(member: GroupMember): void {
    this._setRole(member, 'MEMBER');
  }

  private _setRole(member: GroupMember, role: 'MEMBER' | 'MODERATOR'): void {
    const group = this.group();
    if (!group) return;
    this.promotingMemberId.set(member.userId);
    this._groupService.updateMemberRole(group.id, member.userId, { role }).subscribe({
      next: (updated) => {
        this.promotingMemberId.set(null);
        this.members.update((list) =>
          list.map((m) => (m.userId === member.userId ? { ...m, ...updated } : m)),
        );
        this._messageService.add({
          severity: 'success',
          summary: role === 'MODERATOR' ? 'Member promoted' : 'Member demoted',
        });
      },
      error: (err) => {
        this.promotingMemberId.set(null);
        showApiError(this._messageService, 'Could not change role', '', err);
      },
    });
  }

  // ── Posts ────────────────────────────────

  openCreatePost(): void {
    this.showCreatePostDialog.set(true);
  }

  onPostCreated(post: Post): void {
    this.postFeed()?.prependPost(post);
  }

  onDeleteRequested(post: Post): void {
    this.postBeingDeleted.set(post);
    this.showDeletePostDialog.set(true);
  }

  onPostDeleted(result: { post: 'kept' | 'deleted'; postId: string }): void {
    if (result.post === 'deleted') {
      this.postFeed()?.removePost(result.postId);
    } else {
      // The post still exists in *some* group; if it's no longer in *this*
      // group, drop it from the local feed. Easiest: refetch.
      this.postFeed()?.load();
    }
  }

  joinPolicySeverity(policy: JoinPolicy): TagSeverity {
    switch (policy) {
      case 'OPEN':
        return TagSeverity.Success;
      case 'APPROVAL':
        return TagSeverity.Warn;
      case 'INVITE_ONLY':
        return TagSeverity.Info;
    }
  }

  joinPolicyLabel(policy: JoinPolicy): string {
    switch (policy) {
      case 'OPEN':
        return 'Open';
      case 'APPROVAL':
        return 'Approval Required';
      case 'INVITE_ONLY':
        return 'Invite Only';
    }
  }

  memberRoleSeverity(role: string): TagSeverity {
    if (role === GroupMemberRoles.Owner) return TagSeverity.Warn;
    if (role === GroupMemberRoles.Moderator) return TagSeverity.Info;
    return TagSeverity.Secondary;
  }

  memberRoleLabel(role: string): string {
    if (role === GroupMemberRoles.Owner) return 'Owner';
    if (role === GroupMemberRoles.Moderator) return 'Moderator';
    return 'Member';
  }

  memberName(member: GroupMember): string {
    if (!member.user) return 'Unknown';
    return `${member.user.firstName} ${member.user.lastName}`;
  }

  memberInitials(member: GroupMember): string {
    if (!member.user) return '??';
    return member.user.firstName.charAt(0) + member.user.lastName.charAt(0);
  }

  hasActiveJoinToken(): boolean {
    const group = this.group();
    if (!group?.joinToken) return false;
    if (!group.joinTokenExpiresAt) return true;
    return new Date(group.joinTokenExpiresAt) > new Date();
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: do nothing, toast already shown
    });
  }

  trackById = (_: number, item: { id: string }) => item.id;
  trackByUserId = (_: number, item: GroupMember) => item.userId;
}
