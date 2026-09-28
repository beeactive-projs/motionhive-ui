import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
  AuthStore,
  Group,
  GroupMember,
  GroupMemberPostPolicies,
  GroupMemberRoles,
  GroupService,
  GroupsRefreshService,
  Post,
  showApiError,
  UpdateMemberRolePayload,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';

@Injectable()
export class GroupDetailContext {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);
  private readonly _translateService = inject(TranslateService);

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
  readonly showEditPostDialog = signal(false);
  readonly postBeingEdited = signal<Post | null>(null);

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

  readonly canLeave = computed(() => {
    if (this.isOwner()) return false;
    return this.viewerRole() !== null;
  });

  readonly hasActiveJoinToken = computed(() => {
    const group = this.group();
    if (!group?.joinToken) return false;
    if (!group.joinTokenExpiresAt) return true;
    return new Date(group.joinTokenExpiresAt) > new Date();
  });

  loadGroup(groupId: string): void {
    if (this.group()?.id !== groupId) {
      this.members.set([]);
      this.totalMembers.set(0);
    }
    this.loading.set(true);
    this._groupService.getById(groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.detailsLoadFailed'),
          '',
          err,
        );
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
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.membersLoadFailed'),
          '',
          err,
        );
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
          summary: this._translateService.instant('groups.toast.joinLinkGenerated.summary'),
          detail: this._translateService.instant('groups.toast.joinLinkGenerated.detail'),
        });
        this.loadGroup(group.id);
        onLink?.(link);
      },
      error: (err) => {
        this.generatingLink.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.generateLinkFailed'),
          '',
          err,
        );
      },
    });
  }

  copyJoinLink(): void {
    const group = this.group();
    if (!group?.joinToken) {
      this._messageService.add({
        severity: 'warn',
        summary: this._translateService.instant('groups.toast.linkUnavailable.summary'),
        detail: this._translateService.instant('groups.toast.linkUnavailable.detail'),
      });
      return;
    }
    const link = `${window.location.origin}/join/${group.joinToken}`;
    this.copyToClipboard(link);
    this._messageService.add({
      severity: 'info',
      summary: this._translateService.instant('toast.summary.copied'),
      detail: this._translateService.instant('groups.toast.joinLinkCopied'),
    });
  }

  revokeJoinLink(): void {
    const group = this.group();
    if (!group) return;

    this._confirmationService.confirm({
      message: this._translateService.instant('groups.confirm.revokeLink.message'),
      header: this._translateService.instant('groups.confirm.revokeLink.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._groupService.revokeJoinLink(group.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('groups.toast.linkRevoked.summary'),
              detail: this._translateService.instant('groups.toast.linkRevoked.detail'),
            });
            this.loadGroup(group.id);
          },
          error: (err) => {
            showApiError(
              this._messageService,
              this._translateService.instant('groups.toast.revokeLinkFailed'),
              '',
              err,
            );
          },
        });
      },
    });
  }

  leaveGroup(): void {
    const group = this.group();
    if (!group) return;

    this._confirmationService.confirm({
      message: this._translateService.instant('groups.confirm.leave.message', { name: group.name }),
      header: this._translateService.instant('groups.confirm.leave.header'),
      icon: 'pi pi-sign-out',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._groupService.leaveGroup(group.id).subscribe({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: this._translateService.instant('groups.toast.left.summary'),
              detail: this._translateService.instant('groups.toast.left.detail', { name: group.name }),
            });
            this._groupsRefreshService.notify();
            this._router.navigate(['/groups']);
          },
          error: (err) => {
            showApiError(
              this._messageService,
              this._translateService.instant('groups.toast.leaveFailed'),
              '',
              err,
            );
          },
        });
      },
    });
  }

  promoteMember(member: GroupMember): void {
    this._setRole(member, GroupMemberRoles.Moderator);
  }

  demoteMember(member: GroupMember): void {
    this._setRole(member, GroupMemberRoles.Member);
  }

  confirmRemoveMember(member: GroupMember): void {
    const message = member.user
      ? this._translateService.instant('groups.confirm.removeMember.message', {
          name: `${member.user.firstName} ${member.user.lastName}`,
        })
      : this._translateService.instant('groups.confirm.removeMember.messageUnknown');
    this._confirmationService.confirm({
      message,
      header: this._translateService.instant('groups.confirm.removeMember.header'),
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

  requestEditPost(post: Post): void {
    this.postBeingEdited.set(post);
    this.showEditPostDialog.set(true);
  }

  private _setRole(member: GroupMember, role: UpdateMemberRolePayload['role']): void {
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
          summary: this._translateService.instant(
            role === GroupMemberRoles.Moderator
              ? 'groups.toast.memberPromoted'
              : 'groups.toast.memberDemoted',
          ),
        });
      },
      error: (err) => {
        this.promotingMemberId.set(null);
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.changeRoleFailed'),
          '',
          err,
        );
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
          summary: this._translateService.instant('groups.toast.memberRemoved.summary'),
          detail: this._translateService.instant('groups.toast.memberRemoved.detail'),
        });
        this.loadMembers(group.id);
        this.loadGroup(group.id);
      },
      error: (err) => {
        showApiError(
          this._messageService,
          this._translateService.instant('groups.toast.removeMemberFailed'),
          '',
          err,
        );
      },
    });
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: do nothing, toast already shown.
    });
  }
}
