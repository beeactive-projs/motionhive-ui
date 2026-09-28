import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { MessageService, SelectItem } from 'primeng/api';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { Toast } from 'primeng/toast';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

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
/** ISO 1=Mon..7=Sun, which is what the API takes. */
const WEEKDAYS: readonly { iso: number; label: string }[] = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

@Component({
  selector: 'mh-assign-program-dialog',
  imports: [
    DatePipe,
    FormsModule,
    ButtonDirective,
    DatePicker,
    Dialog,
    Select,
    Skeleton,
    Textarea,
    Toast,
    HexAvatar,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './assign-program-dialog.html',
  styleUrl: './assign-program-dialog.scss',
})
export class AssignProgramDialog {
  readonly program = input.required<Program>();
  readonly visible = model<boolean>(false);
  readonly assigned = output<ProgramAssignment>();

  private readonly _assignmentService = inject(ProgramAssignmentService);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly clients = signal<ClientOption[]>([]);
  readonly loadingClients = signal(false);
  readonly submitting = signal(false);

  readonly clientId = signal<string | null>(null);
  readonly startDate = signal<Date>(this._today());

  /**
   * The weekdays the program's training days land on, ISO 1=Mon..7=Sun.
   *
   * Empty means "leave it alone" — days fall by counting forward from the
   * start date, which is what every assignment did before this existed.
   */
  readonly chosenDays = signal<number[]>([]);

  /** The program's own day slots, 0=Mon..6=Sun, in order. */
  readonly programDays = computed(() => {
    const workouts = this.program().workouts ?? [];
    return [...new Set(workouts.map((w) => w.dayIndex))].sort((a, b) => a - b);
  });

  readonly weekdayOptions = WEEKDAYS;

  /**
   * How many weekdays still need picking. The API refuses a mismatch, so
   * the dialog says so rather than letting the request fail.
   */
  readonly daysRemaining = computed(
    () => this.programDays().length - this.chosenDays().length,
  );

  /** Nothing chosen is valid; a partial choice is not. */
  readonly daysValid = computed(
    () => this.chosenDays().length === 0 || this.daysRemaining() === 0,
  );

  /** Worth asking only when the program actually has days to place. */
  readonly canChooseDays = computed(() => this.programDays().length > 0);

  readonly dayHint = computed(() => {
    const n = this.programDays().length;
    if (this.chosenDays().length === 0) {
      return `This program trains ${n} ${n === 1 ? 'day' : 'days'} a week. Leave empty to count forward from the start date.`;
    }
    if (this.daysRemaining() > 0) {
      return `Pick ${this.daysRemaining()} more.`;
    }
    return 'Each training day moves to the weekday you picked, in order.';
  });

  toggleDay(iso: number): void {
    this.chosenDays.update((days) =>
      days.includes(iso) ? days.filter((d) => d !== iso) : [...days, iso].sort((a, b) => a - b),
    );
  }

  isDayOn(iso: number): boolean {
    return this.chosenDays().includes(iso);
  }
  readonly notes = signal<string>('');

  /** Min selectable start date — today. */
  readonly minDate = this._today();

  readonly canSubmit = computed(
    () =>
      !!this.clientId() &&
      !!this.startDate() &&
      this.daysValid() &&
      !this.submitting(),
  );

  /**
   * Set once per dialog "open" transition. Prevents the infinite refetch
   * loop we hit when the API returns [] — the old effect keyed off
   * `clients().length === 0`, but `clients.set([])` fired the signal
   * again and the effect re-ran, calling _loadClients() forever.
   */
  private _wasVisible = false;

  constructor() {
    // Only trigger on false → true transitions. `untracked()` inside so
    // the effect never re-runs from writing signals it shouldn't depend on.
    effect(() => {
      const open = this.visible();
      untracked(() => {
        if (open && !this._wasVisible) {
          this._wasVisible = true;
          this._loadClients();
        } else if (!open && this._wasVisible) {
          this._wasVisible = false;
          // Reset form so the next open starts fresh.
          this.clientId.set(null);
          this.startDate.set(this._today());
          this.chosenDays.set([]);
          this.notes.set('');
        }
      });
    });
  }

  goToClients(): void {
    this.visible.set(false);
    void this._router.navigate(['/coaching/clients']);
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
      ...(this.chosenDays().length ? { daysOfWeek: this.chosenDays() } : {}),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
    };

    this.submitting.set(true);
    this._assignmentService.assign(payload).subscribe({
      next: (assignment) => {
        this.submitting.set(false);
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('programs.toast.assigned.summary'),
          detail: this._translateService.instant('programs.toast.assigned.detail', {
            program: this.program().name,
            client: this._clientLabel(clientId),
          }),
          life: 3500,
        });
        this.assigned.emit(assignment);
        this.visible.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('programs.toast.assignError.summary'),
          this._translateService.instant('programs.toast.assignError.detail'),
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
            this._translateService.instant('programs.toast.loadClientsError.summary'),
            this._translateService.instant('programs.toast.loadClientsError.detail'),
            err,
          );
        },
      });
  }

  private _toOption(c: InstructorClient): ClientOption {
    const u = c.client;
    const first = u?.firstName ?? '';
    const last = u?.lastName ?? '';
    const fallback =
      u?.email ?? c.invitedEmail ?? this._translateService.instant('programs.assignDialog.clientFallback');
    const name = `${first} ${last}`.trim() || fallback;
    return {
      value: c.clientId,
      label: name,
      avatarUrl: u?.avatarUrl ?? null,
      sub: u?.email ?? null,
    };
  }

  private _clientLabel(clientId: string): string {
    return (
      this.clients().find((c) => c.value === clientId)?.label ??
      this._translateService.instant('programs.assignDialog.clientFallbackLower')
    );
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
