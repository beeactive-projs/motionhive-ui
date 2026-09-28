import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ButtonDirective } from 'primeng/button';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  AuthStore,
  Group,
  GroupService,
  GroupsRefreshService,
  escapeHtml,
} from 'core';
import { GroupFormDialog } from '../_dialogs/group-form-dialog/group-form-dialog';
import { AddMembersDialog } from '../_dialogs/add-members-dialog/add-members-dialog';
import { GroupCard } from '../group-card/group-card';
import { GroupCardSkeleton } from '../group-card-skeleton/group-card-skeleton';
import { GroupsEmptyState } from '../groups-empty-state/groups-empty-state';

@Component({
  selector: 'mh-your-groups',
  imports: [
    ButtonDirective,
    Toast,
    ConfirmDialog,
    GroupFormDialog,
    AddMembersDialog,
    GroupCard,
    GroupCardSkeleton,
    GroupsEmptyState,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './your-groups.html',
  styleUrl: './your-groups.scss',
})
export class YourGroups implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _groupsRefreshService = inject(GroupsRefreshService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _translateService = inject(TranslateService);

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
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('groups.toast.groupsLoadFailed'),
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
          summary: this._translateService.instant('groups.toast.comingSoon.summary'),
          detail: this._translateService.instant('groups.toast.comingSoon.detail'),
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
        summary: this._translateService.instant('groups.toast.noInviteLink.summary'),
        detail: this._translateService.instant('groups.toast.noInviteLink.detail'),
      });
      return;
    }
    // `/join/:token` is where mainRoutes mounts the accept screen.
    const url = `${window.location.origin}/join/${group.joinToken}`;
    navigator.clipboard.writeText(url).then(() => {
      this._messageService.add({
        severity: 'success',
        summary: this._translateService.instant('toast.summary.copied'),
        detail: this._translateService.instant('groups.toast.inviteLinkCopied'),
      });
    });
  }

  private _confirmDelete(group: Group): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('groups.confirm.deleteGroup.header'),
      message: this._translateService.instant('groups.confirm.deleteGroup.message', {
        name: escapeHtml(group.name),
      }),
      acceptButtonProps: {
        severity: 'danger',
        label: this._translateService.instant('groups.confirm.deleteGroup.accept'),
        icon: 'pi pi-trash',
      },
      rejectButtonProps: {
        severity: 'secondary',
        label: this._translateService.instant('button.no'),
        icon: 'pi pi-times',
        outlined: true,
      },
      accept: () => this._deleteGroup(group),
    });
  }

  private _deleteGroup(group: Group): void {
    this._groupService.delete(group.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('groups.toast.groupDeleted.summary'),
          detail: this._translateService.instant('groups.toast.groupDeleted.detail', { name: group.name }),
        });
        this.loadGroups();
      },
      error: () => {
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('groups.toast.deleteGroupFailed'),
        });
      },
    });
  }
}
