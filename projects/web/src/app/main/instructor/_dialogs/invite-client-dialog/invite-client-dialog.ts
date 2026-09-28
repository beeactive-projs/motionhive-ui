import {
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClientService,
  UserRoles,
  UserSearchResult,
  showApiError,
  validationMessage,
} from 'core';
import { MessageService, SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { UserSearchAutocomplete } from '../../../../_shared/components/user-search-autocomplete/user-search-autocomplete';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

type InviteMode = 'find' | 'email';

@Component({
  selector: 'mh-invite-client-dialog',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonDirective,
    Dialog,
    InputText,
    Message,
    SelectButton,
    TextareaModule,
    Tooltip,
    UserSearchAutocomplete,
    HexAvatar,
    TranslatePipe,
  ],
  templateUrl: './invite-client-dialog.html',
  styleUrl: './invite-client-dialog.scss',
})
export class InviteClientDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly saved = output<void>();

  readonly inviteLoading = signal(false);
  readonly invitationSent = signal(false);
  readonly referralLink = signal<string | null>(null);
  readonly linkCopied = signal(false);

  readonly mode = signal<InviteMode>('find');
  readonly selectedUser = signal<UserSearchResult | null>(null);

  readonly userRole = UserRoles.User;

  readonly modeOptions: SelectItem<InviteMode>[] = [
    {
      label: this._translateService.instant('clients.inviteDialog.mode.find'),
      value: 'find',
      icon: 'pi pi-search',
    },
    {
      label: this._translateService.instant('clients.inviteDialog.mode.email'),
      value: 'email',
      icon: 'pi pi-envelope',
    },
  ];

  readonly form = this._formBuilder.group({
    email: [''],
    message: [''],
  });

  private readonly _emailStatus = toSignal(this.form.controls.email.statusChanges, {
    initialValue: this.form.controls.email.status,
  });

  readonly canSubmit = computed(() => {
    if (this.inviteLoading()) return false;
    if (this.mode() === 'find') return !!this.selectedUser();
    return this._emailStatus() === 'VALID';
  });

  private readonly _resetOnOpenEffect = effect(() => {
    if (this.visible()) {
      this.form.reset({ email: '', message: '' });
      this.mode.set('find');
      this.selectedUser.set(null);
      this.invitationSent.set(false);
      this.referralLink.set(null);
      this.linkCopied.set(false);
      this._syncEmailValidators('find');
    }
  });

  setMode(mode: InviteMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.selectedUser.set(null);
    this.form.controls.email.reset('');
    this._syncEmailValidators(mode);
  }

  onUserSelected(user: UserSearchResult): void {
    this.selectedUser.set(user);
  }

  onUserCleared(): void {
    this.selectedUser.set(null);
  }

  displayName(user: UserSearchResult): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email;
  }

  isFieldInvalid(field: 'email'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  getFieldError(field: 'email'): string {
    return validationMessage(this.form.controls[field].errors);
  }

  sendInvitation(): void {
    if (!this.canSubmit()) {
      if (this.mode() === 'email') this.form.controls.email.markAsTouched();
      return;
    }

    const message = this.form.controls.message.value?.trim() || undefined;
    const dto =
      this.mode() === 'find' && this.selectedUser()
        ? { userId: this.selectedUser()!.id, message }
        : { email: this.form.controls.email.value!.trim(), message };

    this.inviteLoading.set(true);
    this._clientService.sendInvitation(dto).subscribe({
      next: (response) => {
        this.inviteLoading.set(false);
        this.saved.emit();
        const token = response.request.token;
        if (token) {
          this.referralLink.set(`${window.location.origin}/auth/signup?token=${token}`);
          this.invitationSent.set(true);
        } else {
          this.visible.set(false);
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('clients.toast.invitationSent.summary'),
            detail: this._translateService.instant('clients.toast.invitationSent.detail'),
          });
        }
      },
      error: (err) => {
        this.inviteLoading.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('clients.toast.sendInvitationFailed.summary'),
          this._translateService.instant('clients.toast.sendInvitationFailed.detail'),
          err,
        );
      },
    });
  }

  copyLink(): void {
    const link = this.referralLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  private _syncEmailValidators(mode: InviteMode): void {
    const emailControl = this.form.controls.email;
    if (mode === 'email') {
      emailControl.setValidators([Validators.required, Validators.email]);
    } else {
      emailControl.clearValidators();
    }
    emailControl.updateValueAndValidity();
  }
}
