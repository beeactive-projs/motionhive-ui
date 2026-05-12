import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { getProductBillingLabel } from 'core';
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
  imports: [Card, TagModule],
  templateUrl: './offering-card.html',
  styleUrl: './offering-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingCard {
  readonly product = input.required<Product>();

  readonly priceLabel = computed(() => {
    const p = this.product();
    const amount = (p.amountCents / 100).toFixed(0);
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
