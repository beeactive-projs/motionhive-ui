import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';

import { MeetingProvider, PickedLocation, PlaceSearchService, Venue, VenueKind } from 'core';

import {
  MEETING_PROVIDER_OPTIONS,
  VENUE_ICONS,
  VENUE_KIND_OPTIONS,
  VENUE_NAME_MAX_LENGTH,
  VENUE_MEETING_URL_MAX_LENGTH,
  VENUE_TRAVEL_MAX_KM,
  VenueDraft,
  blankVenueDraft,
  canSaveVenue,
  defaultVenueName,
  meetingLinkInvalid,
  needsAddress,
  nextVenueName,
  placeText,
  providerFromLink,
  takesArea,
  venueDraftFrom,
} from '../../config/venues.config';
import { SearchbarAutofocusDirective } from '../../directives/searchbar-autofocus.directive';
import { SearchbarLabelDirective } from '../../directives/searchbar-label.directive';
import { dismissKeyboard, focusedTextEntry } from '../../utils/keyboard';
import { HexAvatar } from '../hex-avatar/hex-avatar';
import { SheetShell } from '../sheet-shell/sheet-shell';

/** The address search waits for a pause in typing, like the welcome city step. */
const ADDRESS_SEARCH_DEBOUNCE_MS = 300;

/**
 * Add or change one place a coach works from: a gym, a studio, a park,
 * clients' homes, online.
 *
 * The kind decides the rest. A place with an address of its own picks it
 * from a search (the API needs its city); clients' homes may name the area
 * served and how far the coach travels; online may say the platform and a
 * meeting link, both optional (the link is never on the public profile).
 * The name offers a default for the kinds that have one ("Online", the
 * platform, "At clients' homes") until something else is typed.
 *
 * The address opens on a row with its value and searches only once tapped,
 * as the welcome city step does, so the sheet never opens on a keyboard.
 *
 * The sheet only emits what was filled in; the caller sends it, closes the
 * sheet on success and keeps it open, filled in, on a failure (`saving`
 * locks it meanwhile), per docs/MOBILE-ACTIONS.md.
 */
