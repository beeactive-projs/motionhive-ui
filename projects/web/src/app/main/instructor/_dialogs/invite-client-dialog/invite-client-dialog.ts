import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientService, UserSearchResult, UserRoles } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { UserSearchAutocomplete } from '../../../../_shared/components/user-search-autocomplete/user-search-autocomplete';

type InviteMode = 'find' | 'email';

@Component({
  selector: 'mh-invite-client-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    TextareaModule,
    Message,
    Tooltip,
    UserSearchAutocomplete,
  ],
  templateUrl: './invite-client-dialog.html',
  styleUrl: './invite-client-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteClientDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);

  readonly visible = model(false);
  readonly saved = output<void>();

  readonly inviteLoading = signal(false);
  readonly invitationSent = signal(false);
  readonly referralLink = signal<string | null>(null);
  readonly linkCopied = signal(false);

  readonly mode = signal<InviteMode>('find');
  readonly selectedUser = signal<UserSearchResult | null>(null);

  readonly userRole = UserRoles.User;

  readonly form = this._formBuilder.group({
    email: ['', [Validators.email]],
    message: [''],
  });

  readonly canSubmit = computed(() => {
    if (this.inviteLoading()) return false;
    if (this.mode() === 'find') return !!this.selectedUser();
    const email = this.form.controls.email.value?.trim() ?? '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });

  private readonly _resetOnOpenEffect = effect(() => {
    if (this.visible()) {
      this.form.reset({ email: '', message: '' });
      this.mode.set('find');
      this.selectedUser.set(null);
      this.invitationSent.set(false);
      this.referralLink.set(null);
      this.linkCopied.set(false);
    }
  });

  setMode(mode: InviteMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.selectedUser.set(null);
    this.form.controls.email.reset('');
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

  isEmailFieldInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
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
            summary: 'Invitation sent',
            detail: 'Client invitation has been sent successfully',
          });
        }
      },
      error: (err) => {
        this.inviteLoading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to send invitation',
        });
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
}
