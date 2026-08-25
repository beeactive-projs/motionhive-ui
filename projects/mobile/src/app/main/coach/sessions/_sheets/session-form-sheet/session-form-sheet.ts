import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonChip,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPicker,
  IonPickerColumn,
  IonPickerColumnOption,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Subject, catchError, debounceTime, of, switchMap, take } from 'rxjs';

import {
  CreateTemplateRequest,
  Group,
  GroupService,
  PreviewRecurrenceRequest,
  RecurrenceRule,
  SessionAccess,
  SessionType,
  SessionLocationKind,
  SessionService,
  SessionTemplate,
  SessionsInstructorStore,
  TIMEZONE_OPTIONS,
  UpdateTemplateRequest,
  Venue,
  VenueService,
  formatSessionDayShort,
  formatSessionTime,
} from 'core';

import { SheetShell } from '../../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../../_shared/services/feedback.service';
import {
  DEFAULT_GENERATED_OCCURRENCES,
  LOCATION_KIND_OPTIONS,
  RECURRENCE_END_OPTIONS,
  RecurrenceEndMode,
  RecurrenceEndModes,
  SESSION_ACCESS_OPTIONS,
  SESSION_ICONS,
  SESSION_TYPE_OPTIONS,
  SessionPrefill,
  WEEKDAYS,
  findOverlap,
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

/** A year of weekly sessions — the ceiling the old chip row topped out at. */
const MAX_OCCURRENCES = 52;
/** A week. A longer cancellation cutoff than the booking horizon is nonsense. */
const MAX_CUTOFF_HOURS = 168;

const CURRENCY_CHOICES = ['RON', 'EUR', 'USD', 'GBP'];

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

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Bucharest';
}

/**
 * Create or edit a session.
 *
 * Recurrence is collapsed behind a toggle: most sessions are one-offs, and the
 * repeat fields are meaningless until it is on.
 *
 * Everything here maps to `CreateTemplateRequest` — one template plus its first
 * instances, which is what the BE creates in a single call. The field set
 * matches the web dialog's: description, access + approval, group, waitlist,
 * cancellation cutoff, currency and timezone all ride along.
 *
 * Passing `template` switches to edit mode, same as the web dialog. The update
 * DTO is whitelist+strict, so the PATCH must not carry `isRecurring`,
 * `firstStartAt` or the generation knobs — which is why the start pill and the
 * repeat toggle are locked in edit mode. The rule's details (days, end) remain
 * editable on a series, exactly as on web.
 */
