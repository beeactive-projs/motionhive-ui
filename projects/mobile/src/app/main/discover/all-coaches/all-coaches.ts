import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { InstructorSearchResult } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { CoachRow } from '../_components/coach-row/coach-row';
import {
  DISCOVER_ICONS,
  matchesSpecialization,
  sortCoaches,
  specializationOptions,
} from '../discover.config';
import { DiscoverCoachesStore } from '../discover.store';

/**
 * The full coach directory behind the rail's "All coaches" link:
 * accepting-first (the only honest sort the payload offers), narrowed
 * client-side by specialization chips that come from the coaches
 * themselves. A row lands on the public profile — the coaching request
 * lives there, not here.
 */
@Component({
  selector: 'mh-all-coaches',
  imports: [
    CoachRow,
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './all-coaches.html',
  styleUrl: './all-coaches.scss',
  providers: [DiscoverCoachesStore],
})
export class AllCoaches implements ViewWillEnter {
  readonly store = inject(DiscoverCoachesStore);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly specialization = signal<string | null>(null);

  constructor() {
    addIcons(DISCOVER_ICONS);
  }

  ionViewWillEnter(): void {
    // The page-scoped store starts empty on push; back from a profile
    // re-enters with the list already loaded and skips the fetch.
    this.store.load();
  }

  readonly chips = computed(() => specializationOptions(this.store.coaches()));

  readonly filtered = computed(() =>
    sortCoaches(
      this.store.coaches().filter((coach) =>
        matchesSpecialization(coach, this.specialization()),
      ),
    ),
  );

  readonly showSkeleton = computed(
    () => this.store.loading() && this.store.coaches().length === 0,
  );

  readonly showLoadError = computed(
    () => this.store.error() && this.store.coaches().length === 0,
  );

  readonly isEmpty = computed(
    () =>
      !this.store.loading() &&
      !this.store.error() &&
      this.store.coaches().length === 0,
  );

  readonly isFilteredEmpty = computed(
    () => !this.isEmpty() && !this.showSkeleton() && this.filtered().length === 0,
  );

  toggleSpecialization(chip: string): void {
    this.specialization.update((current) => (current === chip ? null : chip));
  }

  clearFilter(): void {
    this.specialization.set(null);
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load({ force: true, done: () => void event.target.complete() });
  }

  retry(): void {
    this.store.load({ force: true });
  }

  openCoach(coach: InstructorSearchResult): void {
    if (coach.handle) void this._router.navigate(['/tabs/discover/person', coach.handle]);
  }
}
