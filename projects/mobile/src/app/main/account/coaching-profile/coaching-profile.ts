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
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  CurrencyRonPipe,
  Product,
  ProductService,
  ProfileService,
  SOCIAL_PLATFORMS,
  Venue,
  VenueService,
  getProductBillingLabel,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { SOCIAL_ICONS } from '../account.config';
import { AccountStore } from '../account.store';
import { CoachingSheet } from '../_sheets/coaching-sheet/coaching-sheet';
import { COACHING_PROFILE_ICONS, priceLine, venueLine } from './coaching-profile.config';

/**
 * The coaching profile as clients see it, plus one way to edit the parts that
 * belong to the profile itself.
 *
 * Services and venues are read-only here: pricing and venue management are
 * whole features of their own and have no mobile screens yet, so each card says
 * where they are managed instead of offering a dead affordance.
 *
 * "Clients can mention me" is the one switch on the page itself: it is about
 * what clients do, not what the profile says, so it commits on the flip
 * instead of waiting in the edit sheet.
 */
@Component({
  selector: 'mh-coaching-profile',
  imports: [
    CoachingSheet,
    CurrencyRonPipe,
    EmptyState,
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
    IonToggle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './coaching-profile.html',
  styleUrl: './coaching-profile.scss',
})
export class CoachingProfile implements OnInit {
  private readonly _productService = inject(ProductService);
  private readonly _profileService = inject(ProfileService);
  private readonly _venueService = inject(VenueService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(AccountStore);

  readonly editSheetOpen = signal(false);
  readonly products = signal<Product[]>([]);
  readonly venues = signal<Venue[]>([]);
  readonly loadingProducts = signal(false);
  readonly loadingVenues = signal(false);
  readonly productsFailed = signal(false);
  readonly venuesFailed = signal(false);
  /** A mentions write in flight, so the switch can't be flipped twice. */
  readonly savingMentions = signal(false);

  readonly profile = this.store.instructorProfile;
  readonly specializations = computed(() => this.profile()?.specializations ?? []);
  readonly allowMentions = computed(() => this.profile()?.allowClientMentions ?? false);

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

  readonly venueRows = computed(() =>
    this.venues().map((venue) => ({ id: venue.id, name: venue.name, ...venueLine(venue) })),
  );

  constructor() {
    addIcons(COACHING_PROFILE_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
    this._loadProducts();
    this._loadVenues();
  }

  /** The retry on a failed load: the profile, and the cards that failed with it. */
  retry(): void {
    this.store.refresh();
    if (this.productsFailed()) this._loadProducts();
    if (this.venuesFailed()) this._loadVenues();
  }

  priceLine(price: string, product: Product): string {
    return priceLine(price, getProductBillingLabel(product));
  }

  /**
   * Commits on the flip, like the notification switches: the store moves at
   * once and goes back, with a toast, if the save fails.
   */
  setMentions(allow: boolean): void {
    if (!this.profile() || this.savingMentions()) return;
    const previous = this.allowMentions();
    if (allow === previous) return;

    this.savingMentions.set(true);
    this.store.patchInstructor({ allowClientMentions: allow });

    this._profileService
      .updateInstructorProfile({ allowClientMentions: allow })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.savingMentions.set(false);
          void this._feedbackService.success(
            this._translateService.instant(
              allow
                ? 'account.coachingProfile.mentions.toast.on'
                : 'account.coachingProfile.mentions.toast.off',
            ),
          );
        },
        error: (error: unknown) => {
          this.savingMentions.set(false);
          this.store.patchInstructor({ allowClientMentions: previous });
          void this._feedbackService.error(
            error,
            this._translateService.instant('account.coachingProfile.mentions.toast.failed'),
          );
        },
      });
  }

  private _loadProducts(): void {
    this.loadingProducts.set(true);
    this.productsFailed.set(false);
    this._productService
      .list({ isActive: true, limit: 100 }, { silent: true })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.products.set(response.items);
          this.loadingProducts.set(false);
        },
        // A line in the card is a better failure than an error banner on a
        // page whose main content loaded fine; it must not claim "no
        // services yet", though.
        error: () => {
          this.productsFailed.set(true);
          this.loadingProducts.set(false);
        },
      });
  }

  private _loadVenues(): void {
    this.loadingVenues.set(true);
    this.venuesFailed.set(false);
    this._venueService
      .list({ silent: true })
      .pipe(take(1))
      .subscribe({
        next: (venues) => {
          this.venues.set(venues);
          this.loadingVenues.set(false);
        },
        error: () => {
          this.venuesFailed.set(true);
          this.loadingVenues.set(false);
        },
      });
  }
}
