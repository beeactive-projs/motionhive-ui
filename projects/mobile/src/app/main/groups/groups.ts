import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { AuthStore, DiscoverGroup, formatRelativeShort } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SearchbarAutofocusDirective } from '../../_shared/directives/searchbar-autofocus.directive';
import { GROUP_ICONS } from './groups.icons';
import { GroupsSegments, MIN_SEARCH_LENGTH } from './groups.filters';
import { GroupsStore } from './groups.store';

/**
 * The Groups hub: what's happening, what you could join, what you're in.
 *
 * Feed is the landing lens — every post from every group you belong to, in
 * one stream, because the reason to open this tab is usually to read rather
 * than to administer. Discover is the public directory, searched server-side.
 * Your groups is the list you act on: open one, or create one.
 *
 * Unlike the Clients tab, the three lenses are three different requests, so
 * only the one on screen loads; see `GroupsStore`.
 */
@Component({
  selector: 'mh-groups',
  imports: [
    EmptyState,
    HexAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    SearchbarAutofocusDirective,
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
  providers: [GroupsStore],
})
export class Groups implements ViewWillEnter {
  readonly store = inject(GroupsStore);
  private readonly _router = inject(Router);
  private readonly _auth = inject(AuthStore);

  readonly Segments = GroupsSegments;
  readonly minSearchLength = MIN_SEARCH_LENGTH;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  /**
   * Search owns the whole toolbar while it is open — a title, two actions
   * and a segment do not fit above the fold on a phone. Same treatment as
   * the clients directory and the inbox.
   *
   * It belongs to Discover alone: the feed is a post stream nobody searches
   * by group name, and Your groups is short enough to read. Opening it from
   * another lens switches to Discover rather than taking a term that would
   * change nothing.
   */
  readonly searchOpen = signal(false);

  readonly isFeed = computed(() => this.store.segment() === GroupsSegments.Feed);
  readonly isDiscover = computed(() => this.store.segment() === GroupsSegments.Discover);
  readonly isMine = computed(() => this.store.segment() === GroupsSegments.Mine);

  /**
   * Only a coach is offered "create a group" — the API's create route carries
   * `@Roles('INSTRUCTOR')`, so the FAB would 403 for everyone else.
   */
  readonly canCreate = computed(() => this._auth.isInstructor());

  /** The floor only bites on Discover, the one lens that searches the API. */
  readonly showSearchHint = computed(() => this.store.queryTooShort());

  /**
   * What a screen reader is told once a search settles. Nothing on screen
   * says it otherwise: the list simply becomes shorter. Empty while a term
   * is still on its way, because announcing a count over a list about to be
   * replaced is worse than saying nothing.
   */
  readonly resultAnnouncement = computed(() => {
    if (!this.isDiscover() || !this.store.query().trim()) return '';
    if (!this.store.searchSettled() || this.store.showSkeleton()) return '';

    const count = this.store.discover().length;
    if (count === 0) return 'No groups match that.';
    return `${count} ${count === 1 ? 'group' : 'groups'}.`;
  });

  /**
   * Whether the viewer already has a request in on this group. The status is
   * a bare union on the model with no const object behind it, so the literal
   * is pinned here rather than written into the template.
   */
  hasPendingRequest(group: DiscoverGroup): boolean {
    return group.myJoinRequestStatus === 'PENDING';
  }

  /**
   * "now", "4h", "yesterday" — the same short form the inbox uses. A feed is
   * read by how recent something is, not by the clock time it was posted at.
   */
  postedAt(iso: string): string {
    return formatRelativeShort(iso);
  }

  constructor() {
    addIcons(GROUP_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page alive in the tab stack. A group joined,
  // left or posted in elsewhere changes these lists, so entering refetches —
  // quietly, since rows already on screen stay put. `reenter` holds that back
  // for a few seconds so stepping into a group and straight back out does not
  // re-fire the list for data seconds old.
  ionViewWillEnter(): void {
    this.store.reenter();
  }

  setSegment(value: string | number | undefined): void {
    if (
      value !== GroupsSegments.Feed &&
      value !== GroupsSegments.Discover &&
      value !== GroupsSegments.Mine
    ) {
      return;
    }
    // Leaving Discover leaves its term behind: coming back to a list silently
    // narrowed by something typed minutes ago reads as a broken directory.
    if (value !== GroupsSegments.Discover && this.store.query()) {
      this.searchOpen.set(false);
      this.store.clearQuery();
    }
    this.store.setSegment(value);
  }

  /** Searching means searching the directory, so go there first. */
  openSearch(): void {
    if (!this.isDiscover()) this.store.setSegment(GroupsSegments.Discover);
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.store.clearQuery();
  }

  onQuery(value: string): void {
    this.store.setQuery(value);
  }

  /**
   * A group you are in opens its own page. A Discover row does not: that
   * page is members-only and answers a non-member with 403, so those go to
   * the preview, which is the only screen that can offer a way in.
   */
  openGroup(groupId: string): void {
    void this._router.navigate(['/tabs/groups', groupId]);
  }

  openDiscovered(groupId: string): void {
    void this._router.navigate(['/tabs/groups/preview', groupId]);
  }

  openPost(postId: string): void {
    void this._router.navigate(['/tabs/groups/post', postId]);
  }

  createGroup(): void {
    void this._router.navigateByUrl('/tabs/groups/create');
  }

  discoverGroups(): void {
    this.store.setSegment(GroupsSegments.Discover);
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.refresh(() => void event.target.complete());
  }

  /**
   * A refresh that fails leaves the rows that were already there, which is
   * right — but silently, they read as fresh. The stale bar says so and
   * offers the retry; no toast on top of it, since the store's loads are
   * silent for exactly that reason.
   */
  retry(): void {
    this.store.refresh();
  }

  onLoadMore(event: InfiniteScrollCustomEvent): void {
    const done = () => void event.target.complete();
    if (this.isFeed()) {
      this.store.loadMoreFeed(done);
      return;
    }
    if (this.isDiscover()) {
      this.store.loadMoreDiscover(done);
      return;
    }
    // Your groups is one unpaged response; there is never a second page.
    done();
  }

  /** Whether the lens on screen can page at all. */
  readonly hasMore = computed(() => {
    if (this.isFeed()) return this.store.feedHasMore();
    if (this.isDiscover()) return this.store.discoverHasMore();
    return false;
  });
}
