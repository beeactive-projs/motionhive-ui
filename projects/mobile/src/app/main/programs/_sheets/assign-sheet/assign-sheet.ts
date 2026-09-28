import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonChip,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTextarea,
} from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';

import {
  ClientService,
  InstructorClient,
  InstructorClientStatuses,
  Program,
  ProgramWorkout,
  displayName,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import {
  scheduledDateFor,
  scheduledDateFromMonday,
  todayIso,
  weekLabel,
} from '../../programs.config';

/** One line of the schedule preview. */
export interface PreviewRow {
  name: string;
  date: string;
  week: string;
}

export interface AssignRequest {
  clientId: string;
  startDate: string;
  /** ISO 1=Mon..7=Sun. Absent leaves days counting from the start date. */
  daysOfWeek?: number[];
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
  selector: 'mh-assign-sheet',
  imports: [
    IonChip,
    HexAvatar,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonTextarea,
    SheetShell,
  ],
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

  readonly canAssign = computed(
    () => !!this.clientId() && !!this.startDate() && this.daysValid(),
  );

  /**
   * The weekdays the program's training days land on, ISO 1=Mon..7=Sun.
   * Empty leaves them counting forward from the start date.
   */
  readonly chosenDays = signal<number[]>([]);

  readonly weekdayOptions = WEEKDAYS;

  /** The program's own day slots, 0=Mon..6=Sun, in order. */
  readonly programDays = computed(() => {
    const workouts = this.program()?.workouts ?? [];
    return [...new Set(workouts.map((w) => w.dayIndex))].sort((a, b) => a - b);
  });

  readonly canChooseDays = computed(() => this.programDays().length > 0);

  readonly daysRemaining = computed(
    () => this.programDays().length - this.chosenDays().length,
  );

  /** Nothing chosen is valid; a partial choice is not — the API refuses it. */
  readonly daysValid = computed(
    () => this.chosenDays().length === 0 || this.daysRemaining() === 0,
  );

  readonly dayHint = computed(() => {
    const n = this.programDays().length;
    if (this.chosenDays().length === 0) {
      return `Trains ${n} ${n === 1 ? 'day' : 'days'} a week. Leave these alone to count forward from the start date.`;
    }
    if (this.daysRemaining() > 0) {
      return `Pick ${this.daysRemaining()} more.`;
    }
    return 'Each training day moves to the weekday you picked, in order.';
  });

  /** Program day slot -> chosen weekday, once the picks are complete. */
  private readonly _dayMap = computed<Map<number, number> | null>(() => {
    if (!this.daysValid() || !this.chosenDays().length) return null;
    const days = this.programDays();
    const chosen = [...this.chosenDays()].sort((a, b) => a - b);
    return new Map(days.map((d, i) => [d, chosen[i] - 1]));
  });

  toggleDay(iso: number): void {
    this.chosenDays.update((days) =>
      days.includes(iso)
        ? days.filter((d) => d !== iso)
        : [...days, iso].sort((a, b) => a - b),
    );
  }

  isDayOn(iso: number): boolean {
    return this.chosenDays().includes(iso);
  }

  /**
   * Every day of the plan against a real date, in the order they happen.
   *
   * Sorted by date rather than by position: remapping days onto other
   * weekdays can reorder them within a week, and a preview that still read
   * top-to-bottom by slot would disagree with the calendar it is predicting.
   */
  readonly preview = computed<PreviewRow[]>(() => {
    const program = this.program();
    const start = this.startDate();
    if (!program || !start) return [];

    const dayMap = this._dayMap();
    return [...(program.workouts ?? [])]
      .map((workout: ProgramWorkout) => {
        // Mirrors the server: with a mapping, week 0 is anchored on the
        // Monday of the start week and the slot names a weekday.
        const dayIndex = dayMap?.get(workout.dayIndex) ?? workout.dayIndex;
        const date = dayMap
          ? scheduledDateFromMonday(start, workout.weekIndex, dayIndex)
          : scheduledDateFor(start, workout.weekIndex, workout.dayIndex);
        return { workout, dayIndex, date };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ workout, date }) => ({
        name: workout.name,
        week: weekLabel(workout.weekIndex),
        date: date.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
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
        this.clients.set(
          rows.filter((row: InstructorClient) => row.status === InstructorClientStatuses.Active),
        );
      });
  }

  name(row: InstructorClient): string {
    return displayName(row.client ?? null, 'Client');
  }

  tone(row: InstructorClient): string {
    return avatarToneFor(row.clientId);
  }

  /** The picker hands back an ISO instant; a start date is the calendar day of it. */
  onStartChange(value: string | string[] | null | undefined): void {
    const iso = Array.isArray(value) ? value[0] : value;
    if (iso) this.startDate.set(iso.slice(0, 10));
  }

  submit(): void {
    const clientId = this.clientId();
    if (!clientId) return;
    this.assign.emit({
      clientId,
      startDate: this.startDate(),
      daysOfWeek: this.chosenDays().length ? this.chosenDays() : undefined,
      notes: this.notes().trim() || undefined,
    });
    this.reset();
    this.open.set(false);
  }

  reset(): void {
    this.chosenDays.set([]);
    this.clientId.set(null);
    this.startDate.set(todayIso());
    this.notes.set('');
  }
}
