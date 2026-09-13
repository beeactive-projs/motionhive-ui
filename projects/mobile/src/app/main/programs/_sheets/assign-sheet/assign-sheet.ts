import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList, IonTextarea } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ClientService,
  InstructorClient,
  Program,
  ProgramWorkout,
  displayName,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { scheduledDateFor } from '../../programs.config';

/** One line of the schedule preview. */
export interface PreviewRow {
  name: string;
  date: string;
  weekIndex: number;
}

export interface AssignRequest {
  clientId: string;
  startDate: string;
  notes?: string;
}

/** How many days of the plan the preview shows before folding the rest away. */
const PREVIEW_ROWS = 6;

/**
 * Assign a program to a client.
 *
 * The payload is only client, start date and an optional note — nothing
 * invented. The screen's real work is the preview: given a start date, which
 * day lands on which real date. A plan whose "Day 1" falls on a Saturday is
 * a mistake worth catching here rather than in a message three days later.
 */
@Component({
  selector: 'mh-assign-sheet',
  imports: [HexAvatar, IonIcon, IonItem, IonLabel, IonList, IonTextarea, SheetShell],
  templateUrl: './assign-sheet.html',
  styleUrl: './assign-sheet.scss',
})
export class AssignSheet {
  readonly open = model(false);
  readonly program = input<Program | null>(null);

  readonly assign = output<AssignRequest>();

  private readonly _clientService = inject(ClientService);

  readonly clients = signal<InstructorClient[]>([]);
  readonly loading = signal(false);
  readonly clientId = signal<string | null>(null);
  readonly startDate = signal(todayIso());
  readonly notes = signal('');

  readonly canAssign = computed(() => !!this.clientId() && !!this.startDate());

  readonly chosen = computed(() =>
    this.clients().find((c) => c.clientId === this.clientId()) ?? null,
  );

  /**
   * Every day of the plan against a real date. Sorted by position, because a
   * coach reads this as "what happens first", not as a calendar.
   */
  readonly preview = computed<PreviewRow[]>(() => {
    const program = this.program();
    const start = this.startDate();
    if (!program || !start) return [];

    return [...(program.workouts ?? [])]
      .sort((a, b) => a.weekIndex - b.weekIndex || a.dayIndex - b.dayIndex)
      .map((w: ProgramWorkout) => ({
        name: w.name,
        weekIndex: w.weekIndex,
        date: scheduledDateFor(start, w.weekIndex, w.dayIndex).toLocaleDateString(
          undefined,
          { weekday: 'short', day: 'numeric', month: 'short' },
        ),
      }));
  });

  readonly previewHead = computed(() => this.preview().slice(0, PREVIEW_ROWS));

  readonly previewMore = computed(() => Math.max(0, this.preview().length - PREVIEW_ROWS));

  constructor() {
    // Load the roster when the sheet opens rather than on construction: the
    // sheet is in the page's template from the start and most visits to the
    // screen never open it.
    effect(() => {
      if (this.open()) this._loadClients();
    });
  }

  private _loadClients(): void {
    if (this.clients().length || this.loading()) return;
    this.loading.set(true);
    this._clientService
      .getClients()
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((page) => {
        this.loading.set(false);
        const rows = Array.isArray(page) ? page : (page?.items ?? []);
        // Only an active relationship can be given work.
        this.clients.set(rows.filter((r: InstructorClient) => r.status === 'ACTIVE'));
      });
  }

  name(row: InstructorClient): string {
    return displayName(row.client ?? null, 'Client');
  }

  tone(row: InstructorClient): string {
    return avatarToneFor(row.clientId);
  }

  submit(): void {
    const clientId = this.clientId();
    if (!clientId) return;
    this.assign.emit({
      clientId,
      startDate: this.startDate(),
      notes: this.notes().trim() || undefined,
    });
    this.reset();
    this.open.set(false);
  }

  reset(): void {
    this.clientId.set(null);
    this.startDate.set(todayIso());
    this.notes.set('');
  }
}

/** Local calendar day, not UTC — a start date is a day, not an instant. */
function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
