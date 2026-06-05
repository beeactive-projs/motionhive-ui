import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { showApiError } from 'core';
import { AdminOverviewService } from '../../_data/services/admin-overview.service';
import { AdminOverview } from '../../_data/models/admin.models';

interface Kpi {
  label: string;
  value: number;
  sub?: string;
  alert?: boolean;
}

@Component({
  selector: 'mh-admin-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly _overview = inject(AdminOverviewService);
  private readonly _messages = inject(MessageService);

  readonly loading = signal(true);
  readonly kpis = signal<Kpi[]>([]);

  constructor() {
    this._overview.get().subscribe({
      next: (o) => {
        this.kpis.set(this.toKpis(o));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Dashboard', 'Failed to load overview', err);
      },
    });
  }

  private toKpis(o: AdminOverview): Kpi[] {
    return [
      { label: 'Users', value: o.users.total, sub: `${o.users.active} active · ${o.users.deleted} deleted` },
      { label: 'Instructors', value: o.instructors },
      { label: 'Groups', value: o.groups },
      { label: 'Sessions', value: o.sessions.total, sub: `${o.sessions.completed} completed` },
      { label: 'Active subscriptions', value: o.payments.activeSubscriptions },
      { label: 'Open disputes', value: o.payments.openDisputes, alert: o.payments.openDisputes > 0 },
      { label: 'Failed webhooks', value: o.payments.failedWebhooks, alert: o.payments.failedWebhooks > 0 },
      { label: 'Open reports', value: o.moderation.openMessageReports, alert: o.moderation.openMessageReports > 0 },
    ];
  }
}
