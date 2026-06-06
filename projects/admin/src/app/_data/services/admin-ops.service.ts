import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment, type PaginatedResponse } from 'core';
import {
  JobsOverview,
  PaymentsResource,
  QueueJobRow,
  ReprocessResult,
  TriggerResult,
} from '../models/ops.models';
import { DbRow } from '../models/admin.models';

/** Operations API: jobs/queues + payments oversight. */
@Injectable({ providedIn: 'root' })
export class AdminOpsService {
  private readonly _http = inject(HttpClient);
  private readonly _api = environment.apiUrl;

  jobsOverview(): Observable<JobsOverview> {
    return this._http.get<JobsOverview>(`${this._api}/admin/jobs/overview`);
  }

  triggerJob(name: string): Observable<TriggerResult> {
    return this._http.post<TriggerResult>(`${this._api}/admin/jobs/trigger`, {
      name,
    });
  }

  queueJobs(
    queue: string,
    perState = 10,
  ): Observable<{ available: boolean; jobs: QueueJobRow[] }> {
    return this._http.get<{ available: boolean; jobs: QueueJobRow[] }>(
      `${this._api}/admin/jobs/queues/${queue}/jobs`,
      { params: new HttpParams().set('perState', String(perState)) },
    );
  }

  retryJob(queue: string, jobId: string): Observable<{ id: string; state: string }> {
    return this._http.post<{ id: string; state: string }>(
      `${this._api}/admin/jobs/queues/${queue}/jobs/${jobId}/retry`,
      {},
    );
  }

  listPayments(
    resource: PaymentsResource,
    page: number,
    limit: number,
    status?: string,
    filter?: string,
  ): Observable<PaginatedResponse<DbRow>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (status) params = params.set('status', status);
    if (filter) params = params.set('filter', filter);
    return this._http.get<PaginatedResponse<DbRow>>(
      `${this._api}/admin/payments/${resource}`,
      { params },
    );
  }

  reprocessWebhook(id: string): Observable<ReprocessResult> {
    return this._http.post<ReprocessResult>(
      `${this._api}/admin/payments/webhooks/${id}/reprocess`,
      {},
    );
  }
}
