import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';

import {
  AssignProgramPayload,
  ClientService,
  InstructorClient,
  InstructorClientStatuses,
  Program,
  ProgramAssignment,
  ProgramAssignmentService,
  showApiError,
} from 'core';

type ClientOption = SelectItem<string> & {
  avatarUrl: string | null;
  sub: string | null;
};

/**
 * Assign-to-client dialog (FE-P3).
 *
 * Picks an ACTIVE client and a start date, then POSTs to
 * `/program-assignments` — the BE runs the copy-on-assign deep tree
 * clone atomically and fires PROGRAM_ASSIGNED to the client.
 *
 * The client list is intentionally limited to ACTIVE relationships
 * (PENDING/DECLINED/etc. would 404 server-side anyway since the
 * deep-copy tx asserts an ACTIVE instructor_client row exists).
 */
@Component({
  selector: 'mh-assign-program-dialog',
  imports: [
    DatePipe,
    FormsModule,
    Button,
    DatePicker,
    Dialog,
    Select,
    Skeleton,
    Textarea,
    Toast,
  ],
  providers: [MessageService],
  templateUrl: './assign-program-dialog.html',
  styleUrl: './assign-program-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignProgramDialog {
  readonly program = input.required<Program>();
  readonly visible = model<boolean>(false);
  readonly assigned = output<ProgramAssignment>();

  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);

  readonly clients = signal<ClientOption[]>([]);
  readonly loadingClients = signal(false);
  readonly submitting = signal(false);

  readonly clientId = signal<string | null>(null);
  readonly startDate = signal<Date>(this._today());
  readonly notes = signal<string>('');

  /** Min selectable start date — today. */
  readonly minDate = this._today();

  readonly canSubmit = computed(
    () => !!this.clientId() && !!this.startDate() && !this.submitting(),
  );

  constructor() {
    // Load clients lazily when the dialog opens.
    effect(() => {
      if (this.visible() && this.clients().length === 0) {
        this._loadClients();
      }
      if (!this.visible()) {
        // Reset form on close so the next open starts fresh.
        this.clientId.set(null);
        this.startDate.set(this._today());
        this.notes.set('');
      }
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  cancel(): void {
    this.visible.set(false);
  }

  submit(): void {
    const clientId = this.clientId();
    const start = this.startDate();
    if (!clientId || !start) return;

    const payload: AssignProgramPayload = {
      programId: this.program().id,
      clientId,
      startDate: this._toISODate(start),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
    };

    this.submitting.set(true);
    this._assignmentService.assign(payload).subscribe({
      next: (assignment) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Program assigned',
          detail: `${this.program().name} sent to ${this._clientLabel(clientId)}.`,
          life: 3500,
        });
        this.assigned.emit(assignment);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          "Couldn't assign program",
          'Please check the client relationship and try again.',
          err,
        );
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private _loadClients(): void {
    this.loadingClients.set(true);
    this._clientService
      .getClients({ status: InstructorClientStatuses.Active, limit: 100 })
      .subscribe({
        next: (res) => {
          this.clients.set(
            (res.items ?? []).map((c) => this._toOption(c)).filter(Boolean),
          );
          this.loadingClients.set(false);
        },
        error: (err) => {
          this.loadingClients.set(false);
          showApiError(
            this._messageService,
            "Couldn't load clients",
            'Refresh and try again.',
            err,
          );
        },
      });
  }

  private _toOption(c: InstructorClient): ClientOption {
    const u = c.client;
    const first = u?.firstName ?? '';
    const last = u?.lastName ?? '';
    const fallback = u?.email ?? c.invitedEmail ?? 'Client';
    const name = `${first} ${last}`.trim() || fallback;
    return {
      value: c.clientId,
      label: name,
      avatarUrl: u?.avatarUrl ?? null,
      sub: u?.email ?? null,
    };
  }

  private _clientLabel(clientId: string): string {
    return this.clients().find((c) => c.value === clientId)?.label ?? 'client';
  }

  private _today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Format Date → YYYY-MM-DD (local). The BE stores this as a DATE column. */
  private _toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