@Component({
  selector: 'mh-venue-sheet',
  imports: [
    HexAvatar,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSpinner,
    SearchbarAutofocusDirective,
    SearchbarLabelDirective,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './venue-sheet.html',
  styleUrl: './venue-sheet.scss',
})
export class VenueSheet {
  private readonly _placeSearchService = inject(PlaceSearchService);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  /** The place to change, or null to add one. */
  readonly venue = input<Venue | null>(null);
  readonly saving = input(false);

  /** What was filled in, once Save is pressed. */
  readonly save = output<VenueDraft>();

  readonly kindOptions = VENUE_KIND_OPTIONS;
  readonly providerOptions = MEETING_PROVIDER_OPTIONS;
  readonly nameMaxLength = VENUE_NAME_MAX_LENGTH;
  readonly linkMaxLength = VENUE_MEETING_URL_MAX_LENGTH;
  readonly travelMaxKm = VENUE_TRAVEL_MAX_KM;

  readonly draft = signal<VenueDraft>(blankVenueDraft());
  /** The address search is open (it opens only on a tap). */
  readonly searchingAddress = signal(false);
  /** The link field was left once: its error shows from then on, not while the first characters go in. */
  readonly linkTouched = signal(false);

  readonly isEdit = computed(() => this.venue() !== null);
  readonly title = computed(() => {
    if (this.isEdit()) {
      return 'venues.sheet.editTitle';
    }
    return 'venues.sheet.addTitle';
  });

  readonly kind = computed(() => this.draft().kind);
  readonly isOnline = computed(() => this.kind() === VenueKind.ONLINE);
  readonly isClientHome = computed(() => takesArea(this.kind()));
  readonly hasAddress = computed(() => needsAddress(this.kind()));
  readonly showPlaceRow = computed(() => this.hasAddress() || this.isClientHome());

  readonly namePlaceholder = computed(() => `venues.sheet.namePlaceholder.${this.kind()}`);

  /** An area is searched by city, an address by street or place. */
  readonly searchPlaceholder = computed(() => {
    if (this.isClientHome()) {
      return 'venues.sheet.areaSearch';
    }
    return 'venues.sheet.addressSearch';
  });

  /** The picked address (or area) as its row says it. */
  readonly placeLabel = computed(() => {
    const place = this.draft().place;
    if (!place) {
      return null;
    }
    if (this.isClientHome()) {
      return place.city;
    }
    return placeText(place);
  });

  readonly linkInvalid = computed(() => this.linkTouched() && meetingLinkInvalid(this.draft()));
  readonly canSave = computed(() => canSaveVenue(this.draft()));

  /** What is typed in the address search now. */
  readonly addressQuery = signal('');
  private readonly _addressQuery$ = new Subject<string>();
  readonly searching = signal(false);
  private readonly _addressAnswer = toSignal(
    this._addressQuery$.pipe(
      debounceTime(ADDRESS_SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap(() => this.searching.set(true)),
      switchMap((query) =>
        this._placeSearchService.search(query).pipe(map((found) => ({ query, found }))),
      ),
      tap(() => this.searching.set(false)),
      takeUntilDestroyed(),
    ),
    { initialValue: { query: '', found: [] as PickedLocation[] } },
  );

  /** Only places that name a city: the API needs one for an address, and an area is a city. */
  readonly results = computed(() => {
    if (this.addressQuery().trim() === '') {
      return [];
    }
    return this._addressAnswer().found.filter((found) => !!found.city);
  });

  /** The search answered what is typed now and found nothing to pick. */
  readonly noResults = computed(() => {
    const answer = this._addressAnswer();
    if (this.searching() || answer.query !== this.addressQuery()) {
      return false;
    }
    return answer.query.trim().length >= 2 && this.results().length === 0;
  });

  constructor() {
    addIcons(VENUE_ICONS);

    // Filled afresh on every opening: the place being changed, or nothing.
    effect(() => {
      if (!this.open()) {
        return;
      }
      const venue = untracked(() => this.venue());
      if (venue) {
        this.draft.set(venueDraftFrom(venue));
      } else {
        this.draft.set(blankVenueDraft());
      }
      this.searchingAddress.set(false);
      this.linkTouched.set(false);
      this.addressQuery.set('');
    });
  }

  isKind(kind: VenueKind): boolean {
    return this.kind() === kind;
  }

  isProvider(provider: MeetingProvider): boolean {
    return this.draft().meetingProvider === provider;
  }

  pickKind(kind: VenueKind): void {
    const before = this.draft();
    if (before.kind === kind) {
      return;
    }
    const previousDefault = this._defaultName(before.kind, before.meetingProvider);
    const nextDefault = this._defaultName(kind, before.meetingProvider);
    let place = before.place;
    // An area is a city: a street picked for a gym does not carry over to
    // clients' homes, nor an area to a gym (it has no street).
    if (takesArea(kind) !== takesArea(before.kind)) {
      place = null;
    }
    this.searchingAddress.set(false);
    this.draft.set({
      ...before,
      kind,
      place,
      name: nextVenueName(before.name, previousDefault, nextDefault),
    });
  }

  /** A platform chip: tapped again, it is cleared (the platform is optional). */
  pickProvider(provider: MeetingProvider): void {
    const before = this.draft();
    let next: MeetingProvider | null = provider;
    if (before.meetingProvider === provider) {
      next = null;
    }
    this._setProvider(next);
  }

  onName(value: string | null | undefined): void {
    this.draft.update((draft) => ({ ...draft, name: value ?? '' }));
  }

  /** A pasted Zoom, Meet or Teams link picks its platform when none is picked yet. */
  onLink(value: string | null | undefined): void {
    const url = value ?? '';
    this.draft.update((draft) => ({ ...draft, meetingUrl: url }));
    if (this.draft().meetingProvider) {
      return;
    }
    const detected = providerFromLink(url);
    if (detected) {
      this._setProvider(detected);
    }
  }

  onLinkBlur(): void {
    this.linkTouched.set(true);
  }

  onTravel(value: string | null | undefined): void {
    let km: number | null = null;
    if (value !== null && value !== undefined && value.trim() !== '') {
      km = Number(value);
    }
    this.draft.update((draft) => ({ ...draft, travelRadiusKm: km }));
  }

  openAddressSearch(): void {
    this.addressQuery.set('');
    this.searchingAddress.set(true);
  }

  /** The search's Cancel: the address stays as it was. */
  keepAddress(): void {
    void dismissKeyboard(focusedTextEntry());
    this.searchingAddress.set(false);
  }

  onAddressSearch(value: string | null | undefined): void {
    const query = value ?? '';
    this.addressQuery.set(query);
    this._addressQuery$.next(query);
  }

  pickAddress(place: PickedLocation): void {
    void dismissKeyboard(focusedTextEntry());
    this.draft.update((draft) => ({ ...draft, place }));
    this.searchingAddress.set(false);
  }

  /** Clients' homes: the area is optional, so it can be taken off again. */
  clearArea(): void {
    this.draft.update((draft) => ({ ...draft, place: null }));
  }

  resultTitle(place: PickedLocation): string {
    if (this.isClientHome() && place.city) {
      return place.city;
    }
    return placeText(place);
  }

  submit(): void {
    void dismissKeyboard(focusedTextEntry());
    this.linkTouched.set(true);
    if (!this.canSave()) {
      return;
    }
    this.save.emit(this.draft());
  }

  private _setProvider(provider: MeetingProvider | null): void {
    const before = this.draft();
    const previousDefault = this._defaultName(before.kind, before.meetingProvider);
    const nextDefault = this._defaultName(before.kind, provider);
    this.draft.set({
      ...before,
      meetingProvider: provider,
      name: nextVenueName(before.name, previousDefault, nextDefault),
    });
  }

  private _defaultName(kind: VenueKind, provider: MeetingProvider | null): string {
    return defaultVenueName(kind, provider, (key) => this._translateService.instant(key));
  }
}
