import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hex } from 'core';
import type { MarketingFeature } from '../../../_data/features';

/**
 * Feature tile — hex badge + name + one-liner + "see how it works". Driven by
 * a `MarketingFeature`, so the homepage grid and the /features overview stay
 * identical. Links straight to the feature's own page by default; pass `link`
 * to override.
 */
@Component({
  selector: 'mh-feature-card',
  imports: [RouterLink, Hex],
  template: `
    <a class="fcard mh-card mh-card--hover" [routerLink]="resolvedLink()">
      <mh-hex [size]="46" [tone]="feature().tone">{{ feature().icon }}</mh-hex>
      <h3 class="fcard__name">{{ feature().name }}</h3>
      <p class="fcard__one">{{ feature().oneLiner }}</p>
      <span class="fcard__link">
        <span i18n="@@featureCard.see">See how it works</span>
        <i class="pi pi-arrow-right" aria-hidden="true"></i>
      </span>
    </a>
  `,
  styleUrl: './feature-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureCard {
  readonly feature = input.required<MarketingFeature>();
  /** Override the destination; defaults to the feature's own page. */
  readonly link = input('');
  protected readonly resolvedLink = computed(
    () => this.link() || `/features/${this.feature().slug}`,
  );
}