@Component({
  selector: 'mh-session-form-sheet',
  imports: [
    IonButton,
    IonChip,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonPicker,
    IonPickerColumn,
    IonPickerColumnOption,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonToggle,
    SheetShell,
  ],
  templateUrl: './session-form-sheet.html',
  styleUrl: './session-form-sheet.scss',
})
export class SessionFormSheet {
  private readonly _sessionService = inject(SessionService);
  private readonly _venueService = inject(VenueService);
  private readonly _groupService = inject(GroupService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _sessionsInstructorStore = inject(SessionsInstructorStore);
  private readonly _destroyRef = inject(DestroyRef);

  readonly open = model(false);
  /** Pre-fills the start when opened from a slot on the day rail. */
  readonly initialStart = input<Date | null>(null);
  /**
   * Opens the sheet as a copy of an existing session — what Duplicate means,
   * since the API has no duplicate endpoint. Wins over `initialStart`.
   */
  readonly prefill = input<SessionPrefill | null>(null);
  /** Non-null opens the sheet as an edit of this template. Wins over both. */
  readonly template = input<SessionTemplate | null>(null);
  /** A save landed — created in create mode, updated in edit mode. */
  readonly saved = output<void>();

  readonly typeOptions = SESSION_TYPE_OPTIONS;
  readonly accessOptions = SESSION_ACCESS_OPTIONS;
  readonly locationOptions = LOCATION_KIND_OPTIONS;
  readonly weekdays = WEEKDAYS;
  readonly hourChoices = DURATION_HOUR_CHOICES;
  readonly minuteChoices = DURATION_MINUTE_CHOICES;
  readonly endOptions = RECURRENCE_END_OPTIONS;
  readonly currencies = CURRENCY_CHOICES;
  readonly timezones = TIMEZONE_OPTIONS;
  readonly EndModes = RecurrenceEndModes;
  readonly Accesses = SessionAccess;

  readonly title = signal('');
  readonly description = signal('');
  readonly type = signal<SessionType>(SessionType.Group);
  readonly access = signal<SessionAccess>(SessionAccess.Open);
  readonly approvalRequired = signal(false);
  readonly groupId = signal<string | null>(null);
  readonly locationKind = signal<SessionLocationKind>(SessionLocationKind.InPerson);
  readonly startAt = signal(defaultStart());
  readonly timezone = signal(deviceTimezone());
  readonly durationMinutes = signal(60);
  readonly capacity = signal<number | null>(12);
  readonly waitlistEnabled = signal(true);
  readonly cancellationCutoffHours = signal(24);
  readonly priceAmount = signal<number | null>(null);
  readonly priceCurrency = signal('RON');
  readonly meetingUrl = signal('');
  readonly venueId = signal<string | null>(null);

  /** Each wheel popup keeps its own flag; the triggers are plain pill fields. */
  readonly startOpen = signal(false);
  readonly durationOpen = signal(false);

  readonly isRecurring = signal(false);
  readonly daysOfWeek = signal<number[]>([]);
  readonly endAfterOccurrences = signal(DEFAULT_GENERATED_OCCURRENCES);
  readonly endMode = signal<RecurrenceEndMode>(RecurrenceEndModes.After);
  /** `yyyy-mm-dd`, only meaningful when `endMode` is `onDate`. */
  readonly endDate = signal<string | null>(null);

  readonly saving = signal(false);
  readonly venues = signal<Venue[]>([]);
  readonly groups = signal<Group[]>([]);
  private _venuesLoaded = false;
  private _groupsLoaded = false;

  /** The first few dates the rule expands to, straight from the server. */
  readonly preview = signal<string[]>([]);
  readonly previewTruncated = signal(false);
  private readonly _preview$ = new Subject<PreviewRecurrenceRequest>();

  readonly isEdit = computed(() => this.template() !== null);

  /** A 1-on-1 has exactly one seat; asking for a capacity would be noise. */
  readonly showCapacity = computed(() => this.type() !== SessionType.Private);

  readonly isOnline = computed(() => this.locationKind() === SessionLocationKind.Online);

  /**
   * Whether the group picker is worth showing. Mirrors the web dialog: a
   * group-members session must name its group, and a GROUP-type one may.
   */
  readonly needsGroup = computed(
    () => this.access() === SessionAccess.GroupOnly || this.type() === SessionType.Group,
  );

  /** Sub-copy for the selected access level — one line, not four cards. */
  readonly accessSub = computed(
    () => this.accessOptions.find((option) => option.value === this.access())?.sub ?? '',
  );

  /** "Thu 21 May · 09:00" — the start pill's face. */
  readonly startLabel = computed(
    () => `${formatSessionDayShort(this.startAt())} · ${formatSessionTime(this.startAt())}`,
  );

  /** The two wheels are views onto `durationMinutes`, which stays the truth. */
  readonly durationHours = computed(() => Math.floor(this.durationMinutes() / 60));
  readonly durationMinutesPart = computed(() => this.durationMinutes() % 60);

  readonly canSave = computed(() => {
    if (this.title().trim().length === 0) return false;
    if (this.isOnline() && this.meetingUrl().trim().length === 0) return false;
    // Group-members access without a group is a session nobody could book.
    if (this.access() === SessionAccess.GroupOnly && !this.groupId()) return false;
    // A weekly series with no day selected would expand to nothing.
    if (this.isRecurring() && this.daysOfWeek().length === 0) return false;
    // "Ends on date" without the date is a rule the BE cannot expand.
    if (
      this.isRecurring() &&
      this.endMode() === RecurrenceEndModes.OnDate &&
      !this.endDate()
    ) {
      return false;
    }
    return true;
  });

  /** A copy announces itself, so nobody thinks they are editing the original. */
  readonly sheetTitle = computed(() => {
    if (this.isEdit()) return 'Edit session';
    return this.prefill() ? 'Duplicate session' : 'New session';
  });

  /**
   * "Mon & Wed · 16 occurrences" — the rule at a glance. Shared by the header
   * subtitle and the repeat card so the two lines can never disagree.
   */
  readonly recurrenceShort = computed(() => {
    const days = formatWeekdayList(this.daysOfWeek());
    if (!days) return 'Pick the days it repeats';

    switch (this.endMode()) {
      case RecurrenceEndModes.Never:
        return `${days} · ongoing`;
      case RecurrenceEndModes.OnDate: {
        const until = this.endDate();
        return until
          ? `${days} · until ${formatSessionDayShort(until)}`
          : `${days} · pick an end date`;
      }
      default:
        return `${days} · ${this.endAfterOccurrences()} occurrences`;
    }
  });

  /** The header's second line: what kind of schedule this will be. */
  readonly sheetSubtitle = computed(() =>
    this.isRecurring()
      ? this.recurrenceShort()
      : `One-off · ${formatSessionDayShort(this.startAt())}`,
  );

  readonly saveLabel = computed(() => {
    if (this.isEdit()) return 'Save changes';
    return this.isRecurring() ? 'Create & publish' : 'Create session';
  });

  /** The repeat toggle's sub-line — why it is locked, when it is. */
  readonly repeatSub = computed(() => {
    if (this.isRecurring()) return this.recurrenceShort();
    return this.isEdit()
      ? "Can't be changed once created"
      : 'Toggle to set up a series';
  });

  /**
   * The rule as the API wants it, or null when it would not expand to anything.
   *
   * One definition feeding both the preview and the save, so what you are shown
   * and what you get cannot be two different series.
   */
  private readonly _rule = computed<RecurrenceRule | null>(() => {
    if (!this.isRecurring()) return null;
    const days = this.daysOfWeek();
    if (days.length === 0) return null;

    const rule: RecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 1,
      daysOfWeek: [...days].sort((a, b) => a - b),
    };

    if (this.endMode() === RecurrenceEndModes.After) {
      rule.endAfterOccurrences = this.endAfterOccurrences();
    } else if (this.endMode() === RecurrenceEndModes.OnDate && this.endDate()) {
      rule.endDate = this.endDate() ?? undefined;
    }
    return rule;
  });

