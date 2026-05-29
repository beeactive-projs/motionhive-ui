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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import {
  BottomSheet,
  CreateTemplateRequest,
  CreateTemplateResponse,
  RecurrenceRule,
  RecurrenceBuilder,
  SessionAccess,
  SessionKind,
  SessionLocationKind,
  SessionService,
  SessionTemplate,
  TIMEZONE_OPTIONS,
  Venue,
  VenueService,
  GroupService,
  Group,
  injectIsMobile,
  showApiError,
} from 'core';
import { Observable } from 'rxjs';

/**
 * `mh-session-form-dialog` — create or edit a `SessionTemplate`.
 *
 * Single dialog drives both the "new session" and "edit recurring template"
 * flows. Passing `template` switches to edit mode; the recurrence section is
 * disabled in edit mode (recurrence changes go through dedicated
 * regenerate / cancel-and-recreate flows — out of scope for V1).
 *
 * Cross-field rules mirror the BE (`SessionTemplateService.normalize`):
 *   - `locationKind = ONLINE` → `meetingUrl` required, `venueId` null
 *   - `locationKind ∈ {STUDIO, OUTDOOR, CLIENT_HOME}` → `venueId` required,
 *     `meetingUrl` null
 *   - `access = GROUP_ONLY` → `groupId` required
 *   - `isRecurring = true` → `recurrenceRule` required (handled by the
 *     `<mh-recurrence-builder>` primitive)
 *
 * V1 simplification: this dialog does NOT surface the
 * `generateInitialInstances` / `initialInstancesCount` knobs — the BE
 * generates 4 weeks ahead by default which is the right behaviour at
 * MotionHive's scale. Power users can hit the regenerate endpoint later.
 *
 * On save it emits `saved(template)` and the parent reloads its list.
 */
export interface SessionForm {
  // Basics
  title: string;
  description: string;
  type: SessionKind;
  access: SessionAccess;
  approvalRequired: boolean;
  groupId: string | null;
  // Where
  locationKind: SessionLocationKind;
  venueId: string | null;
  meetingUrl: string;
  // When
  firstStartAt: Date | null;
  durationMinutes: number;
  timezone: string;
  // Capacity + cancellation
  capacity: number | null;
  waitlistEnabled: boolean;
  cancellationCutoffHours: number;
  // Price
  priceAmountCents: number;
  priceCurrency: string;
  // Recurrence
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule;
}

const DEFAULT_RULE: RecurrenceRule = {
  frequency: 'WEEKLY',
  interval: 1,
  daysOfWeek: [1], // Monday
  endAfterOccurrences: 12,
};

function blankForm(): SessionForm {
  // First start defaults to the next round half-hour, today.
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return {
    title: '',
    description: '',
    type: 'OPEN' as SessionKind,
    access: 'OPEN' as SessionAccess,
    approvalRequired: false,
    groupId: null,
    locationKind: 'ONLINE' as SessionLocationKind,
    venueId: null,
    meetingUrl: '',
    firstStartAt: now,
    durationMinutes: 60,
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Bucharest',
    capacity: 10,
    waitlistEnabled: true,
    cancellationCutoffHours: 24,
    priceAmountCents: 0,
    priceCurrency: 'RON',
    isRecurring: false,
    recurrenceRule: { ...DEFAULT_RULE },
  };
}

