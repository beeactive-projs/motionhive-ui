import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PublicProfileStore } from 'core';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';

/**
 * Renders the bio paragraph, specializations, and certifications. All
 * data is on the root profile so no extra fetch is needed.
 */
@Component({
  selector: 'mh-public-profile-about-tab',
  imports: [Card, TagModule],
  templateUrl: './about-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  readonly hasContent = computed(() => {
    const p = this._store.profile();
    if (!p) return false;
    return !!(
      p.bio ||
      (p.specializations && p.specializations.length > 0) ||
      (p.certifications && p.certifications.length > 0)
    );
  });
}
