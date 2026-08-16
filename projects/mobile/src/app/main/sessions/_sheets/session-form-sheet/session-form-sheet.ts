import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonDatetime,
  IonChip,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  CreateTemplateRequest,
  SessionKind,
  SessionLocationKind,
  SessionService,
  Venue,
  VenueService,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import {
  LOCATION_KIND_OPTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
  WEEKDAYS,
  formatWeekdayList,
} from '../../sessions.config';

/**
 * Every duration the BE accepts (5–480 min), at a granularity a coach would
 * actually use: 5-minute steps through the first two hours, then quarter-hours.
 * Presets would have ruled out a 35- or 50-minute session.
 */
const DURATION_CHOICES = [
  ...Array.from({ length: 24 }, (_, i) => (i + 1) * 5),
  ...Array.from({ length: 24 }, (_, i) => 120 + (i + 1) * 15),
];

const OCCURRENCE_CHOICES = [4, 8, 12, 24, 52];

/** Local datetime for `ion-datetime`, which does not take a UTC instant. */
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Next round half-hour, at least an hour out — a sane default start. */
function defaultStart(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, date.getMinutes() < 30 ? 30 : 0, 0, 0);
  return toLocalIso(date);
}

/**
 * Create a session.
 *
 * Recurrence is collapsed behind a toggle: most sessions are one-offs, and the
 * repeat fields are meaningless until it is on.
 *
 * Everything here maps to `CreateTemplateRequest` — one template plus its first
 * instances, which is what the BE creates in a single call.
 */
@Component({
  selector: 'mh-session-form-sheet',
  imports: [
    IonDatetime,
    IonChip,
    IonDatetimeButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
    SheetShell,
  ],
  templateUrl: './session-form-sheet.html',
  styleUrl: './session-form-sheet.scss',
})
export class SessionFormSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _venueService = inject(VenueService);
  private readonly _feedbackService = inject(FeedbackService);

  readonly open = model(false);
  /** Pre-fills the start when opened from a slot on the day rail. */
  readonly initialStart = input<Date | null>(null);
  readonly created = output<void>();

  readonly typeOptions = SESSION_TYPE_OPTIONS;
  readonly locationOptions = LOCATION_KIND_OPTIONS;
  readonly weekdays = WEEKDAYS;
  readonly durations = DURATION_CHOICES;
  readonly occurrenceChoices = OCCURRENCE_CHOICES;

  readonly title = signal('');
  readonly type = signal<SessionKind>('GROUP');
  readonly locationKind = signal<SessionLocationKind>('IN_PERSON');
  readonly startAt = signal(defaultStart());
  readonly durationMinutes = signal(60);
  readonly capacity = signal<number | null>(12);
  readonly priceAmount = signal<number | null>(null);
  readonly meetingUrl = signal('');
  readonly venueId = signal<string | null>(null);

  readonly isRecurring = signal(false);
  readonly daysOfWeek = signal<number[]>([]);
  readonly endAfterOccurrences = signal(12);

  readonly saving = signal(false);
  readonly venues = signal<Venue[]>([]);

  /** A 1-on-1 has exactly one seat; asking for a capacity would be noise. */
  readonly showCapacity = computed(() => this.type() !== 'PRIVATE');

  readonly isOnline = computed(() => this.locationKind() === 'ONLINE');

  readonly canSave = computed(() => {
    if (this.title().trim().length === 0) return false;
    if (this.isOnline() && this.meetingUrl().trim().length === 0) return false;
    // A weekly series with no day selected would expand to nothing.
    if (this.isRecurring() && this.daysOfWeek().length === 0) return false;
    return true;
  });

  /** Plain-English summary, so the rule is legible before it is committed. */
  readonly recurrenceSummary = computed(() => {
    const list = formatWeekdayList(this.daysOfWeek());
    if (!list) return 'Pick at least one day';
    return `Every ${list} · ${this.endAfterOccurrences()} sessions`;
  });

  constructor() {
    addIcons(SESSION_ICONS);

    // Re-seed each time it opens, so a cancelled edit never leaks into the next.
    effect(() => {
      if (!this.open()) return;
      this._reset();
      this._loadVenues();
    });
  }

  onStartChange(value: string | string[] | null | undefined): void {
    if (typeof value === 'string') this.startAt.set(value);
  }

  /** "1 h 15 min" reads better than "75 min" once past the hour. */
  durationLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }

  /** `ion-input type="number"` emits a string; empty means "unset", not zero. */
  toNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  toggleDay(day: number): void {
    this.daysOfWeek.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  save(): void {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);

    // `ion-datetime` hands back a local wall-clock string; the BE wants an
    // instant, and the template's own timezone is what the series expands in.
    const start = new Date(this.startAt());

    const payload: CreateTemplateRequest = {
      title: this.title().trim(),
      type: this.type(),
      // Access is not on this sheet — OPEN is the sane default and the only
      // one that needs no further setup (GROUP_ONLY would require a group).
      access: 'OPEN',
      locationKind: this.locationKind(),
      durationMinutes: this.durationMinutes(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isRecurring: this.isRecurring(),
      firstStartAt: start.toISOString(),
      generateInitialInstances: true,
    };

    if (this.isOnline()) payload.meetingUrl = this.meetingUrl().trim();
    else if (this.venueId()) payload.venueId = this.venueId() ?? undefined;

    if (this.showCapacity() && this.capacity() !== null) {
      payload.capacity = this.capacity() ?? undefined;
    }
    if (this.priceAmount() !== null) {
      payload.priceAmountCents = Math.round((this.priceAmount() ?? 0) * 100);
    }

    if (this.isRecurring()) {
      payload.recurrenceRule = {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [...this.daysOfWeek()].sort((a, b) => a - b),
        endAfterOccurrences: this.endAfterOccurrences(),
      };
      payload.initialInstancesCount = this.endAfterOccurrences();
    }

    this._sessionService
      .createTemplate(payload)
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          // The BE returns a conflict warning rather than refusing — an
          // overlap is the coach's call to make, not ours.
          const conflicts = result.warnings?.length ?? 0;
          void this._feedbackService.success(
            conflicts > 0 ? 'Session created · overlaps another' : 'Session created',
          );
          this.created.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not create the session.');
        },
      });
  }

  private _reset(): void {
    this.title.set('');
    this.type.set('GROUP');
    this.locationKind.set('IN_PERSON');
    const seeded = this.initialStart();
    this.startAt.set(seeded ? toLocalIso(seeded) : defaultStart());
    this.durationMinutes.set(60);
    this.capacity.set(12);
    this.priceAmount.set(null);
    this.meetingUrl.set('');
    this.venueId.set(null);
    this.isRecurring.set(false);
    this.daysOfWeek.set([]);
    this.endAfterOccurrences.set(12);
  }

  private _loadVenues(): void {
    if (this.venues().length > 0) return;
    this._venueService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (venues) => this.venues.set(venues),
        // A missing venue list is not worth an error: the picker just stays
        // empty and the session can still be created without one.
        error: () => this.venues.set([]),
      });
  }
}
