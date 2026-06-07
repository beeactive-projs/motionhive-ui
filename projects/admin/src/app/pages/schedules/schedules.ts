import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { AuthStore, showApiError } from 'core';
import { AdminOpsService } from '../../_data/services/admin-ops.service';
import { JobsOverview, TriggerableJob } from '../../_data/models/ops.models';

/**
 * Cron / scheduled-sweeps view — separated from the live Operations
 * queues+jobs page for clarity. Lists the recurring system sweeps with
 * their cadence and a "Run now" (SUPER_ADMIN). Shows the last manual
 * run's result inline so the operator gets clear feedback.
 */
@Component({
  selector: 'mh-admin-schedules',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    InputTextModule,
  ],
  templateUrl: './schedules.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Schedules {
  private readonly _ops = inject(AdminOpsService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);

  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly loading = signal(true);
  readonly overview = signal<JobsOverview | null>(null);
  readonly triggering = signal<string | null>(null);
  /** Last manual-run result per job key (shown inline). */
  readonly lastRun = signal<Record<string, string>>({});

  search = '';
  queue: string | null = null;
  readonly tick = signal(0);
  readonly queueOptions = signal<{ label: string; value: string }[]>([]);

  readonly filtered = computed(() => {
    this.tick();
    const ov = this.overview();
    if (!ov) return [];
    const term = this.search.trim().toLowerCase();
    return ov.triggerable.filter(
      (j) =>
        (!this.queue || j.queue === this.queue) &&
        (!term || j.key.toLowerCase().includes(term)),
    );
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this._ops.jobsOverview().subscribe({
      next: (o) => {
        this.overview.set(o);
        const qs = [...new Set(o.triggerable.map((t) => t.queue))];
        this.queueOptions.set(qs.map((q) => ({ label: q, value: q })));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Schedules', 'Failed to load', err);
      },
    });
  }

  onFilter(): void {
    this.tick.update((n) => n + 1);
  }

  run(job: TriggerableJob): void {
    this.triggering.set(job.key);
    this._ops.triggerJob(job.key).subscribe({
      next: (r) => {
        this.triggering.set(null);
        const label = r.enqueued ? `queued (job ${r.jobId})` : 'not queued — Redis off?';
        this.lastRun.update((m) => ({ ...m, [job.key]: label }));
        this._messages.add({
          severity: r.enqueued ? 'success' : 'warn',
          summary: r.enqueued ? 'Run started' : 'Not queued',
          detail: `${job.key} ${label}. See it in Operations → ${job.queue}.`,
        });
      },
      error: (err) => {
        this.triggering.set(null);
        showApiError(this._messages, 'Run', 'Failed to run job', err);
      },
    });
  }
}
