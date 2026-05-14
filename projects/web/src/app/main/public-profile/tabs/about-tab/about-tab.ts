import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PublicProfileStore } from 'core';
import { Avatar } from 'primeng/avatar';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';

/**
 * Renders the bio paragraph, certifications, and specializations as a
 * single section card that lives inline on the profile page.
 */
@Component({
  selector: 'mh-public-profile-about-tab',
  imports: [Avatar, Card, TagModule],
  templateUrl: './about-tab.html',
  styleUrl: './about-tab.scss',
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
