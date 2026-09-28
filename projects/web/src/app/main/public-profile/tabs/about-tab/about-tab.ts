import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PublicProfileStore, type PublicVenue, type PublicVenueKind } from 'core';
import { Avatar } from 'primeng/avatar';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';

/**
 * Renders the bio paragraph, certifications, and specializations as a
 * single section card that lives inline on the profile page.
 */
@Component({
  selector: 'mh-public-profile-about-tab',
  imports: [Avatar, Card, TagModule, TranslatePipe],
  templateUrl: './about-tab.html',
  styleUrl: './about-tab.scss',
})
export class AboutTab {
  private readonly _store = inject(PublicProfileStore);

  readonly profile = this._store.profile;

  readonly specializations = computed(
    () => this._store.profile()?.specializations ?? [],
  );

  readonly certifications = computed(
    () => this._store.profile()?.certifications ?? [],
  );

  readonly venues = computed(() => this._store.profile()?.venues ?? []);

  readonly hasContent = computed(() => {
    const p = this._store.profile();
    if (!p) return false;
    return !!(
      p.bio ||
      (p.specializations && p.specializations.length > 0) ||
      (p.certifications && p.certifications.length > 0) ||
      (p.venues && p.venues.length > 0)
    );
  });

  /** Translation key for a venue's type badge. */
  private static readonly KIND_KEYS: Record<PublicVenueKind, string> = {
    GYM: 'publicProfile.about.venueKind.GYM',
    STUDIO: 'publicProfile.about.venueKind.STUDIO',
    PARK: 'publicProfile.about.venueKind.PARK',
    OUTDOOR: 'publicProfile.about.venueKind.OUTDOOR',
    CLIENT_HOME: 'publicProfile.about.venueKind.CLIENT_HOME',
    ONLINE: 'publicProfile.about.venueKind.ONLINE',
    OTHER: 'publicProfile.about.venueKind.OTHER',
  };

  venueKindKey(v: PublicVenue): string {
    return AboutTab.KIND_KEYS[v.kind] ?? AboutTab.KIND_KEYS.OTHER;
  }

  /** City · region line for physical venues; null for online (badge says it all). */
  venueLocation(v: PublicVenue): string | null {
    if (v.isOnline) return null;
    const loc = [v.city, v.region].filter(Boolean).join(', ');
    return loc || null;
  }

  /** Fitness acronyms that should stay uppercase when de-slugging. */
  private static readonly ACRONYMS = new Set(['hiit', 'trx', 'amrap', 'emom', 'wod']);

  /**
   * Prettify a specialization for display. Instructors type these as free
   * text, so most already look right ("Strength & Conditioning") and are
   * left untouched. Only slug-shaped legacy values (all lowercase, e.g.
   * "strength_training", "hiit") get de-slugged to "Strength Training",
   * "HIIT" — we never re-case human input.
   */
  prettifySpecialization(spec: string): string {
    const v = spec.trim();
    if (!v || /\s/.test(v) || /[A-Z]/.test(v)) return v;
    return v
      .split(/[_-]+/)
      .filter(Boolean)
      .map((w) =>
        AboutTab.ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
      )
      .join(' ');
  }
}
