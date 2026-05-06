import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { BellNotification, NotificationStore } from 'core';

/**
 * NotificationBell — toolbar dropdown for the in-app notification list.
 *
 * Renders the bell icon + unread badge in the toolbar's `#end` slot.
 * The list itself is fetched on first open (lazy) so we don't pay the
 * cost on every page load. Subsequent opens read from the cached
 * signal and trigger a background refresh.
 *
 * Click on a notification:
 *   - calls store.markClicked() (sets clicked_at + read_at, drops badge)
 *   - closes the dropdown
 *   - navigates to data.screen / data.entityId if present
 *
 * Click outside or the X button → standard Popover close.
 */
@Component({
  selector: 'mh-notification-bell',
  imports: [
    ButtonModule,
    PopoverModule,
    OverlayBadgeModule,
    DividerModule,
    SkeletonModule,
    Tooltip,
  ],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell {
  private readonly _store = inject(NotificationStore);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _popover = viewChild.required<Popover>('popover');
  private readonly _bellAnchor = viewChild.required<ElementRef<HTMLElement>>('bellAnchor');
  private readonly _scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly _scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private _observer?: IntersectionObserver;

  readonly unreadCount = this._store.unreadCount;
  readonly hasUnread = this._store.hasUnread;
  readonly notifications = this._store.notifications;
  readonly loading = this._store.loading;
  readonly loadingMore = this._store.loadingMore;
  readonly hasLoadedList = this._store.hasLoadedList;
  readonly hasMore = this._store.hasMore;

  constructor() {
    // Mirror groups-feed: re-bind the IntersectionObserver whenever
    // the sentinel `viewChild` resolves (the popover lazy-renders its
    // content, so the sentinel is undefined until the dropdown opens).
    effect(() => {
      const el = this._scrollSentinel()?.nativeElement;
      const root = this._scrollContainer()?.nativeElement ?? null;
      this._observer?.disconnect();
      if (!el) return;
      // The list is the actual scroller (`max-h-[60vh] overflow-y-auto`),
      // not the document viewport — pass it as `root` so the observer
      // tracks the sentinel against the list's scroll position. Without
      // this, the sentinel's intersection is computed against the page
      // viewport, which is why scroll-to-load only worked on mobile
      // (where the popover happens to fill the screen).
      this._observer = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            this.hasMore() &&
            !this.loadingMore() &&
            !this.loading()
          ) {
            this._store.loadMore();
          }
        },
        { root, threshold: 0.1, rootMargin: '80px 0px' },
      );
      this._observer.observe(el);
    });
    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  /**
   * The badge value PrimeNG expects — undefined hides the badge,
   * a string ("9+") shows the value. We cap at 99 so the badge
   * stays narrow.
   */
  readonly badgeValue = computed<string | undefined>(() => {
    const count = this.unreadCount();
    if (count <= 0) return undefined;
    return count > 99 ? '99+' : String(count);
  });

  toggle(event: Event): void {
    this._popover().toggle(event, this._bellAnchor().nativeElement);
  }

  /**
   * Called by the Popover's `(onShow)` event — fetches the list and,
   * once the new items land, flags them as `viewed` so analytics get
   * the signal even for items that just arrived since the previous
   * open. The first open shows a skeleton (handled in the template
   * via `loading() && !hasLoadedList()`); subsequent opens keep the
   * cached list visible while the refresh streams in.
   */
  onPopoverShow(): void {
    this._store.loadList({ markViewedAfter: true });
  }

  onItemClick(item: BellNotification): void {
    this._store.markClicked(item.id);
    this._popover().hide();

    // Build the deep-link from data.screen / data.entityId. If no
    // screen is set, the notification was informational-only — stay
    // on the current page.
    const data = item.data;
    if (!data?.screen) return;

    // `data.screen` may contain slashes ('coaching/clients') for
    // nested routes. Split into individual segments so the router
    // doesn't URL-encode them as one segment.
    const screenSegments = data.screen.split('/').filter((s) => s.length > 0);
    const segments = data.entityId
      ? ['/', ...screenSegments, data.entityId]
      : ['/', ...screenSegments];
    // Tabbed pages (e.g. /profile?tab=memberships) cannot be expressed
    // via path segments, so we forward optional `queryParams` straight
    // through. Producers either send entityId for a detail route OR
    // queryParams for a tabbed landing — never both.
    this._router.navigate(segments, data.queryParams ? { queryParams: data.queryParams } : undefined);
  }

  markAllRead(): void {
    this._store.markAllRead();
  }

  dismiss(item: BellNotification, event: Event): void {
    // Prevent the row's click handler from firing.
    event.stopPropagation();
    this._store.dismiss(item.id);
  }

  /**
   * Severity → PrimeIcon mapping. We don't have unique icons per
   * NotificationType yet — severity is a good-enough first pass.
   */
  iconForSeverity(severity: string): string {
    switch (severity) {
      case 'success':
        return 'pi pi-check-circle text-green-500';
      case 'warn':
        return 'pi pi-exclamation-triangle text-amber-500';
      case 'error':
        return 'pi pi-times-circle text-red-500';
      default:
        return 'pi pi-info-circle text-blue-500';
    }
  }

  /**
   * Quick "5m ago" formatting. Inline — no shared helper exists in
   * the project yet, and pulling in date-fns just for this would be
   * a 70 KB regret. If we add a TimeAgoPipe later, swap this out.
   */
  timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) return 'just now';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return new Date(iso).toLocaleDateString();
  }
}
