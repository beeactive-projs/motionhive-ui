import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { Skeleton } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthStore, Group, GroupService, joinPolicyLabel, joinPolicySeverity } from 'core';
import { GroupFormDialog } from '../_dialogs/group-form-dialog/group-form-dialog';
import { AddMembersDialog } from '../_dialogs/add-members-dialog/add-members-dialog';

@Component({
  selector: 'mh-your-groups',
  imports: [
    CardModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    Skeleton,
    GroupFormDialog,
    AddMembersDialog,
    RouterLink,
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
  private readonly _router = inject(Router);
  private readonly _authStore = inject(AuthStore);

  readonly isInstructor = this._authStore.isInstructor;
  readonly joinPolicyLabel = joinPolicyLabel;
  readonly joinPolicySeverity = joinPolicySeverity;

  groups = signal<Group[]>([]);
  loading = signal(true);

  showGroupFormDialog = signal(false);
  editingGroup = signal<Group | null>(null);
  showAddMembersDialog = signal(false);
  addMembersGroupId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadGroups();
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

  openAddMembersDialog(event: Event, group: Group): void {
    event.stopPropagation();
    this.addMembersGroupId.set(group.id);
    this.showAddMembersDialog.set(true);
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
      rejectButtonStyleClass: 'p-button-contrast',
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
    this._router.navigate(['/groups', group.id]);
  }

  isOwner(group: Group): boolean {
    return group.instructorId === this._authStore.user()?.id;
  }

  descriptionExcerpt(description: string | null): string {
    if (!description) return 'No description';
    return description.length > 100 ? description.substring(0, 100) + '...' : description;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
