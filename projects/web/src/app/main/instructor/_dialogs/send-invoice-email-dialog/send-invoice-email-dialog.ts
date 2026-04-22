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
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { InvoiceService, type Invoice } from 'core';

/**
 * Small confirmation dialog shown before firing an invoice-send request.
 *
 * The email field is pre-filled with the invoice's on-file recipient so
 * the instructor can see exactly where the invoice is going, and can
 * optionally type a different address (e.g. the client's accountant).
 * Empty submits route through Stripe's native send; overrides route
 * through our own email transport.
 */
@Component({
  selector: 'mh-send-invoice-email-dialog',
  imports: [FormsModule, Button, Dialog, InputText, MessageModule],
  templateUrl: './send-invoice-email-dialog.html',
  styleUrl: './send-invoice-email-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendInvoiceEmailDialog {
  private readonly _invoiceService = inject(InvoiceService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly invoice = input<Invoice | null>(null);
  readonly sent = output<void>();

  readonly sending = signal(false);
  readonly email = signal('');

  /** On-file email, shown as hint text and used as the field default. */
  readonly onFileEmail = computed<string>(() => {
    const inv = this.invoice();
    return inv?.client?.email ?? inv?.clientEmail ?? '';
  });

  readonly isOverride = computed<boolean>(() => {
    const typed = this.email().trim().toLowerCase();
    const onFile = this.onFileEmail().trim().toLowerCase();
    return !!typed && typed !== onFile;
  });

  /** Simple RFC-ish email check — matches what the backend enforces. */
  readonly emailLooksValid = computed<boolean>(() => {
    const v = this.email().trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });

  private readonly _syncEffect = effect(() => {
    if (this.visible()) {
      this.email.set(this.onFileEmail());
    }
  });

  onEmailChange(value: string): void {
    this.email.set(value);
  }

  send(): void {
    const inv = this.invoice();
    if (!inv) return;
    if (!this.emailLooksValid()) return;

    this.sending.set(true);
    const typed = this.email().trim();
    const override = this.isOverride() ? typed : undefined;

    this._invoiceService.send(inv.id, override).subscribe({
      next: () => {
        this.sending.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Invoice sent',
          detail: override ? `Sent to ${override}` : 'Email delivered',
        });
        this.sent.emit();
      },
      error: (err) => {
        this.sending.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Failed to send invoice',
        });
      },
    });
  }
}
