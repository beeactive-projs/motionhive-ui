import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { AuthStore, InstructorSearchResult } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { CoachRow } from '../_components/coach-row/coach-row';
import {
  DISCOVER_ICONS,
  discoverLinks,
  matchesSpecialization,
  sortCoaches,
  specializationOptions,
  withoutReader,
} from '../discover.config';
import { DiscoverCoachesStore } from '../discover.store';

/**
 * The full coach directory behind Discover's "All": a flat list,
 * accepting-first (the only honest sort the payload offers), narrowed
 * client-side by specialization chips that come from the coaches
 * themselves, the reader never among them. A row lands on the public
 * profile in this stack; the coaching request lives there, not here.
 *
 * Mounted in Discover (`/tabs/discover/coaches`) and in Home
 * (`/tabs/home/coaches`, "Find a coach"): back and the rows follow the stack
 * the URL is in.
 */
@Component({
  selector: 'mh-all-coaches',
  imports: [
    CoachRow,
    EmptyState,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    RowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './all-coaches.html',
  styleUrl: './all-coaches.scss',
  host: { class: 'mh-whole-words' },
  providers: [DiscoverCoachesStore],
})
export class AllCoaches implements ViewWillEnter {
  readonly store = inject(DiscoverCoachesStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);

  private readonly _links = discoverLinks(this._router.url);
  /** Back on a cold load: the stack's own root. */
  readonly backHref = this._links.root;

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly specialization = signal<string | null>(null);

  constructor() {
    addIcons(DISCOVER_ICONS);
  }

  ionViewWillEnter(): void {
    // The page-scoped store starts empty on push; back from a profile
    // re-enters with the list already loaded and skips the fetch.
    this.store.load();
  }

  /** Everyone but the reader: a coach is not listed to themselves. */
  private readonly _coaches = computed(() =>
    withoutReader(this.store.coaches(), this._authStore.user()?.id),
  );

  readonly chips = computed(() => specializationOptions(this._coaches()));

  readonly filtered = computed(() =>
    sortCoaches(
      this._coaches().filter((coach) => matchesSpecialization(coach, this.specialization())),
    ),
  );

  readonly showSkeleton = computed(
    () => this.store.loading() && this.store.coaches().length === 0,
  );

  readonly showLoadError = computed(
    () => this.store.error() && this.store.coaches().length === 0,
  );

  readonly isEmpty = computed(
    () => !this.store.loading() && !this.store.error() && this._coaches().length === 0,
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
    if (coach.handle) void this._router.navigate(this._links.person(coach.handle));
  }
}
