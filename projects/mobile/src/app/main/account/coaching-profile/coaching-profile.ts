import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  CurrencyRonPipe,
  Product,
  ProductService,
  SOCIAL_PLATFORMS,
  Venue,
  VenueService,
  getProductBillingLabel,
} from 'core';

import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SectionHeader } from '../../../_shared/components/section-header/section-header';
import { ACCOUNT_ICONS, SOCIAL_ICONS } from '../account.config';
import { AccountStore } from '../account.store';
import { CoachingSheet } from '../_sheets/coaching-sheet/coaching-sheet';

/**
 * The coaching profile as clients see it, plus one way to edit the parts that
 * belong to the profile itself.
 *
 * Services and venues are read-only here: pricing and venue management are
 * whole features of their own and have no mobile screens yet, so each card says
 * where they are managed instead of offering a dead affordance.
 */
@Component({
  selector: 'mh-coaching-profile',
  imports: [
    CoachingSheet,
    CurrencyRonPipe,
    HexAvatar,
    IonBackButton,
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SectionHeader,
  ],
  templateUrl: './coaching-profile.html',
  styleUrl: './coaching-profile.scss',
})
export class CoachingProfile implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _venueService = inject(VenueService);

  readonly store = inject(AccountStore);

  readonly editSheetOpen = signal(false);
  readonly products = signal<Product[]>([]);
  readonly venues = signal<Venue[]>([]);
  readonly loadingProducts = signal(false);
  readonly loadingVenues = signal(false);

  readonly profile = this.store.instructorProfile;
  readonly specializations = computed(() => this.profile()?.specializations ?? []);

  /** Only the platforms with a link, paired with their ionicons name. */
  readonly socialLinks = computed(() => {
    const links = this.profile()?.socialLinks ?? {};
    return SOCIAL_PLATFORMS.filter((platform) => !!links[platform.key]).map((platform) => ({
      key: platform.key,
      label: platform.label,
      url: links[platform.key],
      icon: SOCIAL_ICONS[platform.key],
    }));
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
    this._loadProducts();
    this._loadVenues();
  }

  billingLabel(product: Product): string {
    return getProductBillingLabel(product);
  }

  private _loadProducts(): void {
    this.loadingProducts.set(true);
    this._productService
      .list({ isActive: true, limit: 100 })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.products.set(response.items);
          this.loadingProducts.set(false);
        },
        // An empty card is a better failure than an error banner on a page
        // whose main content loaded fine.
        error: () => this.loadingProducts.set(false),
      });
  }

  private _loadVenues(): void {
    this.loadingVenues.set(true);
    this._venueService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (venues) => {
          this.venues.set(venues);
          this.loadingVenues.set(false);
        },
        error: () => this.loadingVenues.set(false),
      });
  }
}
