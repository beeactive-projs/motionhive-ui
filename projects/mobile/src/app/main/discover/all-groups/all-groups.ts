import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
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

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { RowSkeleton } from '../../../_shared/components/row-skeleton/row-skeleton';
import { DiscoverGroupRow } from '../_components/group-row/group-row';
import { DISCOVER_ICONS, discoverLinks } from '../discover.config';
import { DiscoverGroupsStore } from '../discover.store';

/** Rows per request on the full list. */
const PAGE_SIZE = 20;

/**
 * The full list behind "Groups to join": every public group the reader is
 * not in yet, paged as they scroll. It lives in the stack that opened it
 * (Discover, `/tabs/discover/groups`; Home's "Join a group",
 * `/tabs/home/groups-to-join`) rather than sending the reader to the Groups
 * page under the Menu, whose back button leads to the Menu, a screen they
 * never came from. A row opens the group's preview in this stack, with the
 * way in.
 */
@Component({
  selector: 'mh-all-groups',
  imports: [
    DiscoverGroupRow,
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    RowSkeleton,
    TranslatePipe,
  ],
  templateUrl: './all-groups.html',
  styleUrl: './all-groups.scss',
  host: { class: 'mh-whole-words' },
  providers: [DiscoverGroupsStore],
})
export class AllGroups implements ViewWillEnter {
  readonly store = inject(DiscoverGroupsStore);
  private readonly _router = inject(Router);

  private readonly _links = discoverLinks(this._router.url);
  /** Back on a cold load: the stack's own root. */
  readonly backHref = this._links.root;

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  constructor() {
    addIcons(DISCOVER_ICONS);
    this.store.usePageSize(PAGE_SIZE);
  }

  ionViewWillEnter(): void {
    // Back from a preview re-enters with the list loaded and skips the fetch.
    this.store.load();
  }

  readonly showSkeleton = computed(
    () => this.store.loading() && this.store.groups().length === 0,
  );

  readonly showLoadError = computed(
    () => this.store.error() && this.store.groups().length === 0,
  );

  readonly isEmpty = computed(
    () => this.store.loaded() && !this.store.loading() && this.store.groups().length === 0,
  );

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load({ force: true, done: () => void event.target.complete() });
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    this.store.loadMore(() => void event.target.complete());
  }

  retry(): void {
    this.store.load({ force: true });
  }

  openGroup(groupId: string): void {
    void this._router.navigate(this._links.groupPreview(groupId));
  }
}
