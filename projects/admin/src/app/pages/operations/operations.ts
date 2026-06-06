import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
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
    SelectModule,
    InputTextModule,
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

  // ── Jobs (paginated, per state) ──
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

  // ── Scheduled sweeps (client-side search + queue filter + paginate) ──
  sweepSearch = '';
  sweepQueue: string | null = null;
  readonly sweepQueueOptions = signal<{ label: string; value: string }[]>([]);
  readonly filteredSweeps = computed(() => {
    this.sweepTick(); // dependency so plain-field filters re-evaluate
    const ov = this.overview();
    if (!ov) return [];
    const term = this.sweepSearch.trim().toLowerCase();
    return ov.triggerable.filter(
      (j) =>
        (!this.sweepQueue || j.queue === this.sweepQueue) &&
        (!term || j.key.toLowerCase().includes(term)),
    );
  });
  // re-evaluate the computed when the plain ngModel fields change
  readonly sweepTick = signal(0);

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
        const uniqueQueues = [...new Set(o.triggerable.map((t) => t.queue))];
        this.sweepQueueOptions.set(uniqueQueues.map((q) => ({ label: q, value: q })));
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

  onSweepFilter(): void {
    this.sweepTick.update((n) => n + 1);
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
        this._messages.add({ severity: 'success', summary: 'Job re-queued', detail: `${j.name} → ${r.state}` });
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
        this.selectedQueue = job.queue;
        this.jobState = 'waiting';
        this.jobsPage = 1;
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