  /** Plain-English summary, so the rule is legible before it is committed. */
  readonly recurrenceSummary = computed(() => {
    const list = formatWeekdayList(this.daysOfWeek());
    if (!list) return 'Pick at least one day';

    switch (this.endMode()) {
      case RecurrenceEndModes.Never:
        return `Every ${list}, with no end date`;
      case RecurrenceEndModes.OnDate: {
        const until = this.endDate();
        return until
          ? `Every ${list} until ${formatSessionDayShort(until)}`
          : `Every ${list} — pick an end date`;
      }
      default:
        return `Every ${list} · ${this.endAfterOccurrences()} sessions`;
    }
  });

  /** The first handful of dates, plus how many more there are. */
  readonly previewDates = computed(() =>
    this.preview().slice(0, 4).map((iso) => formatSessionDayShort(iso)),
  );

  readonly previewMore = computed(() => Math.max(0, this.preview().length - 4));

  /**
   * Whether this slot already collides with something in the loaded window.
   *
   * Advisory and non-blocking — an overlap is the coach's call, which is
   * exactly how the BE treats it too (it warns after creating rather than
   * refusing). Only the first occurrence is checked: a whole series against a
   * whole window is a lot of work to say something the server will say anyway.
   */
  readonly conflict = computed(() => {
    // Not in edit mode: the loaded window contains the session being edited,
    // so it would flag itself — and the start it clashes on is not movable
    // from here anyway.
    if (this.isEdit()) return null;

    const startIso = this.startAt();
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;

    const clash = findOverlap(
      this._sessionsInstructorStore.rangeInstances(),
      start,
      this.durationMinutes(),
    );
    if (!clash) return null;

    const title = clash.titleOverride ?? clash.template?.title ?? 'another session';
    return {
      title: `Conflict on ${formatSessionDayShort(startIso)}`,
      detail: `${formatSessionTime(startIso)} overlaps "${title}". You can still save.`,
    };
  });

