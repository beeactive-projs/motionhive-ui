import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService, SelectItem } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import {
  RefundService,
  CurrencyRonPipe,
  RefundReasons,
  appLocale,
  enumLabel,
  showApiError,
  type Payment,
  type RefundReason,
} from 'core';

@Component({
  selector: 'mh-refund-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonDirective,
    Dialog,
    InputNumber,
    Select,
    TextareaModule,
    CurrencyRonPipe,
  ],
  templateUrl: './refund-dialog.html',
  styleUrl: './refund-dialog.scss',
})
export class RefundDialog {
  private readonly _refundService = inject(RefundService);
  private readonly _messageService = inject(MessageService);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly payment = input<Payment | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);

  formAmount = 0;
  formReason: RefundReason | undefined = undefined;
  formNotes = '';

  readonly reasonOptions: SelectItem<RefundReason>[] = [
    RefundReasons.RequestedByCustomer,
    RefundReasons.Duplicate,
    RefundReasons.Fraudulent,
  ].map((value) => ({ label: enumLabel('refundReason', value), value }));

  get maxRefundable(): number {
    const p = this.payment();
    if (!p) return 0;
    return (p.amountCents - p.amountRefundedCents) / 100;
  }

  private readonly _syncFormEffect = effect(() => {
    if (this.visible()) {
      this.formAmount = this.maxRefundable;
      this.formReason = undefined;
      this.formNotes = '';
    }
  });

  submit(): void {
    const p = this.payment();
    if (!p || this.formAmount <= 0) return;

    this.saving.set(true);
    this._refundService
      .create({
        paymentId: p.id,
        amountCents: Math.round(this.formAmount * 100),
        reason: this.formReason,
        notes: this.formNotes.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.saved.emit();
          const amount = this.formAmount.toLocaleString(appLocale(), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('paymentDialogs.refund.toast.issued.summary'),
            detail: this._translateService.instant('paymentDialogs.refund.toast.issued.detail', {
              amount,
              currency: p.currency,
            }),
          });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('paymentDialogs.refund.toast.failed'),
            err,
          );
        },
      });
  }
}
