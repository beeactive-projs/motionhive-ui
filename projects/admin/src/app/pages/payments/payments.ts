import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { AuthStore, showApiError } from 'core';
import { AdminOpsService } from '../../_data/services/admin-ops.service';
import { DbRow } from '../../_data/models/admin.models';
import { PaymentsResource } from '../../_data/models/ops.models';

interface ColumnDef {
  path: string;
  label: string;
  /** Render `path` (cents) as a formatted currency amount using `currency`. */
  money?: boolean;
}

const COLUMNS: Record<PaymentsResource, ColumnDef[]> = {
  accounts: [
    { path: 'user.email', label: 'User' },
    { path: 'stripeAccountId', label: 'Stripe acct' },
    { path: 'chargesEnabled', label: 'Charges' },
    { path: 'payoutsEnabled', label: 'Payouts' },
    { path: 'detailsSubmitted', label: 'Onboarded' },
    { path: 'country', label: 'Country' },
    { path: 'disabledReason', label: 'Disabled' },
  ],
  subscriptions: [
    // customerEmail = registered client OR the stripe_customer (guest).
    { path: 'customerEmail', label: 'Client' },
    { path: 'status', label: 'Status' },
    { path: 'amountCents', label: 'Amount', money: true },
    { path: 'currentPeriodEnd', label: 'Period end' },
  ],
  invoices: [
    { path: 'customerEmail', label: 'Client' },
    { path: 'number', label: 'Number' },
    { path: 'status', label: 'Status' },
    { path: 'amountDueCents', label: 'Due', money: true },
    { path: 'amountPaidCents', label: 'Paid', money: true },
    { path: 'dueDate', label: 'Due date' },
  ],
  disputes: [
    { path: 'instructor.email', label: 'Instructor' },
    { path: 'status', label: 'Status' },
    { path: 'reason', label: 'Reason' },
    { path: 'amountCents', label: 'Amount', money: true },
    { path: 'evidenceDueBy', label: 'Evidence due' },
  ],
  webhooks: [
    { path: 'type', label: 'Type' },
    { path: 'status', label: 'Status' },
    { path: 'error', label: 'Error' },
    { path: 'receivedAt', label: 'Received' },
    { path: 'processedAt', label: 'Processed' },
  ],
};

@Component({
  selector: 'mh-admin-payments',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectButtonModule,
    InputTextModule,
  ],
  templateUrl: './payments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Payments {
  private readonly _ops = inject(AdminOpsService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);

  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly rows = 20;
  readonly resourceOptions: { label: string; value: PaymentsResource }[] = [
    { label: 'Accounts', value: 'accounts' },
    { label: 'Subscriptions', value: 'subscriptions' },
    { label: 'Invoices', value: 'invoices' },
    { label: 'Disputes', value: 'disputes' },
    { label: 'Webhooks', value: 'webhooks' },
  ];

  resource: PaymentsResource = 'accounts';
  status = '';

  readonly items = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly reprocessing = signal<string | null>(null);
  private page = 1;

  get columns(): ColumnDef[] {
    return COLUMNS[this.resource];
  }

  onResourceChange(): void {
    this.status = '';
    this.page = 1;
    this.load();
  }

  applyStatus(): void {
    this.page = 1;
    this.load();
  }

  onLazyLoad(e: TableLazyLoadEvent): void {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.rows;
    this.page = Math.floor(first / rows) + 1;
    this.load();
  }

  private raw(row: DbRow, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, k) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[k];
      }
      return undefined;
    }, row);
  }

  cell(row: DbRow, path: string): string {
    const v = this.raw(row, path);
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /** Column-aware display: formats money columns (cents → currency). */
  display(row: DbRow, col: ColumnDef): string {
    if (col.money) {
      const cents = Number(this.raw(row, col.path));
      if (!Number.isFinite(cents)) return '';
      const currency = String(this.raw(row, 'currency') || 'usd').toUpperCase();
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency,
        }).format(cents / 100);
      } catch {
        return `${(cents / 100).toFixed(2)} ${currency}`;
      }
    }
    return this.cell(row, col.path);
  }

  isWebhooks(): boolean {
    return this.resource === 'webhooks';
  }

  canReprocess(row: DbRow): boolean {
    return (
      this.isWebhooks() &&
      this.isSuperAdmin() &&
      row['status'] !== 'processed'
    );
  }

  reprocess(row: DbRow): void {
    const id = String(row['id']);
    this.reprocessing.set(id);
    this._ops.reprocessWebhook(id).subscribe({
      next: (r) => {
        this.reprocessing.set(null);
        this._messages.add({
          severity: 'success',
          summary: 'Reprocessed',
          detail: `Status: ${r.status}`,
        });
        this.load();
      },
      error: (err) => {
        this.reprocessing.set(null);
        showApiError(this._messages, 'Reprocess', 'Failed to reprocess', err);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this._ops
      .listPayments(this.resource, this.page, this.rows, this.status || undefined)
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          showApiError(this._messages, 'Payments', 'Failed to load', err);
        },
      });
  }
}
