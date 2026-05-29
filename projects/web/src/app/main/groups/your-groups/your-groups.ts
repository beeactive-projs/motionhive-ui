import { Component, ChangeDetectionStrategy, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Button } from 'primeng/button';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthStore, Group, GroupService, GroupsRefreshService } from 'core';
import { GroupFormDialog } from '../_dialogs/group-form-dialog/group-form-dialog';
import { AddMembersDialog } from '../_dialogs/add-members-dialog/add-members-dialog';
import { GroupCard } from '../group-card/group-card';
import { GroupCardSkeleton } from '../group-card-skeleton/group-card-skeleton';
import { GroupsEmptyState } from '../groups-empty-state/groups-empty-state';

@Component({
  selector: 'mh-your-groups',
  imports: [
    Button,
    Toast,
    ConfirmDialog,
    GroupFormDialog,
    AddMembersDialog,
    GroupCard,
    GroupCardSkeleton,
    GroupsEmptyState,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './your-groups.html',
  styleUrl: './your-groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YourGroups implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly isInstructor = this._authStore.isInstructor;

  groups = signal<Group[]>([]);
  loading = signal(true);

  showGroupFormDialog = signal(false);
  editingGroup = signal<Group | null>(null);
  showAddMembersDialog = signal(false);
  addMembersGroupId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadGroups();
    this._groupsRefreshService.refresh$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this.loadGroups());
  }

  loadGroups(): void {
    this.loading.set(true);
    this._groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load groups',
        });
      },
    });
  }

  openCreateDialog(): void {
    this.editingGroup.set(null);
    this.showGroupFormDialog.set(true);
  }

  onAction(event: { kind: 'invite' | 'edit' | 'share' | 'archive' | 'delete'; group: Group }): void {
    switch (event.kind) {
      case 'invite':
        this.addMembersGroupId.set(event.group.id);
        this.showAddMembersDialog.set(true);
        break;
      case 'edit':
        this.editingGroup.set(event.group);
        this.showGroupFormDialog.set(true);
        break;
      case 'share':
        this._copyInviteLink(event.group);
        break;
      case 'archive':
        this._messageService.add({
          severity: 'info',
          summary: 'Coming soon',
          detail: 'Archiving groups will be available in a future update.',
        });
        break;
      case 'delete':
        this._confirmDelete(event.group);
        break;
    }
  }

  private _copyInviteLink(group: Group): void {
    if (!group.joinToken) {
      this._messageService.add({
        severity: 'warn',
        summary: 'No invite link',
        detail: 'Generate an invite link from the group settings first.',
      });
      return;
    }
    const url = `${window.location.origin}/groups/join/${group.joinToken}`;
    navigator.clipboard.writeText(url).then(() => {
      this._messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'Invite link copied to clipboard.',
      });
    });
  }

  private _confirmDelete(group: Group): void {
    this._confirmationService.confirm({
      header: 'Delete group',
      message: `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      acceptButtonProps: { severity: 'danger', label: 'Yes, delete', icon: 'pi pi-trash' },
      rejectButtonProps: { severity: 'secondary', label: 'No', icon: 'pi pi-times', outlined: true },
      accept: () => this._deleteGroup(group),
    });
  }

  private _deleteGroup(group: Group): void {
    this._groupService.delete(group.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: 'Group deleted',
          detail: `"${group.name}" has been deleted`,
        });
        this.loadGroups();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete group',
        });
      },
    });
  }
}
