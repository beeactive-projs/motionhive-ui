import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupService, Group, JoinPolicy, TagSeverity } from 'core';
import { GroupFormDialog } from '../_dialogs/group-form-dialog/group-form-dialog';

@Component({
  selector: 'mh-groups',
  imports: [CardModule, ButtonModule, TagModule, ToastModule, ConfirmDialogModule, GroupFormDialog],
  providers: [MessageService, ConfirmationService],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups implements OnInit {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _router = inject(Router);

  groups = signal<Group[]>([]);
  loading = signal(true);

  // Dialog visibility
  showGroupFormDialog = signal(false);
  editingGroup = signal<Group | null>(null);

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading.set(true);
    this._groupService.getInstructorsGroups().subscribe({
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

  openEditDialog(event: Event, group: Group): void {
    event.stopPropagation();
    this.editingGroup.set(group);
    this.showGroupFormDialog.set(true);
  }

  confirmDelete(event: Event, group: Group): void {
    event.stopPropagation();
    this._confirmationService.confirm({
      header: 'Delete group',
      message: `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      acceptLabel: 'Yes, delete',
      rejectLabel: 'No',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'pi pi-times',
      accept: () => this.deleteGroup(group),
    });
  }

  private deleteGroup(group: Group): void {
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

  navigateToGroup(group: Group): void {
    this._router.navigate(['coaching/groups', group.id]);
  }

  descriptionExcerpt(description: string | null): string {
    if (!description) return 'No description';
    return description.length > 100 ? description.substring(0, 100) + '...' : description;
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
        return 'Approval';
      case 'INVITE_ONLY':
        return 'Invite only';
    }
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
