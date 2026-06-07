import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { AuthStore, environment, showApiError } from 'core';
import { AdminOpsService } from '../../_data/services/admin-ops.service';
import { JobsOverview, QueueJobRow } from '../../_data/models/ops.models';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/**
 * Live queues + jobs monitor. Cron schedules live on their own
 * Schedules page (kept separate for a clearer view).
 */
@Component({
  selector: 'mh-admin-operations',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectButtonModule,
    SelectModule,
  ],
  templateUrl: './operations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Operations {
  private readonly _ops = inject(AdminOpsService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);

  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly loading = signal(true);
  readonly overview = signal<JobsOverview | null>(null);
  readonly bullBoardUrl = signal('');

  readonly queueOptions = signal<{ label: string; value: string }[]>([]);
  readonly stateOptions = [
    { label: 'Failed', value: 'failed' },
    { label: 'Active', value: 'active' },
    { label: 'Waiting', value: 'waiting' },
    { label: 'Delayed', value: 'delayed' },
    { label: 'Completed', value: 'completed' },
  ];
  selectedQueue = '';
  jobState = 'failed';
  readonly rows = 20;
  readonly jobs = signal<QueueJobRow[]>([]);
  readonly jobsTotal = signal(0);
  readonly jobsLoading = signal(false);
  readonly retrying = signal<string | null>(null);
  private jobsPage = 1;

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this._ops.jobsOverview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.bullBoardUrl.set(`${environment.apiUrl}${o.bullBoardPath}`);
        this.queueOptions.set(o.queues.map((q) => ({ label: q.name, value: q.name })));
        this.loading.set(false);
        if (!this.selectedQueue && o.queues.length) {
          this.selectedQueue = o.queues[0].name;
          this.loadJobs();
        }
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Operations', 'Failed to load jobs', err);
      },
    });
  }

  loadJobs(): void {
    if (!this.selectedQueue) return;
    this.jobsLoading.set(true);
    this._ops.queueJobs(this.selectedQueue, this.jobState, this.jobsPage, this.rows).subscribe({
      next: (r) => {
        this.jobs.set(r.items);
        this.jobsTotal.set(r.total);
        this.jobsLoading.set(false);
      },
      error: (err) => {
        this.jobsLoading.set(false);
        showApiError(this._messages, 'Jobs', 'Failed to load jobs', err);
      },
    });
  }

  onJobsLazy(e: TableLazyLoadEvent): void {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.rows;
    this.jobsPage = Math.floor(first / rows) + 1;
    this.loadJobs();
  }

  onJobControlChange(): void {
    this.jobsPage = 1;
    this.loadJobs();
  }

  refreshAll(): void {
    this.load();
    this.loadJobs();
  }

  /** Reload counts + the jobs list, then once more shortly after — fast
   *  jobs re-complete in <1s, so a delayed refresh catches the new state. */
  private refreshSoon(): void {
    this.load();
    this.loadJobs();
    setTimeout(() => {
      this.load();
      this.loadJobs();
    }, 1500);
  }

  stateSeverity(state: string): Severity {
    switch (state) {
      case 'completed':
        return 'success';
      case 'active':
        return 'info';
      case 'failed':
        return 'danger';
      case 'waiting':
      case 'delayed':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  countEntries(counts: Record<string, number> | null): { k: string; v: number }[] {
    if (!counts) return [];
    return Object.entries(counts).map(([k, v]) => ({ k, v }));
  }

  fmt(ts: number | null): string {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  }

  canRetry(j: QueueJobRow): boolean {
    return this.isSuperAdmin() && (j.state === 'failed' || j.state === 'completed');
  }

  retry(j: QueueJobRow): void {
    this.retrying.set(j.id);
    this._ops.retryJob(j.queue, j.id).subscribe({
      next: (r) => {
        this.retrying.set(null);
        this._messages.add({
          severity: 'success',
          summary: 'Job re-queued',
          detail: `${j.name} → ${r.state} (will reprocess)`,
        });
        this.refreshSoon();
      },
      error: (err) => {
        this.retrying.set(null);
        showApiError(this._messages, 'Retry', 'Failed to retry job', err);
      },
    });
  }
}
