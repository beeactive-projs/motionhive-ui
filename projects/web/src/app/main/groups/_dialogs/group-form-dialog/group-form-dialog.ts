import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateGroupPayload, Group, GroupService, JoinPolicy, UpdateGroupPayload } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

interface JoinPolicyOption {
  label: string;
  value: JoinPolicy;
}

@Component({
  selector: 'mh-group-form-dialog',
  imports: [FormsModule, Button, Chip, Dialog, InputText, Select, TextareaModule, ToggleSwitch],
  templateUrl: './group-form-dialog.html',
  styleUrl: './group-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupFormDialog {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly group = input<Group | null>(null);
  readonly saved = output<void>();

  formName = '';
  formDescription = '';
  formJoinPolicy: JoinPolicy = 'OPEN';
  formIsPublic = true;
  formTags: string[] = [];
  formTagInput = '';
  readonly saving = signal(false);

  readonly dialogHeader = computed(() => (this.group() ? 'Edit group' : 'Create group'));

  readonly joinPolicyOptions: JoinPolicyOption[] = [
    { label: 'Open', value: 'OPEN' },
    { label: 'Approval required', value: 'APPROVAL' },
    { label: 'Invite only', value: 'INVITE_ONLY' },
  ];

  private readonly _syncFormEffect = effect(() => {
    const group = this.group();
    if (this.visible()) {
      if (group) {
        this.formName = group.name;
        this.formDescription = group.description || '';
        this.formJoinPolicy = group.joinPolicy;
        this.formIsPublic = group.isPublic;
        this.formTags = [...(group.tags || [])];
        this.formTagInput = '';
      } else {
        this._resetForm();
      }
    }
  });

  saveGroup(): void {
    if (!this.formName.trim()) return;

    this.saving.set(true);
    const group = this.group();

    if (!group) {
      const payload: CreateGroupPayload = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        joinPolicy: this.formJoinPolicy,
        isPublic: this.formIsPublic,
        tags: this.formTags.length > 0 ? this.formTags : undefined,
      };

      this._groupService.create(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Group created',
            detail: 'Your new group has been created successfully',
          });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to create group',
          });
        },
      });
    } else {
      const payload: UpdateGroupPayload = {
        name: this.formName.trim(),
        description: this.formDescription.trim() || undefined,
        joinPolicy: this.formJoinPolicy,
        isPublic: this.formIsPublic,
        tags: this.formTags,
      };

      this._groupService.update(group.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Group updated',
            detail: 'Group has been updated successfully',
          });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to update group',
          });
        },
      });
    }
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

  private _resetForm(): void {
    this.formName = '';
    this.formDescription = '';
    this.formJoinPolicy = 'OPEN';
    this.formIsPublic = true;
    this.formTags = [];
    this.formTagInput = '';
  }
}
