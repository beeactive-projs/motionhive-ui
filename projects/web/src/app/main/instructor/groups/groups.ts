import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ChipModule } from 'primeng/chip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupService, Group, CreateGroupPayload, UpdateGroupPayload, JoinPolicy } from 'core';

type TagSeverity =
  | 'success'
  | 'warn'
  | 'danger'
  | 'secondary'
  | 'info'
  | 'contrast'
  | null
  | undefined;

interface JoinPolicyOption {
  label: string;
  value: JoinPolicy;
}

@Component({
  selector: 'bee-groups',
  imports: [
    FormsModule,
    CardModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    ConfirmDialogModule,
    ToggleSwitchModule,
    ChipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups implements OnInit {
  private groupService = inject(GroupService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  groups = signal<Group[]>([]);
  loading = signal(true);

  // Dialog state
  showDialog = signal(false);
  dialogMode = signal<'create' | 'edit'>('create');
  editingGroup = signal<Group | null>(null);
  saving = signal(false);

  // Form fields
  formName = '';
  formDescription = '';
  formJoinPolicy: JoinPolicy = 'OPEN';
  formIsPublic = true;
  formTags: string[] = [];
  formTagInput = '';

  readonly joinPolicyOptions: JoinPolicyOption[] = [
    { label: 'Open', value: 'OPEN' },
    { label: 'Approval Required', value: 'APPROVAL' },
    { label: 'Invite Only', value: 'INVITE_ONLY' },
  ];

  dialogHeader = computed(() => (this.dialogMode() === 'create' ? 'Create Group' : 'Edit Group'));

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading.set(true);
    this.groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load groups',
        });
      },
    });
  }

  openCreateDialog(): void {
    this.dialogMode.set('create');
    this.editingGroup.set(null);
    this.resetForm();
    this.showDialog.set(true);
  }

  openEditDialog(event: Event, group: Group): void {
    event.stopPropagation();
    this.dialogMode.set('edit');
    this.editingGroup.set(group);
    this.formName = group.name;
    this.formDescription = group.description || '';
    this.formJoinPolicy = group.joinPolicy;
    this.formIsPublic = group.isPublic;
    this.formTags = [...(group.tags || [])];
    this.formTagInput = '';
    this.showDialog.set(true);
  }

  saveGroup(): void {
    if (!this.formName.trim()) return;

    this.saving.set(true);

    if (this.dialogMode() === 'create') {
      const payload: CreateGroupPayload = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        joinPolicy: this.formJoinPolicy,
        isPublic: this.formIsPublic,
        tags: this.formTags.length > 0 ? this.formTags : undefined,
      };

      this.groupService.create(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.showDialog.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Group Created',
            detail: 'Your new group has been created successfully',
          });
          this.loadGroups();
        },
        error: (err) => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to create group',
          });
        },
      });
    } else {
      const group = this.editingGroup();
      if (!group) return;

      const payload: UpdateGroupPayload = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        joinPolicy: this.formJoinPolicy,
        isPublic: this.formIsPublic,
        tags: this.formTags,
      };

      this.groupService.update(group.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.showDialog.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Group Updated',
            detail: 'Group has been updated successfully',
          });
          this.loadGroups();
        },
        error: (err) => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to update group',
          });
        },
      });
    }
  }

  confirmDelete(event: Event, group: Group): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      header: 'Delete Group',
      message: `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,

      // icon: 'pi pi-exclamation-triangle',
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
    this.groupService.delete(group.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Group Deleted',
          detail: `"${group.name}" has been deleted`,
        });
        this.loadGroups();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete group',
        });
      },
    });
  }

  navigateToGroup(group: Group): void {
    this.router.navigate(['/app/groups', group.id]);
  }

  addTag(): void {
    const tag = this.formTagInput.trim();
    if (tag && !this.formTags.includes(tag)) {
      this.formTags = [...this.formTags, tag];
    }
    this.formTagInput = '';
  }

  removeTag(tag: string): void {
    this.formTags = this.formTags.filter((t) => t !== tag);
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  descriptionExcerpt(description: string | null): string {
    if (!description) return 'No description';
    return description.length > 100 ? description.substring(0, 100) + '...' : description;
  }

  joinPolicySeverity(policy: JoinPolicy): TagSeverity {
    switch (policy) {
      case 'OPEN':
        return 'success';
      case 'APPROVAL':
        return 'warn';
      case 'INVITE_ONLY':
        return 'info';
    }
  }

  joinPolicyLabel(policy: JoinPolicy): string {
    switch (policy) {
      case 'OPEN':
        return 'Open';
      case 'APPROVAL':
        return 'Approval';
      case 'INVITE_ONLY':
        return 'Invite Only';
    }
  }

  private resetForm(): void {
    this.formName = '';
    this.formDescription = '';
    this.formJoinPolicy = 'OPEN';
    this.formIsPublic = true;
    this.formTags = [];
    this.formTagInput = '';
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
