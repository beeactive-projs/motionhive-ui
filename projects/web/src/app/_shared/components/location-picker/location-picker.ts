import { ChangeDetectionStrategy, Component, inject, model, NgZone, signal } from '@angular/core';
import { environment, UserLocation } from 'core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Button } from 'primeng/button';
import {
  AutoComplete,
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

interface PlaceSuggestion {
  label: string;
  mainText: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
}

@Component({
  selector: 'mh-location-picker',
  imports: [Button, AutoComplete, IconField, InputIcon],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPicker {
  private readonly _ngZone = inject(NgZone);

  readonly location = model<UserLocation | null>(null);
  readonly suggestions = signal<PlaceSuggestion[]>([]);

  async search(event: AutoCompleteCompleteEvent): Promise<void> {
    const query = event.query;
    if (!query || query.length < 2) {
      this.suggestions.set([]);
      return;
    }

    setOptions({ key: environment.googleMapsApiKey });
    await importLibrary('places');

    const { suggestions } =
      await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
      });

    this._ngZone.run(() => {
      this.suggestions.set(
        suggestions
          .filter((s) => s.placePrediction !== null)
          .map((s) => ({
            label: s.placePrediction!.text.toString(),
            mainText: s.placePrediction!.mainText?.toString() ?? s.placePrediction!.text.toString(),
            secondaryText: s.placePrediction!.secondaryText?.toString() ?? '',
            prediction: s.placePrediction!,
          })),
      );
    });
  }

  async selectPlace(event: AutoCompleteSelectEvent): Promise<void> {
    const suggestion = event.value as PlaceSuggestion;
    const place = suggestion.prediction.toPlace();
    await place.fetchFields({ fields: ['addressComponents', 'displayName', 'formattedAddress'] });

    this._ngZone.run(() => {
      const components: google.maps.places.AddressComponent[] =
        place.addressComponents ?? [];
      const name = place.displayName ?? null;
      const address = place.formattedAddress ?? null;
      const city =
        components.find(
          (c: google.maps.places.AddressComponent) =>
            c.types.includes('locality') || c.types.includes('postal_town'),
        )?.longText ?? null;
      const country =
        components.find((c: google.maps.places.AddressComponent) =>
          c.types.includes('country'),
        )?.longText ?? null;
      this.location.set({ name, address, city, country });
    });
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