  constructor() {
    addIcons(SESSION_ICONS);

    // Re-seed each time it opens, so a cancelled edit never leaks into the next.
    // `untracked` so the effect depends on `open()` and nothing else: `_reset`
    // reads `initialStart` and `prefill`, and the loaders read their own lists,
    // and tracking those re-seeds the form mid-edit the moment a request lands.
    // That also rewrites `startAt` under an open date picker, and Ionic reacts
    // to a new `value` by scroll-animating the calendar away from the day just
    // tapped. Keep every seed read INSIDE `_reset`.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this._reset();
        this._loadVenues();
        this._loadGroups();
      });
    });

    // Ask the server what the rule expands to. Debounced because the endpoint
    // is throttled at 60/min and toggling weekday circles fires far faster than
    // that; `switchMap` so a slow earlier answer cannot overwrite a newer one.
    this._preview$
      .pipe(
        debounceTime(300),
        switchMap((request) =>
          this._sessionService.previewRecurrence(request).pipe(
            // A failed preview is not worth an error: the summary line already
            // says what the rule is, and the save path does not depend on this.
            catchError(() => of({ occurrences: [], truncated: false })),
          ),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe((response) => {
        this.preview.set(response.occurrences);
        this.previewTruncated.set(response.truncated);
      });

    effect(() => {
      const rule = this._rule();
      const startAt = this.startAt();
      const timezone = this.timezone();
      if (!rule) {
        this.preview.set([]);
        this.previewTruncated.set(false);
        return;
      }
      this._preview$.next({
        rule,
        firstStartAt: new Date(startAt).toISOString(),
        timezone,
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

  /** `ion-segment` hands back a loose `SegmentValue`; only our modes count. */
  onEndModeChange(value: string | number | undefined): void {
    const modes: readonly string[] = Object.values(RecurrenceEndModes);
    if (typeof value === 'string' && modes.includes(value)) {
      this.endMode.set(value as RecurrenceEndMode);
    }
  }

  setOccurrences(value: string | number | null | undefined): void {
    const parsed = this.toNumber(value);
    if (parsed === null) return;
    this.endAfterOccurrences.set(
      Math.min(Math.max(Math.round(parsed), 1), MAX_OCCURRENCES),
    );
  }

  setCutoffHours(value: string | number | null | undefined): void {
    const parsed = this.toNumber(value);
    if (parsed === null) return;
    this.cancellationCutoffHours.set(
      Math.min(Math.max(Math.round(parsed), 0), MAX_CUTOFF_HOURS),
    );
  }

  /** `ion-datetime` with a date presentation hands back `yyyy-mm-dd`. */
  setEndDate(value: string | string[] | null | undefined): void {
    const raw = Array.isArray(value) ? value[0] : value;
    this.endDate.set(raw ? raw.slice(0, 10) : null);
  }

  save(): void {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);

    const editing = this.template();
    if (editing) this._update(editing.id);
    else this._create();
  }

  /**
   * PATCH the template. The update DTO is whitelist+strict, so `isRecurring`,
   * `firstStartAt` and the generation knobs stay off the wire — see the class
   * doc. Price and description go out unconditionally: on a PATCH, omitting a
   * field means "keep the old value", so a cleared price has to arrive as 0
   * and a cleared description as an empty string, or clearing them would
   * silently do nothing.
   */
  private _update(id: string): void {
    const payload: UpdateTemplateRequest = {
      title: this.title().trim(),
      description: this.description().trim(),
      type: this.type(),
      access: this.access(),
      approvalRequired: this.approvalRequired(),
      locationKind: this.locationKind(),
      durationMinutes: this.durationMinutes(),
      timezone: this.timezone(),
      waitlistEnabled: this.waitlistEnabled(),
      cancellationCutoffHours: this.cancellationCutoffHours(),
      priceAmountCents: Math.round((this.priceAmount() ?? 0) * 100),
      priceCurrency: this.priceCurrency(),
    };

    if (this.needsGroup() && this.groupId()) payload.groupId = this.groupId() ?? undefined;

    if (this.isOnline()) payload.meetingUrl = this.meetingUrl().trim();
    else if (this.venueId()) payload.venueId = this.venueId() ?? undefined;

    if (this.showCapacity() && this.capacity() !== null) {
      payload.capacity = this.capacity() ?? undefined;
    }

    // Only the rule's details can change here. A payload without a rule leaves
    // the stored one untouched — which is also the safe fallback when the full
    // template failed to load and the form seeded as a one-off.
    const rule = this._rule();
    if (rule) payload.recurrenceRule = rule;

    this._sessionService
      .updateTemplate(id, payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success('Session updated');
          this.saved.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not update the session.');
        },
      });
  }

  private _create(): void {
    // `ion-datetime` hands back a local wall-clock string; the BE wants an
    // instant, and the template's own timezone is what the series expands in.
    const start = new Date(this.startAt());

    const payload: CreateTemplateRequest = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      type: this.type(),
      access: this.access(),
      approvalRequired: this.approvalRequired(),
      locationKind: this.locationKind(),
      durationMinutes: this.durationMinutes(),
      timezone: this.timezone(),
      waitlistEnabled: this.waitlistEnabled(),
      cancellationCutoffHours: this.cancellationCutoffHours(),
      isRecurring: this.isRecurring(),
      firstStartAt: start.toISOString(),
      generateInitialInstances: true,
    };

    if (this.needsGroup() && this.groupId()) payload.groupId = this.groupId() ?? undefined;

    if (this.isOnline()) payload.meetingUrl = this.meetingUrl().trim();
    else if (this.venueId()) payload.venueId = this.venueId() ?? undefined;

    if (this.showCapacity() && this.capacity() !== null) {
      payload.capacity = this.capacity() ?? undefined;
    }
    if (this.priceAmount() !== null) {
      payload.priceAmountCents = Math.round((this.priceAmount() ?? 0) * 100);
      payload.priceCurrency = this.priceCurrency();
    }

    const rule = this._rule();
    if (rule) {
      payload.recurrenceRule = rule;
      // How many rows to materialise now. A counted series generates itself
      // exactly; the open-ended modes get a first batch that `regenerate` tops
      // up later, because the BE stores occurrences rather than expanding the
      // rule on read — "never" cannot mean infinite rows.
      payload.initialInstancesCount =
        rule.endAfterOccurrences ?? DEFAULT_GENERATED_OCCURRENCES;
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
          this.saved.emit();
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

  /**
   * Seed the form. Called only from inside the open-effect's `untracked`, so
   * every input read here stays untracked — see the effect's comment before
   * moving any of these reads out.
   */
  private _reset(): void {
    this.preview.set([]);
    this.previewTruncated.set(false);
    this.timezone.set(deviceTimezone());

    const editing = this.template();
    if (editing) {
      this.title.set(editing.title);
      this.description.set(editing.description ?? '');
      this.type.set(editing.type);
      this.access.set(editing.access);
      this.approvalRequired.set(editing.approvalRequired);
      this.groupId.set(editing.groupId);
      this.locationKind.set(editing.locationKind);
      // The pill is read-only in edit mode, but the recurrence preview still
      // expands from this anchor, so it has to be the template's own.
      this.startAt.set(
        editing.firstStartAt ? toLocalIso(new Date(editing.firstStartAt)) : defaultStart(),
      );
      this.timezone.set(editing.timezone);
      this.durationMinutes.set(editing.durationMinutes);
      this.capacity.set(editing.capacity);
      this.waitlistEnabled.set(editing.waitlistEnabled);
      this.cancellationCutoffHours.set(editing.cancellationCutoffHours);
      this.priceAmount.set(
        editing.priceAmountCents > 0 ? editing.priceAmountCents / 100 : null,
      );
      this.priceCurrency.set(editing.priceCurrency);
      this.meetingUrl.set(editing.meetingUrl ?? '');
      this.venueId.set(editing.venueId);

      const rule = editing.recurrenceRule ?? null;
      this.isRecurring.set(!!editing.isRecurring);
      this.daysOfWeek.set(rule?.daysOfWeek ? [...rule.daysOfWeek] : []);
      this.endAfterOccurrences.set(
        rule?.endAfterOccurrences ?? DEFAULT_GENERATED_OCCURRENCES,
      );
      if (rule?.endAfterOccurrences) this.endMode.set(RecurrenceEndModes.After);
      else if (rule?.endDate) this.endMode.set(RecurrenceEndModes.OnDate);
      else this.endMode.set(RecurrenceEndModes.Never);
      this.endDate.set(rule?.endDate ? rule.endDate.slice(0, 10) : null);
      return;
    }

    const prefill = this.prefill();
    if (prefill) {
      this.title.set(prefill.title);
      this.description.set(prefill.description);
      this.type.set(prefill.type);
      this.access.set(prefill.access);
      this.approvalRequired.set(prefill.approvalRequired);
      this.groupId.set(prefill.groupId);
      this.locationKind.set(prefill.locationKind);
      this.startAt.set(prefill.startAt);
      this.durationMinutes.set(prefill.durationMinutes);
      this.capacity.set(prefill.capacity);
      this.waitlistEnabled.set(prefill.waitlistEnabled);
      this.cancellationCutoffHours.set(prefill.cancellationCutoffHours);
      this.priceAmount.set(prefill.priceAmount);
      this.priceCurrency.set(prefill.priceCurrency);
      this.meetingUrl.set(prefill.meetingUrl);
      this.venueId.set(prefill.venueId);
      this.isRecurring.set(prefill.isRecurring);
      this.daysOfWeek.set([...prefill.daysOfWeek]);
      this.endAfterOccurrences.set(prefill.endAfterOccurrences);
      this.endMode.set(RecurrenceEndModes.After);
      this.endDate.set(null);
      return;
    }

    this.title.set('');
    this.description.set('');
    this.type.set(SessionType.Group);
    this.access.set(SessionAccess.Open);
    this.approvalRequired.set(false);
    this.groupId.set(null);
    this.locationKind.set(SessionLocationKind.InPerson);
    const seeded = this.initialStart();
    this.startAt.set(seeded ? toLocalIso(seeded) : defaultStart());
    this.durationMinutes.set(60);
    this.capacity.set(12);
    this.waitlistEnabled.set(true);
    this.cancellationCutoffHours.set(24);
    this.priceAmount.set(null);
    this.priceCurrency.set('RON');
    this.meetingUrl.set('');
    this.venueId.set(null);
    this.isRecurring.set(false);
    this.daysOfWeek.set([]);
    this.endAfterOccurrences.set(DEFAULT_GENERATED_OCCURRENCES);
    this.endMode.set(RecurrenceEndModes.After);
    this.endDate.set(null);
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

  /** Same contract as `_loadVenues`, for the group picker. */
  private _loadGroups(): void {
    if (this._groupsLoaded) return;
    this._groupsLoaded = true;
    this._groupService
      .getMyGroups()
      .pipe(take(1))
      .subscribe({
        next: (groups) => this.groups.set(groups),
        error: () => {
          this._groupsLoaded = false;
          this.groups.set([]);
        },
      });
  }
}
