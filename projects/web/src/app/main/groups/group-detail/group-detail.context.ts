import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AuthStore,
  Group,
  GroupMember,
  GroupMemberPostPolicies,
  GroupMemberRoles,
  GroupService,
  Post,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';

@Injectable()
export class GroupDetailContext {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);

  readonly group = signal<Group | null>(null);
  readonly members = signal<GroupMember[]>([]);
  readonly myGroups = signal<Group[]>([]);

  readonly loading = signal(true);
  readonly membersLoading = signal(false);
  readonly totalMembers = signal(0);
  readonly generatingLink = signal(false);
  readonly promotingMemberId = signal<string | null>(null);

  readonly showAddMembersDialog = signal(false);
  readonly showCreatePostDialog = signal(false);
  readonly showDeletePostDialog = signal(false);
  readonly postBeingDeleted = signal<Post | null>(null);

  readonly isOwner = computed(() => {
    const group = this.group();
    const user = this._authStore.user();
    return !!group && !!user && group.instructorId === user.id;
  });

  readonly canPost = computed(() => {
    const group = this.group();
    if (!group) return false;
    if (this.isOwner()) return true;
    return group.memberPostPolicy !== GroupMemberPostPolicies.Disabled;
  });

  readonly canModerate = computed(() => {
    if (this.isOwner()) return true;
    const userId = this._authStore.user()?.id;
    if (!userId) return false;
    const me = this.members().find((m) => m.userId === userId);
    return me?.role === GroupMemberRoles.Owner || me?.role === GroupMemberRoles.Moderator;
  });

  readonly viewerRole = computed(() => {
    if (this.isOwner()) return GroupMemberRoles.Owner;
    const userId = this._authStore.user()?.id;
    if (!userId) return null;
    const me = this.members().find((m) => m.userId === userId);
    return me?.role ?? null;
  });

  readonly hasActiveJoinToken = computed(() => {
    const group = this.group();
    if (!group?.joinToken) return false;
    if (!group.joinTokenExpiresAt) return true;
    return new Date(group.joinTokenExpiresAt) > new Date();
  });

  loadGroup(groupId: string): void {
    this.loading.set(true);
    this._groupService.getById(groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Failed to load group details', '', err);
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
      error: (err) => {
        this.membersLoading.set(false);
        showApiError(this._messageService, 'Failed to load group members', '', err);
      },
    });
  }

  loadMyGroups(): void {
    this._groupService.getMyGroups().subscribe({
      next: (groups) => this.myGroups.set(groups),
      error: () => this.myGroups.set([]),
    });
  }

  refresh(): void {
    const id = this.group()?.id;
    if (!id) return;
    this.loadGroup(id);
    this.loadMembers(id);
  }

  openAddMembersDialog(): void {
    this.showAddMembersDialog.set(true);
  }

  openCreatePost(): void {
    this.showCreatePostDialog.set(true);
  }

  generateJoinLink(onLink?: (link: string) => void): void {
    const group = this.group();
    if (!group) return;

    this.generatingLink.set(true);
    this._groupService.generateJoinLink(group.id).subscribe({
      next: (response) => {
        this.generatingLink.set(false);
        const link = `${window.location.origin}/join/${response.token}`;
        this.copyToClipboard(link);
        this._messageService.add({
          severity: 'success',
          summary: 'Join link generated',
          detail: 'Link has been copied to your clipboard',
        });
        this.loadGroup(group.id);
        onLink?.(link);
      },
      error: (err) => {
        this.generatingLink.set(false);
        showApiError(this._messageService, 'Failed to generate join link', '', err);
      },
    });
  }

  copyJoinLink(): void {
    const group = this.group();
    if (!group?.joinToken) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Link unavailable',
        detail: 'Please generate a new join link to copy it.',
      });
      return;
    }
    const link = `${window.location.origin}/join/${group.joinToken}`;
    this.copyToClipboard(link);
    this._messageService.add({
      severity: 'info',
      summary: 'Copied',
      detail: 'Join link copied to clipboard',
    });
  }

  revokeJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this._confirmationService.confirm({
      message:
        'Are you sure you want to revoke the current join link? Existing links will stop working.',
      header: 'Revoke join link',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._groupService.revokeJoinLink(group.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Link revoked',
              detail: 'The join link has been revoked',
            });
            this.loadGroup(group.id);
          },
          error: (err) => {
            showApiError(this._messageService, 'Failed to revoke join link', '', err);
          },
        });
      },
    });
  }

  promoteMember(member: GroupMember): void {
    this._setRole(member, 'MODERATOR');
  }

  demoteMember(member: GroupMember): void {
    this._setRole(member, 'MEMBER');
  }

  confirmRemoveMember(member: GroupMember): void {
    const name = member.user
      ? `${member.user.firstName} ${member.user.lastName}`
      : 'this member';
    this._confirmationService.confirm({
      message: `Are you sure you want to remove ${name} from this group?`,
      header: 'Remove member',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this._removeMember(member),
    });
  }

  onPostCreated(post: Post): { post: Post } {
    return { post };
  }

  requestDeletePost(post: Post): void {
    this.postBeingDeleted.set(post);
    this.showDeletePostDialog.set(true);
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

  private _removeMember(member: GroupMember): void {
    const group = this.group();
    if (!group) return;

    this._groupService.removeMember(group.id, member.userId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Member removed',
          detail: 'Member has been removed from the group',
        });
        this.loadMembers(group.id);
        this.loadGroup(group.id);
      },
      error: (err) => {
        showApiError(this._messageService, 'Failed to remove member', '', err);
      },
    });
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: do nothing, toast already shown.
    });
  }
}
