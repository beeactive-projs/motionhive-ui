import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { PickedLocation } from 'core';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

/**
 * Raw Nominatim response shape — only the fields we read. Nominatim
 * returns many more, we just ignore them.
 */
interface NominatimResult {
  display_name: string;
  lat?: string;
  lon?: string;
  address: {
    leisure?: string;
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

interface LocationSuggestion {
  label: string;
  mainText: string;
  secondaryText: string;
  result: NominatimResult;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_EMAIL = 'contact@motionhive.fit';

@Component({
  selector: 'mh-location-picker',
  imports: [AutoComplete, ButtonModule, IconField, InputIcon],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPicker {
  private readonly _http = inject(HttpClient);

  /**
   * Two-way bound. `null` means no location selected.
   * Parent binds via `[(location)]` or `[location]` + `(locationChange)`.
   */
  readonly location = model<PickedLocation | null>(null);
  /**
   * When true the picker becomes read-only: no clear button, no
   * autocomplete, just the selected chip. Used when the country has
   * been locked downstream (e.g. after Stripe Connect onboarding).
   */
  readonly disabled = input(false);
  readonly suggestions = signal<LocationSuggestion[]>([]);

  private readonly _search$ = new Subject<string>();

  constructor() {
    this._search$
      .pipe(
        debounceTime(500),
        switchMap((query) =>
          query.length < 2
            ? of([])
            : this._http
                .get<NominatimResult[]>(NOMINATIM_URL, {
                  params: {
                    q: query,
                    format: 'json',
                    addressdetails: '1',
                    limit: '5',
                    email: NOMINATIM_EMAIL,
                  },
                })
                .pipe(catchError(() => of([] as NominatimResult[]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.suggestions.set(
          results.map((r) => {
            const addr = r.address;
            const city =
              addr.city ??
              addr.town ??
              addr.village ??
              addr.municipality ??
              addr.county ??
              '';
            const secondary = [addr.road, city, addr.country]
              .filter(Boolean)
              .join(', ');
            return {
              label: r.display_name,
              mainText: addr.leisure || addr.suburb || city || r.display_name,
              secondaryText: secondary,
              result: r,
            };
          }),
        );
      });
  }

  search(event: AutoCompleteCompleteEvent): void {
    this._search$.next(event.query);
  }

  selectPlace(event: AutoCompleteSelectEvent): void {
    const suggestion = event.value as LocationSuggestion;
    const { display_name, address, lat, lon } = suggestion.result;
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.county ??
      null;
    const streetParts = [address.house_number, address.road]
      .filter(Boolean)
      .join(' ');
    this.location.set({
      displayName: display_name.split(',').slice(0, 2).join(',').trim(),
      line1: streetParts || null,
      city,
      region: address.state ?? null,
      postalCode: address.postcode ?? null,
      country: address.country ?? null,
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,
      latitude: lat ? Number(lat) : null,
      longitude: lon ? Number(lon) : null,
    });
    this.suggestions.set([]);
  }

  clear(): void {
    this.location.set(null);
    this.suggestions.set([]);
  }

  format(loc: PickedLocation): string {
    const parts: string[] = [];
    if (loc.displayName) parts.push(loc.displayName);
    else if (loc.city) parts.push(loc.city);
    if (loc.country && !parts.join(', ').includes(loc.country)) {
      parts.push(loc.country);
    }
    return parts.join(', ');
  }
}
