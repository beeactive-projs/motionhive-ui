import {
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CreateGroupPayload,
  Group,
  GroupService,
  JoinPolicies,
  JoinPolicy,
  UpdateGroupPayload,
} from 'core';
import { MessageService, SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

@Component({
  selector: 'mh-group-form-dialog',
  imports: [
    FormsModule,
    ButtonDirective,
    Chip,
    Dialog,
    InputText,
    Select,
    TextareaModule,
    ToggleSwitch,
    TranslatePipe,
  ],
  templateUrl: './group-form-dialog.html',
  styleUrl: './group-form-dialog.scss',
})
export class GroupFormDialog {
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly group = input<Group | null>(null);
  readonly saved = output<void>();

  formName = '';
  formDescription = '';
  formJoinPolicy: JoinPolicy = JoinPolicies.Open;
  formIsPublic = true;
  formTags: string[] = [];
  formTagInput = '';
  readonly saving = signal(false);

  readonly dialogHeader = computed(() =>
    this._translateService.instant(this.group() ? 'groups.common.editGroup' : 'groups.formDialog.create'),
  );

  readonly joinPolicyOptions: SelectItem<JoinPolicy>[] = [
    JoinPolicies.Open,
    JoinPolicies.Approval,
    JoinPolicies.InviteOnly,
  ].map((value) => ({ label: this._translateService.instant(`groups.joinPolicyLong.${value}`), value }));

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
            summary: this._translateService.instant('groups.toast.groupCreated.summary'),
            detail: this._translateService.instant('groups.toast.groupCreated.detail'),
          });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: this._translateService.instant('toast.summary.error'),
            detail: err.error?.message || this._translateService.instant('groups.toast.groupCreateFailed'),
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
            summary: this._translateService.instant('groups.toast.groupUpdated.summary'),
            detail: this._translateService.instant('groups.toast.groupUpdated.detail'),
          });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: this._translateService.instant('toast.summary.error'),
            detail: err.error?.message || this._translateService.instant('groups.toast.groupUpdateFailed'),
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
    this.formJoinPolicy = JoinPolicies.Open;
    this.formIsPublic = true;
    this.formTags = [];
    this.formTagInput = '';
  }
}
