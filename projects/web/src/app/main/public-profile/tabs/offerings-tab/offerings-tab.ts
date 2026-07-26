import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
} from '@angular/core';
import { PublicProfileStore, type Product } from 'core';
import { AvatarModule } from 'primeng/avatar';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { OfferingCard } from './offering-card/offering-card';

@Component({
  selector: 'mh-public-profile-offerings-tab',
  imports: [AvatarModule, Card, SkeletonModule, OfferingCard],
  templateUrl: './offerings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingsTab implements OnInit {
  private readonly _store = inject(PublicProfileStore);

  readonly offerings = this._store.offerings;
  readonly loading = this._store.loadingOfferings;

  /** Bubbles a card CTA up to the profile shell (auth-aware handling lives there). */
  readonly offeringSelect = output<Product>();

  ngOnInit(): void {
    this._store.loadOfferings();
  }
}
