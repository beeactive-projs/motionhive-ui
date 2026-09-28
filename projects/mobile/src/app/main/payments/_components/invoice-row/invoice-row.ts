import { Component, computed, inject, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyRonPipe, Invoice, InvoiceStatuses, appLocale, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { invoiceStatusStyle, isOverdue } from '../../payments.config';

/**
 * One invoice, from either side.
 *
 * The anatomy is shared because an invoice looks the same to both parties —
 * a person, what it is for, when it is due, and how much. What differs is who
 * the person is: the coach's list leads with who owes them, the client's with
 * who is asking. `party` decides that, so neither list needs its own row.
 *
 * The amount always carries its currency code. A client can hold invoices in
 * more than one, and a bare number invites adding them up.
 */
@Component({
  selector: 'mh-invoice-row',
  imports: [
    CurrencyRonPipe,
    HexAvatar,
    IonBadge,
    IonIcon,
    IonItem,
    IonLabel,
    IonNote,
    TranslatePipe,
  ],
  templateUrl: './invoice-row.html',
  styleUrl: './invoice-row.scss',
  host: {
    '[attr.data-tone]': 'tone()',
  },
})
export class InvoiceRow {
  private readonly _translateService = inject(TranslateService);

  readonly invoice = input.required<Invoice>();
  /** Whose name to lead with — the other side of this invoice. */
  readonly party = input<'client' | 'instructor'>('client');
  readonly select = output<void>();

  private readonly _person = computed(() =>
    this.party() === 'client' ? this.invoice().client : this.invoice().instructor,
  );

  readonly personName = computed(() =>
    displayName(this._person() ?? null, this.invoice().clientEmail || this._translateService.instant('common.someone')),
  );

  readonly avatarUrl = computed(() => this._person()?.avatarUrl ?? null);

  readonly personTone = computed(() => avatarToneFor(this._person()?.id ?? undefined));

  readonly style = computed(() => invoiceStatusStyle(this.invoice().status));

  readonly overdue = computed(() =>
    isOverdue(this.invoice().status, this.invoice().dueDate),
  );

  /** Overdue overrides the status tone — it is the one thing worth a jolt. */
  readonly tone = computed(() => (this.overdue() ? 'coral' : this.style().tone));

  readonly reference = computed(
    () =>
      this.invoice().number ??
      this.invoice().description ??
      this._translateService.instant('payments.fallback.invoice'),
  );

  readonly dueLabel = computed(() => {
    const invoice = this.invoice();
    if (invoice.status === InvoiceStatuses.Paid) {
      return invoice.paidAt
        ? this._translateService.instant('payments.row.paidOn', {
            date: this._short(invoice.paidAt),
          })
        : this._translateService.instant('enum.invoiceStatus.paid');
    }
    if (!invoice.dueDate) return '';
    return this._translateService.instant(
      this.overdue() ? 'payments.row.wasDue' : 'payments.row.due',
      { date: this._short(invoice.dueDate) },
    );
  });

  private _short(iso: string): string {
    return new Date(iso).toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'short',
    });
  }
}
