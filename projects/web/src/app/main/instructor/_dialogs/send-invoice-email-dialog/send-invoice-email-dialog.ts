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
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { InvoiceService, showApiError, type Invoice } from 'core';

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
  imports: [FormsModule, TranslatePipe, ButtonDirective, Dialog, InputText, MessageModule],
  templateUrl: './send-invoice-email-dialog.html',
  styleUrl: './send-invoice-email-dialog.scss',
})
export class SendInvoiceEmailDialog {
  private readonly _invoiceService = inject(InvoiceService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

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
          summary: this._translateService.instant('paymentDialogs.sendInvoiceEmail.toast.sent.summary'),
          detail: override
            ? this._translateService.instant('paymentDialogs.sendInvoiceEmail.toast.sent.detailTo', {
                email: override,
              })
            : this._translateService.instant('paymentDialogs.sendInvoiceEmail.toast.sent.detail'),
        });
        this.sent.emit();
      },
      error: (err: unknown) => {
        this.sending.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('paymentDialogs.sendInvoiceEmail.toast.failed'),
          err,
        );
      },
    });
  }
}
