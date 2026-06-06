import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';
import { AuthStore, environment, showApiError } from 'core';
import { AdminOpsService } from '../../_data/services/admin-ops.service';
import {
  JobsOverview,
  QueueJobRow,
  TriggerableJob,
} from '../../_data/models/ops.models';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'mh-admin-operations',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectButtonModule,
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
  readonly triggering = signal<string | null>(null);
  readonly bullBoardUrl = signal('');

  // Jobs list
  readonly queueOptions = signal<{ label: string; value: string }[]>([]);
  selectedQueue = '';
  readonly jobs = signal<QueueJobRow[]>([]);
  readonly jobsLoading = signal(false);
  readonly retrying = signal<string | null>(null);

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
    this._ops.queueJobs(this.selectedQueue, 15).subscribe({
      next: (r) => {
        this.jobs.set(r.jobs);
        this.jobsLoading.set(false);
      },
      error: (err) => {
        this.jobsLoading.set(false);
        showApiError(this._messages, 'Jobs', 'Failed to load jobs', err);
      },
    });
  }

  refreshAll(): void {
    this.load();
    this.loadJobs();
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
          detail: `${j.name} → ${r.state}`,
        });
        this.loadJobs();
        this.load();
      },
      error: (err) => {
        this.retrying.set(null);
        showApiError(this._messages, 'Retry', 'Failed to retry job', err);
      },
    });
  }

  run(job: TriggerableJob): void {
    this.triggering.set(job.key);
    this._ops.triggerJob(job.key).subscribe({
      next: (r) => {
        this.triggering.set(null);
        this._messages.add({
          severity: r.enqueued ? 'success' : 'warn',
          summary: r.enqueued ? 'Job enqueued' : 'Not enqueued',
          detail: r.enqueued ? `${job.key} (job ${r.jobId})` : `${job.key} — Redis disabled?`,
        });
        // Jump to the queue this job belongs to so the operator sees it land.
        this.selectedQueue = job.queue;
        this.loadJobs();
        this.load();
      },
      error: (err) => {
        this.triggering.set(null);
        showApiError(this._messages, 'Trigger', 'Failed to trigger job', err);
      },
    });
  }
}
