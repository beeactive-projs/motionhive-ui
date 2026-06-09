import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { showApiError } from 'core';
import { AdminOverviewService } from '../../_data/services/admin-overview.service';
import { AdminInsights, AdminOverview } from '../../_data/models/admin.models';

interface Kpi {
  label: string;
  value: number;
  sub?: string;
  alert?: boolean;
}

interface ActivityRow {
  label: string;
  value: number;
}

@Component({
  selector: 'mh-admin-dashboard',
  imports: [DatePipe, TableModule],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly _overview = inject(AdminOverviewService);
  private readonly _messages = inject(MessageService);

  readonly loading = signal(true);
  readonly kpis = signal<Kpi[]>([]);
  readonly insights = signal<AdminInsights | null>(null);
  readonly activity = signal<ActivityRow[]>([]);

  constructor() {
    forkJoin({
      overview: this._overview.get(),
      insights: this._overview.insights(),
    }).subscribe({
      next: ({ overview, insights }) => {
        this.kpis.set(this.toKpis(overview));
        this.insights.set(insights);
        this.activity.set([
          { label: 'Sessions', value: insights.activity7d.sessions },
          { label: 'Groups', value: insights.activity7d.groups },
          { label: 'Posts', value: insights.activity7d.posts },
          { label: 'Reviews', value: insights.activity7d.reviews },
          { label: 'Subscriptions', value: insights.activity7d.subscriptions },
          { label: 'Invoices', value: insights.activity7d.invoices },
        ].sort((a, b) => b.value - a.value));
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
