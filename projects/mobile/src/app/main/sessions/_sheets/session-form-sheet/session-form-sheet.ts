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
import {
  IonButton,
  IonDatetime,
  IonChip,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPicker,
  IonPickerColumn,
  IonPickerColumnOption,
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
 * Duration is two wheels rather than one long list of presets: hours 0–8 and
 * minutes in 5-minute steps reach every value the BE accepts (5–480 min) and
 * still allow a 35- or 50-minute session, which presets would have ruled out.
 */
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 480;
const DURATION_HOUR_CHOICES = Array.from({ length: 9 }, (_, i) => i);
const DURATION_MINUTE_CHOICES = Array.from({ length: 12 }, (_, i) => i * 5);

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
    IonButton,
    IonDatetime,
    IonChip,
    IonDatetimeButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonNote,
    IonPicker,
    IonPickerColumn,
    IonPickerColumnOption,
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
  readonly hourChoices = DURATION_HOUR_CHOICES;
  readonly minuteChoices = DURATION_MINUTE_CHOICES;
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

  /** The duration wheels live in their own popup, like the start date's. */
  readonly durationOpen = signal(false);

  readonly isRecurring = signal(false);
  readonly daysOfWeek = signal<number[]>([]);
  readonly endAfterOccurrences = signal(12);

  readonly saving = signal(false);
  readonly venues = signal<Venue[]>([]);
  private _venuesLoaded = false;

  /** A 1-on-1 has exactly one seat; asking for a capacity would be noise. */
  readonly showCapacity = computed(() => this.type() !== 'PRIVATE');

  readonly isOnline = computed(() => this.locationKind() === 'ONLINE');

  /** The two wheels are views onto `durationMinutes`, which stays the truth. */
  readonly durationHours = computed(() => Math.floor(this.durationMinutes() / 60));
  readonly durationMinutesPart = computed(() => this.durationMinutes() % 60);

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
    // `untracked` so the effect depends on `open()` and nothing else: `_reset`
    // reads `initialStart` and `_loadVenues` reads `venues`, and tracking those
    // re-seeds the form mid-edit the moment the venue request lands. That also
    // rewrites `startAt` under an open date picker, and Ionic reacts to a new
    // `value` by scroll-animating the calendar away from the day just tapped.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this._reset();
        this._loadVenues();
      });
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

  /**
   * Greys out the minute options that would carry the pair outside the accepted
   * range — every minute but `:00` at 8 h, and `:00` itself at 0 h. The wheel
   * skips disabled options, so neither edge can be scrolled onto.
   */
  minuteAllowed(minutes: number): boolean {
    const total = this.durationHours() * 60 + minutes;
    return total >= MIN_DURATION_MINUTES && total <= MAX_DURATION_MINUTES;
  }

  setDurationHours(hours: string | number | undefined): void {
    if (typeof hours !== 'number') return;
    this._setDuration(hours, this.durationMinutesPart());
  }

  setDurationMinutes(minutes: string | number | undefined): void {
    if (typeof minutes !== 'number') return;
    this._setDuration(this.durationHours(), minutes);
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

  /**
   * Clamped rather than left to the wheels: switching to 8 h while the minute
   * wheel sits on `:30` would otherwise ask for 510 minutes. Both bounds land
   * back on a valid pair of options, so the wheels follow the correction.
   */
  private _setDuration(hours: number, minutes: number): void {
    const total = hours * 60 + minutes;
    this.durationMinutes.set(Math.min(Math.max(total, MIN_DURATION_MINUTES), MAX_DURATION_MINUTES));
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

  /**
   * Fetched once. The flag rather than `venues().length` because an empty list
   * is a valid answer — a coach with no venues would otherwise refetch on every
   * open. A failure does not latch, so reopening retries.
   */
  private _loadVenues(): void {
    if (this._venuesLoaded) return;
    this._venuesLoaded = true;
    this._venueService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (venues) => this.venues.set(venues),
        // A missing venue list is not worth an error: the picker just stays
        // empty and the session can still be created without one.
        error: () => {
          this._venuesLoaded = false;
          this.venues.set([]);
        },
      });
  }
}
