import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { PublicProfileStore } from 'core';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { OfferingCard } from './offering-card/offering-card';

@Component({
  selector: 'mh-public-profile-offerings-tab',
  imports: [Card, SkeletonModule, OfferingCard],
  templateUrl: './offerings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferingsTab implements OnInit {
  private readonly _store = inject(PublicProfileStore);

  readonly offerings = this._store.offerings;
  readonly loading = this._store.loadingOfferings;

  ngOnInit(): void {
    this._store.loadOfferings();
  }
}
