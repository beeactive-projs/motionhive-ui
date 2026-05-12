import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PublicProfileStore, getProductBillingLabel } from 'core';
import type { PublicInstructorProfile, Product } from 'core';

interface SocialLink {
  key: string;
  label: string;
  icon: string;
  url: string;
}

/**
 * Sticky right rail (desktop ≥ lg). Three cards stacked: pricing,
 * at-a-glance, socials. Hidden on mobile — its content is replaced by
 * the sticky bottom CTA bar.
 */
@Component({
  selector: 'mh-profile-side-rail',
  imports: [DatePipe, Card, Button, TagModule],
  templateUrl: './profile-side-rail.html',
  styleUrl: './profile-side-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSideRail implements OnInit {
  private readonly _store = inject(PublicProfileStore);

  readonly profile = input.required<PublicInstructorProfile>();
  readonly isSelf = input<boolean>(false);

  readonly book = output<void>();
  readonly message = output<void>();

  readonly offerings = this._store.offerings;

  ngOnInit(): void {
    // Pricing card needs the cheapest offering to show "From X RON".
    // Pull lazily — the rail mounts after the page resolves so the
    // store always has a profile by now.
    this._store.loadOfferings();
  }

  readonly cheapestProduct = computed<Product | null>(() => {
    const items = this.offerings();
    if (!items || items.length === 0) return null;
    return items.reduce((min, p) =>
      p.amountCents < min.amountCents ? p : min,
    );
  });

  readonly startingPriceLabel = computed(() => {
    const p = this.cheapestProduct();
    if (!p) return null;
    const amount = (p.amountCents / 100).toFixed(0);
    return `${amount} ${p.currency.toUpperCase()}`;
  });

  readonly billingLabel = computed(() => {
    const p = this.cheapestProduct();
    return p ? getProductBillingLabel(p) : '';
  });

  readonly languagesLabel = computed(() => {
    // The backend model surfaces languages as an array on InstructorProfile;
    // the public DTO doesn't include it yet. Fall back to the user's
    // primary language once that's added — for now this stays empty.
    return null;
  });

  readonly socials = computed<SocialLink[]>(() => {
    const links = this.profile().socialLinks ?? {};
    const out: SocialLink[] = [];
    if (links['instagram']) out.push({ key: 'instagram', label: 'Instagram', icon: 'pi pi-instagram', url: links['instagram'] });
    if (links['tiktok']) out.push({ key: 'tiktok', label: 'TikTok', icon: 'pi pi-tiktok', url: links['tiktok'] });
    if (links['youtube']) out.push({ key: 'youtube', label: 'YouTube', icon: 'pi pi-youtube', url: links['youtube'] });
    if (links['facebook']) out.push({ key: 'facebook', label: 'Facebook', icon: 'pi pi-facebook', url: links['facebook'] });
    if (links['twitter']) out.push({ key: 'twitter', label: 'X / Twitter', icon: 'pi pi-twitter', url: links['twitter'] });
    if (links['linkedin']) out.push({ key: 'linkedin', label: 'LinkedIn', icon: 'pi pi-linkedin', url: links['linkedin'] });
    if (links['website']) out.push({ key: 'website', label: 'Website', icon: 'pi pi-globe', url: links['website'] });
    return out;
  });
}
