/** Operations-phase DTOs (jobs + payments oversight). */

export interface QueueOverview {
  name: string;
  available: boolean;
  counts: Record<string, number> | null;
}

export interface TriggerableJob {
  key: string;
  queue: string;
  schedule: string;
}

export interface JobsOverview {
  redisEnabled: boolean;
  queues: QueueOverview[];
  triggerable: TriggerableJob[];
  bullBoardPath: string;
}

export interface TriggerResult {
  name: string;
  enqueued: boolean;
  jobId: string | null;
}

export interface ReprocessResult {
  id: string;
  status: string | null;
  error: string | null;
}

export interface QueueJobRow {
  id: string;
  queue: string;
  name: string;
  state: string;
  attemptsMade: number;
  timestamp: number | null;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
}

/** A payments-oversight resource (drives the generic table). */
export type PaymentsResource =
  | 'accounts'
  | 'subscriptions'
  | 'invoices'
  | 'disputes'
  | 'webhooks';