@Component({
  selector: 'mh-session-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    ButtonModule,
    InputText,
    InputNumberModule,
    Select,
    TextareaModule,
    DatePickerModule,
    CheckboxModule,
    RecurrenceBuilder,
    BottomSheet,
  ],
  templateUrl: './session-form-dialog.html',
  styleUrl: './session-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionFormDialog {
  private readonly _svc = inject(SessionService);
  private readonly _venueSvc = inject(VenueService);
  private readonly _groupSvc = inject(GroupService);
  private readonly _msg = inject(MessageService);

  /**
   * Mobile breakpoint — drives the template branch: `<p-dialog>`
   * (desktop) vs `<mh-bottom-sheet size="large">` (mobile). The form
   * body is the same in both — only the chrome changes.
   */
  readonly isMobile = injectIsMobile();

  readonly visible = model(false);
  /** Null = create mode. */
  readonly template = input<SessionTemplate | null>(null);
  /**
   * Optional defaults applied in CREATE mode (when `template` is null).
   * Used by the calendar's quick-create + Shift+drag flows to hand off
   * a partial payload (title / time / duration) to the full form. Has
   * no effect when `template` is non-null.
   */
  readonly prefill = input<Partial<SessionForm> | null>(null);
  readonly saved = output<SessionTemplate>();

  readonly saving = signal(false);
  readonly form = signal<SessionForm>(blankForm());
  readonly venues = signal<Venue[]>([]);
  readonly groups = signal<Group[]>([]);

  readonly typeOptions = [
    { value: 'OPEN', label: 'Open (anyone)' },
    { value: 'GROUP', label: 'Group' },
    { value: 'PRIVATE', label: 'Private (1:1)' },
  ];
  /**
   * Access requirement options rendered as 4 radio-cards (icon + label
   * + sub-copy). The orthogonal `approvalRequired` toggle sits below as
   * a separate checkbox — both compose without enums multiplying.
   */
  readonly accessOptions: { value: SessionAccess; label: string; sub: string; icon: string }[] = [
    {
      value: 'OPEN',
      label: 'Open',
      sub: 'Anyone with the link can book.',
      icon: 'pi-globe',
    },
    {
      value: 'FREE',
      label: 'Free',
      sub: 'Listed publicly with no price tag.',
      icon: 'pi-heart',
    },
    {
      value: 'CLIENTS_ONLY',
      label: 'Clients only',
      sub: 'Only your active clients can book.',
      icon: 'pi-user',
    },
    {
      value: 'GROUP_ONLY',
      label: 'Group members',
      sub: 'Only members of a specific group.',
      icon: 'pi-sitemap',
    },
  ];
  readonly locationOptions = [
    { value: 'ONLINE', label: 'Online' },
    { value: 'IN_PERSON', label: 'In person (venue)' },
  ];
  readonly timezones = TIMEZONE_OPTIONS;
  readonly currencies = [
    { value: 'RON', label: 'RON' },
    { value: 'EUR', label: 'EUR' },
    { value: 'USD', label: 'USD' },
    { value: 'GBP', label: 'GBP' },
  ];

  readonly isEdit = computed(() => this.template() !== null);
  readonly isOnline = computed(() => this.form().locationKind === 'ONLINE');
  readonly needsVenue = computed(() => this.form().locationKind === 'IN_PERSON');
  readonly needsGroup = computed(
    () => this.form().access === 'GROUP_ONLY' || this.form().type === 'GROUP',
  );

  private readonly _initEffect = effect(() => {
    if (!this.visible()) return;
    // Lazy-load venues + groups on first open.
    if (this.venues().length === 0) {
      this._venueSvc.list().subscribe({
        next: (vs) => this.venues.set(vs),
        error: () => this.venues.set([]),
      });
    }
    if (this.groups().length === 0) {
      this._groupSvc.getMyGroups().subscribe({
        next: (gs) => this.groups.set(gs),
        error: () => this.groups.set([]),
      });
    }
    const t = this.template();
    if (t) {
      this._hydrateFromTemplate(t);
    } else {
      // Create mode — start from a blank form, then layer any prefill
      // defaults the caller supplied (e.g. calendar quick-create maps
      // the dragged time range here).
      const base = blankForm();
      const p = this.prefill();
      this.form.set(p ? { ...base, ...p } : base);
    }
  });

  updateField<K extends keyof SessionForm>(key: K, value: SessionForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  updateRule(rule: RecurrenceRule): void {
    this.form.update((f) => ({ ...f, recurrenceRule: rule }));
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    const f = this.form();
    if (!f.title.trim()) {
      this._toast('warn', 'Title required', 'Give your session a name.');
      return;
    }
    if (!f.firstStartAt) {
      this._toast('warn', 'Start date required', 'Pick when this session begins.');
      return;
    }
    // Past-date guard only applies to NEW sessions. For edits the
    // `firstStartAt` is usually historical (it's the first occurrence
    // of a series that has already begun) and the BE doesn't allow
    // moving it backwards anyway.
    if (!this.isEdit() && f.firstStartAt.getTime() < Date.now()) {
      this._toast('warn', 'Start date in the past', 'Pick a future date.');
      return;
    }
    if (f.durationMinutes < 5 || f.durationMinutes > 480) {
      this._toast('warn', 'Duration', 'Duration must be 5–480 minutes.');
      return;
    }
    if (this.isOnline()) {
      const url = f.meetingUrl.trim();
      if (!url) {
        this._toast('warn', 'Meeting link required', 'Online sessions need a URL.');
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        this._toast('warn', 'Meeting link', 'That URL doesn’t look right.');
        return;
      }
      // BE requires HTTPS (CreateTemplateDto @IsUrl protocols: ['https']).
      // Catch it up front so the user gets a useful message instead of a
      // generic 400.
      if (parsed.protocol !== 'https:') {
        this._toast('warn', 'Meeting link', 'Use an https:// URL for security.');
        return;
      }
    }
    if (this.needsVenue() && !f.venueId) {
      this._toast('warn', 'Venue required', 'Pick a venue for in-person sessions.');
      return;
    }
    if (this.needsGroup() && !f.groupId) {
      this._toast('warn', 'Group required', 'Pick a group for this access type.');
      return;
    }
    if (f.isRecurring) {
      const r = f.recurrenceRule;
      if (r.frequency === 'WEEKLY' && (!r.daysOfWeek || r.daysOfWeek.length === 0)) {
        this._toast('warn', 'Pick at least one day', 'Weekly schedules need at least one day of the week.');
        return;
      }
      if (r.interval < 1) {
        this._toast('warn', 'Invalid recurrence', 'Repeat interval must be at least 1.');
        return;
      }
    }

    const existing = this.template();
    // Fields shared between create + update — same shape, same names.
    const common = {
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      type: f.type,
      access: f.access,
      approvalRequired: f.approvalRequired,
      groupId: this.needsGroup() && f.groupId ? f.groupId : undefined,
      locationKind: f.locationKind,
      meetingUrl: this.isOnline() ? f.meetingUrl.trim() : undefined,
      venueId: this.needsVenue() && f.venueId ? f.venueId : undefined,
      durationMinutes: f.durationMinutes,
      timezone: f.timezone,
      capacity: f.capacity ?? undefined,
      waitlistEnabled: f.waitlistEnabled,
      cancellationCutoffHours: f.cancellationCutoffHours,
      priceAmountCents: f.priceAmountCents,
      priceCurrency: f.priceCurrency,
      recurrenceRule: f.isRecurring ? f.recurrenceRule : undefined,
    };

    this.saving.set(true);
    let req$: Observable<SessionTemplate | CreateTemplateResponse>;
    if (existing) {
      // Update path — UpdateTemplateDto on the BE is whitelist+strict,
      // so we must NOT send `isRecurring`, `firstStartAt`, or
      // `generateInitialInstances`. Recurrence flag is fixed once the
      // template exists; users go through cancel+recreate to change it.
      req$ = this._svc.updateTemplate(existing.id, common);
    } else {
      // Create path — full create-shape with the recurrence flag and
      // first-start anchor.
      const createPayload: CreateTemplateRequest = {
        ...common,
        isRecurring: f.isRecurring,
        firstStartAt: f.firstStartAt.toISOString(),
        // BE only generates initial occurrences when this is explicit
        // on recurring templates (non-recurring auto-generates a
        // single occurrence by default).
        ...(f.isRecurring ? { generateInitialInstances: true } : {}),
      };
      req$ = this._svc.createTemplate(createPayload);
    }

    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.visible.set(false);
        // createTemplate returns CreateTemplateResponse; update returns SessionTemplate.
        const tpl = 'template' in res ? res.template : res;
        const warns = 'warnings' in res ? res.warnings : [];
        this._toast(
          'success',
          existing ? 'Session updated' : 'Session created',
          warns.length > 0
            ? `${warns.length} occurrence(s) had conflicts — review in the calendar.`
            : 'Saved.',
        );
        this.saved.emit(tpl);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        showApiError(this._msg, 'Could not save session', 'Please try again.', err);
      },
    });
  }

  private _toast(severity: 'success' | 'warn' | 'error', summary: string, detail: string): void {
    this._msg.add({ severity, summary, detail });
  }

  /**
   * Populate the form from a SessionTemplate (edit mode).
   *
   * The template input may come from an eager-loaded `SessionInstance.template`
   * which OMITS several fields (firstStartAt, isRecurring, recurrenceRule,
   * status, timestamps) — that's a BE shape quirk we work around here.
   * When critical fields are missing we re-fetch the full template via
   * `GET /sessions/templates/:id` and re-patch.
   */
  private _hydrateFromTemplate(t: SessionTemplate): void {
    this.form.set({
      title: t.title,
      description: t.description ?? '',
      type: t.type as SessionKind,
      access: t.access as SessionAccess,
      approvalRequired: t.approvalRequired,
      groupId: t.groupId,
      locationKind: t.locationKind as SessionLocationKind,
      venueId: t.venueId,
      meetingUrl: t.meetingUrl ?? '',
      firstStartAt: t.firstStartAt ? new Date(t.firstStartAt) : null,
      durationMinutes: t.durationMinutes,
      timezone: t.timezone,
      capacity: t.capacity,
      waitlistEnabled: t.waitlistEnabled,
      cancellationCutoffHours: t.cancellationCutoffHours,
      priceAmountCents: t.priceAmountCents,
      priceCurrency: t.priceCurrency,
      isRecurring: t.isRecurring ?? false,
      recurrenceRule: t.recurrenceRule ?? { ...DEFAULT_RULE },
    });
    // Eager-loaded instance.template omits firstStartAt + isRecurring +
    // recurrenceRule. If we detect that, fetch the full template and
    // patch the form so the date / recurrence inputs are accurate.
    const needsHydrate =
      t.firstStartAt == null || t.isRecurring == null;
    if (needsHydrate && t.id) {
      this._svc.getTemplate(t.id).subscribe({
        next: (full) => {
          this.form.update((f) => ({
            ...f,
            firstStartAt: full.firstStartAt
              ? new Date(full.firstStartAt)
              : f.firstStartAt,
            isRecurring: full.isRecurring,
            recurrenceRule: full.recurrenceRule ?? f.recurrenceRule,
          }));
        },
        error: () => {
          // Silent — the form is still usable with what we have.
        },
      });
    }
  }
}
