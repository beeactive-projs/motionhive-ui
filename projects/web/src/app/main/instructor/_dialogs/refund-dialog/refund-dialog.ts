import {
  ChangeDetectionStrategy,
  Component,
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
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import {
  RefundService,
  CurrencyRonPipe,
  RefundReasons,
  type Payment,
  type RefundReason,
} from 'core';

@Component({
  selector: 'mh-refund-dialog',
  imports: [FormsModule, Button, Dialog, InputNumber, Select, TextareaModule, CurrencyRonPipe],
  templateUrl: './refund-dialog.html',
  styleUrl: './refund-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefundDialog {
  private readonly _refundService = inject(RefundService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly payment = input<Payment | null>(null);
  readonly saved = output<void>();

  readonly saving = signal(false);

  formAmount = 0;
  formReason: RefundReason | undefined = undefined;
  formNotes = '';

  readonly reasonOptions = [
    { label: 'Requested by customer', value: RefundReasons.RequestedByCustomer },
    { label: 'Duplicate', value: RefundReasons.Duplicate },
    { label: 'Fraudulent', value: RefundReasons.Fraudulent },
  ];

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
          this._messageService.add({
            severity: 'success',
            summary: 'Refund issued',
            detail: `Refund of ${this.formAmount.toFixed(2)} ${p.currency} has been issued`,
          });
        },
        error: (err) => {
          this.saving.set(false);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to issue refund',
          });
        },
      });
  }
}
