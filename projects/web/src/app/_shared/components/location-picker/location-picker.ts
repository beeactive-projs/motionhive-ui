import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { UserLocation } from 'core';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

interface NominatimResult {
  display_name: string;
  address: {
    leisure?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

interface LocationSuggestion {
  label: string;
  mainText: string;
  secondaryText: string;
  result: NominatimResult;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_EMAIL = 'beeactivedev@gmail.com';

@Component({
  selector: 'mh-location-picker',
  imports: [AutoComplete, IconField, InputIcon],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPicker {
  private readonly _http = inject(HttpClient);

  readonly location = model<UserLocation | null>(null);
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
                .pipe(catchError(() => of([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        console.log('Nominatim results:', results);
        this.suggestions.set(
          results.map((r) => ({
            label: r.display_name,
            mainText:
              `${r.address.leisure || ''} ${r.address.suburb || ''} ${r.address.road?.split(' ').slice(1).join(' ')} ${r.address.city}`.trim(),
            secondaryText:
              `${r.address.road || ''}, ${r.address.city || ''}, ${r.address.country || ''}`.trim(),
            result: r,
          })),
        );
      });
  }

  search(event: AutoCompleteCompleteEvent): void {
    this._search$.next(event.query);
  }

  selectPlace(event: AutoCompleteSelectEvent): void {
    const suggestion = event.value as LocationSuggestion;
    const { display_name, address } = suggestion.result;
    this.location.set({
      name: display_name.split(',').slice(0, 2).join(',').trim(),
      address: display_name,
      city: address.city ?? address.town ?? address.village ?? address.county ?? null,
      country: address.country ?? null,
    });
    this.suggestions.set([]);
  }

  clear(): void {
    this.location.set(null);
    this.suggestions.set([]);
  }

  format(loc: UserLocation): string {
    const parts: string[] = [];
    if (loc.name) parts.push(loc.name);
    if (loc.city) parts.push(loc.city);
    else if (loc.country) parts.push(loc.country);
    return parts.join(', ');
  }
}
