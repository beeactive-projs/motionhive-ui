import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { appLocale, getProductBillingLabel, ProductTypes } from 'core';
import type { Product } from 'core';

interface ProductWithMeta extends Product {
  metadata?: Record<string, unknown> | null;
}

/**
 * One Stripe product as an offering card. We read `popular=true` from
 * the product's Stripe `metadata`, when present — instructors mark a
 * single offering as the headline via the existing products editor.
 */
@Component({
  selector: 'mh-offering-card',
  imports: [ButtonDirective, Card, TagModule, TranslatePipe],
  templateUrl: './offering-card.html',
  styleUrl: './offering-card.scss',
})
export class OfferingCard {
  readonly product = input.required<Product>();

  /** CTA clicked — the shell decides: guests register, clients contact the coach. */
  readonly choose = output<void>();

  /** "Choose plan" for recurring offerings, "Get started" for one-offs (translation key). */
  readonly ctaKey = computed(() =>
    this.product().type === ProductTypes.Subscription
      ? 'publicProfile.offerings.choosePlan'
      : 'publicProfile.offerings.getStarted',
  );

  readonly priceLabel = computed(() => {
    const p = this.product();
    const amount = new Intl.NumberFormat(appLocale(), {
      maximumFractionDigits: 0,
      useGrouping: false,
    }).format(p.amountCents / 100);
    return `${amount} ${p.currency.toUpperCase()}`;
  });

  readonly billingLabel = computed(() => getProductBillingLabel(this.product()));

  readonly isPopular = computed(() => {
    const meta = (this.product() as ProductWithMeta).metadata;
    if (!meta) return false;
    const value = meta['popular'];
    return value === true || value === 'true';
  });
}
