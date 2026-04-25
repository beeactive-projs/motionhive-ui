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
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import {
  CreateVenuePayload,
  MeetingProvider,
  PickedLocation,
  UpdateVenuePayload,
  Venue,
  VenueKind,
  VenueService,
  detectMeetingProvider,
  normalizeUrl,
  showApiError,
} from 'core';
import { LocationPicker } from '../../../../_shared/components/location-picker/location-picker';
import {
  MEETING_PROVIDER_META,
  VENUE_KINDS_ORDERED,
  VENUE_KIND_META,
  isPhysicalKind,
} from '../venue-kind.utils';

/**
 * Create-or-edit venue dialog. Passing `venue` as an input switches
 * to edit mode; omitting it (or passing null) creates a new one.
 *
 * The form is local signal state; on save it emits `saved(venue)`
 * and closes. The parent is responsible for refreshing its list.
 *
 * Cross-field rules match the backend service:
 *   - kind=ONLINE -> meetingUrl required, address fields null.
 *   - CLIENT_HOME -> no address; travelRadiusKm optional.
 *   - other kinds -> city required.
 */
interface VenueForm {
  kind: VenueKind;
  name: string;
  notes: string;
  // physical
  location: PickedLocation | null;
  // online
  meetingUrl: string;
  meetingProvider: MeetingProvider | null;
  // client_home
  travelRadiusKm: number | null;
}

const BLANK_FORM: VenueForm = {
  kind: VenueKind.GYM,
  name: '',
  notes: '',
  location: null,
  meetingUrl: '',
  meetingProvider: null,
  travelRadiusKm: null,
};

@Component({
  selector: 'mh-venue-form-dialog',
  imports: [
    FormsModule,
    Dialog,
    ButtonModule,
    InputText,
    TextareaModule,
    Select,
    InputNumberModule,
    LocationPicker,
  ],
  templateUrl: './venue-form-dialog.html',
  styleUrl: './venue-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenueFormDialog {
  private readonly _venueService = inject(VenueService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  /** Null = create mode. */
  readonly venue = input<Venue | null>(null);
  readonly saved = output<Venue>();

  readonly saving = signal(false);
  readonly form = signal<VenueForm>({ ...BLANK_FORM });

  readonly kindOptions = VENUE_KINDS_ORDERED.map((k) => ({
    value: k,
    ...VENUE_KIND_META[k],
  }));

  readonly meetingProviderOptions = Object.values(MeetingProvider).map((p) => ({
    value: p,
    label: MEETING_PROVIDER_META[p].label,
  }));

  readonly isEdit = computed(() => this.venue() !== null);
  readonly isOnline = computed(() => this.form().kind === VenueKind.ONLINE);
  readonly isClientHome = computed(
    () => this.form().kind === VenueKind.CLIENT_HOME,
  );
  readonly needsAddress = computed(() => isPhysicalKind(this.form().kind));

  private readonly _initEffect = effect(() => {
    if (!this.visible()) return;
    const v = this.venue();
    if (v) {
      this.form.set({
        kind: v.kind,
        name: v.name,
        notes: v.notes ?? '',
        location:
          v.city || v.line1 || v.countryCode
            ? {
                displayName: [v.line1, v.city].filter(Boolean).join(', '),
                line1: v.line1,
                city: v.city,
                region: v.region,
                postalCode: v.postalCode,
                country: null,
                countryCode: v.countryCode,
                latitude: v.latitude,
                longitude: v.longitude,
              }
            : null,
        meetingUrl: v.meetingUrl ?? '',
        meetingProvider: v.meetingProvider,
        travelRadiusKm: v.travelRadiusKm,
      });
    } else {
      this.form.set({ ...BLANK_FORM });
    }
  });

  updateField<K extends keyof VenueForm>(key: K, value: VenueForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  /**
   * Meeting-URL change handler. Auto-detects the provider from the
   * hostname when the user hasn't already picked one — lets them
   * paste a Zoom link and have the provider dropdown fill in.
   * Silently no-ops if we can't identify the host.
   */
  onMeetingUrlChange(value: string): void {
    this.form.update((f) => {
      const next: VenueForm = { ...f, meetingUrl: value };
      if (!f.meetingProvider) {
        const detected = detectMeetingProvider(value);
        if (detected) next.meetingProvider = detected as MeetingProvider;
      }
      return next;
    });
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Give this venue a short name.',
      });
      return;
    }
    let normalizedMeetingUrl: string | null = null;
    if (f.kind === VenueKind.ONLINE) {
      if (!f.meetingUrl.trim()) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Meeting link required',
          detail: 'Paste the meeting URL for online venues.',
        });
        return;
      }
      normalizedMeetingUrl = normalizeUrl(f.meetingUrl);
      if (!normalizedMeetingUrl) {
        this._messageService.add({
          severity: 'warn',
          summary: 'Meeting link looks invalid',
          detail: 'Use something like zoom.us/j/123 or https://meet.google.com/...',
        });
        return;
      }
    }
    if (this.needsAddress() && !f.location?.city) {
      this._messageService.add({
        severity: 'warn',
        summary: 'City required',
        detail: 'Pick a location for physical venues.',
      });
      return;
    }

    const payload: CreateVenuePayload = {
      kind: f.kind,
      name: f.name.trim(),
      notes: f.notes.trim() || undefined,
    };

    if (this.needsAddress() && f.location) {
      payload.line1 = f.location.line1 ?? undefined;
      payload.city = f.location.city ?? undefined;
      payload.region = f.location.region ?? undefined;
      payload.postalCode = f.location.postalCode ?? undefined;
      payload.countryCode = f.location.countryCode ?? undefined;
      payload.latitude = f.location.latitude ?? undefined;
      payload.longitude = f.location.longitude ?? undefined;
    }

    if (f.kind === VenueKind.ONLINE && normalizedMeetingUrl) {
      payload.meetingUrl = normalizedMeetingUrl;
      payload.meetingProvider = f.meetingProvider ?? MeetingProvider.OTHER;
    }

    if (f.kind === VenueKind.CLIENT_HOME && f.travelRadiusKm != null) {
      payload.travelRadiusKm = f.travelRadiusKm;
    }

    this.saving.set(true);
    const existing = this.venue();
    const request$ = existing
      ? this._venueService.update(existing.id, payload as UpdateVenuePayload)
      : this._venueService.create(payload);

    request$.subscribe({
      next: (v) => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: existing ? 'Venue updated' : 'Venue added',
        });
        this.saved.emit(v);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        showApiError(
          this._messageService,
          'Could not save venue',
          'Please try again.',
          err,
        );
      },
    });
  }
}
