import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientService } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'mh-invite-client-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputText, TextareaModule, Message, Tooltip],
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

  readonly form = this._formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    message: [''],
  });

  private readonly _resetOnOpenEffect = effect(() => {
    if (this.visible()) {
      this.form.reset();
      this.invitationSent.set(false);
      this.referralLink.set(null);
      this.linkCopied.set(false);
    }
  });

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Email address is required.';
    if (control.errors['email']) return 'Please enter a valid email address.';
    return '';
  }

  sendInvitation(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { email, message } = this.form.getRawValue();

    this.inviteLoading.set(true);
    this._clientService
      .sendInvitation({
        email: email!.trim(),
        message: message?.trim() || undefined,
      })
      .subscribe({
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
