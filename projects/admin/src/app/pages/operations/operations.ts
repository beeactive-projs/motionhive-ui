import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { AuthStore, environment, showApiError } from 'core';
import { AdminOpsService } from '../../_data/services/admin-ops.service';
import { JobsOverview, TriggerableJob } from '../../_data/models/ops.models';

@Component({
  selector: 'mh-admin-operations',
  imports: [TableModule, ButtonModule, TagModule],
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

  // Bull Board lives on the API origin.
  readonly bullBoardUrl = signal('');

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this._ops.jobsOverview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.bullBoardUrl.set(`${environment.apiUrl}${o.bullBoardPath}`);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Operations', 'Failed to load jobs', err);
      },
    });
  }

  countEntries(counts: Record<string, number> | null): { k: string; v: number }[] {
    if (!counts) return [];
    return Object.entries(counts).map(([k, v]) => ({ k, v }));
  }

  run(job: TriggerableJob): void {
    this.triggering.set(job.key);
    this._ops.triggerJob(job.key).subscribe({
      next: (r) => {
        this.triggering.set(null);
        this._messages.add({
          severity: r.enqueued ? 'success' : 'warn',
          summary: r.enqueued ? 'Job enqueued' : 'Not enqueued',
          detail: r.enqueued
            ? `${job.key} (job ${r.jobId})`
            : `${job.key} — Redis disabled?`,
        });
        this.load();
      },
      error: (err) => {
        this.triggering.set(null);
        showApiError(this._messages, 'Trigger', 'Failed to trigger job', err);
      },
    });
  }
}
