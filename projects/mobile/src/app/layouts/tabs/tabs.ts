import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  IonBadge,
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { filter, map } from 'rxjs';

import { AppModeStore, AuthStore, MessagingStore, NavMode } from 'core';

import {
  activeTabIdFromUrl,
  resolveMode,
  TAB_ICONS,
  TAB_SETS,
} from '../../_shared/config/tabs.config';
import { NotificationBanner } from '../../_shared/components/notification-banner/notification-banner';
import { TabIds } from '../../_shared/models/tab.model';
import { MoreBadgesService } from '../../_shared/services/more-badges.service';

/**
 * The tab shell. Which tabs exist is data (`TAB_SETS`), not structure — so a
 * coach and a trainee get different bars from the same component, and changing
 * the navigation model is a config edit.
 *
 * Two Ionic constraints shape the implementation:
 *
 * 1. Tab selection is push-based. `ion-tab-bar` emits `ionTabBarChanged` when
 *    `selectedTab` changes, and each button decides its own selected state from
 *    that event — so a button created *after* the last emission would never
 *    light up. Binding `[selectedTab]` to a URL-derived signal re-fires the
 *    watcher whenever the active tab changes, which covers newly-created
 *    buttons after a mode swap.
 * 2. Navigation stacks live in the router outlet, keyed by URL segment, so
 *    adding or removing buttons cannot disturb them — which is why swapping
 *    the tab set is safe. Tab taps deliberately bypass Ionic's stack restore,
 *    though: see `onTabButtonClick`.
 */
@Component({
  selector: 'mh-tabs',
  imports: [
    IonBadge,
    IonIcon,
    IonLabel,
    IonTabBar,
    IonTabButton,
    IonTabs,
    NotificationBanner,
  ],
  templateUrl: './tabs.html',
})
export class Tabs {
  private readonly _authStore = inject(AuthStore);
  private readonly _appModeStore = inject(AppModeStore);
  private readonly _messagingStore = inject(MessagingStore);
  private readonly _moreBadgesService = inject(MoreBadgesService);
  private readonly _navController = inject(NavController);
  private readonly _router = inject(Router);

  /** The stack the last navigation ended in, to notice leaving Clients. */
  private _lastTabId = activeTabIdFromUrl(this._router.url);

  /** Only an instructor has two modes; everyone else is permanently training. */
  readonly canSwitchMode = this._authStore.isInstructor;

  readonly mode = computed<NavMode>(() =>
    resolveMode(this.canSwitchMode(), this._appModeStore.mode()),
  );

  /** The dot on the Menu tab, shared with the menu page's rows. */
  readonly hasBillDue = this._moreBadgesService.hasBillDue;
  readonly hasPendingRequests = this._moreBadgesService.hasPendingRequests;
  readonly moreDotLabel = this._moreBadgesService.moreDotLabel;

  /**
   * The active stack id — the first URL segment after `/tabs`. Derived from
   * the router rather than stored, so a deep link or a programmatic navigation
   * lights the right button without anyone remembering to update state.
   */
  readonly activeTabId = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => activeTabIdFromUrl(this._router.url)),
    ),
    { initialValue: activeTabIdFromUrl(this._router.url) },
  );

  /**
   * Routes that hide the bar, via `data: { hideTabBar: true }`. Opt-in: nested
   * pages keep it by default, and only a screen that owns the bottom edge (the
   * chat composer, under the keyboard) asks for it.
   */
  readonly hideTabBar = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this._readHideTabBar()),
    ),
    { initialValue: this._readHideTabBar() },
  );

  private readonly _tabSet = computed(() => TAB_SETS[this.mode()]);

  /** Live counters can't live in a plain const, so they are spliced in here. */
  readonly tabs = computed(() =>
    this._tabSet().tabs.map((tab) =>
      tab.id === TabIds.Messages ? { ...tab, badge: this._messagingStore.unreadTotal } : tab,
    ),
  );

  constructor() {
    addIcons(TAB_ICONS);

    // Counts only, and only for the side that needs interrupting.
    this._moreBadgesService.refresh();

    // A request is answered inside the Clients stack, so leaving it is the
    // moment the count can have changed — not every navigation.
    this._router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => activeTabIdFromUrl(this._router.url)),
        takeUntilDestroyed(),
      )
      .subscribe((tabId) => {
        const left = this._lastTabId === TabIds.Clients && tabId !== TabIds.Clients;
        this._lastTabId = tabId;
        if (left) this._moreBadgesService.refreshPendingRequests();
      });
  }

  /**
   * A tab tap always lands on the tab's root page. Left alone, `IonTabs`
   * restores the tab's last-visited page — Sessions → search → Messages →
   * Sessions would reopen the search, and a restored chat page would even hide
   * the bar that was just tapped. Stopping the event here keeps it from
   * reaching `IonTabs`' host listener, and the root-direction navigation
   * clears the tab's stale stack. Only bar taps come through this — deep
   * links and in-page navigation are untouched.
   */
  onTabButtonClick(event: Event): void {
    event.stopPropagation();
    const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
    if (!tab) return;
    void this._navController.navigateRoot(`/tabs/${tab}`, {
      animated: true,
      animationDirection: 'back',
    });
  }

  /**
   * The flag lives on the leaf route. Walks `routerState.root` rather than this
   * component's own `ActivatedRoute` — under `IonicRouteStrategy` the injected
   * route is a detached instance whose `firstChild` stays null even with a
   * child on screen. `snapshot` is an optional read because the leaf has none
   * yet mid-construction; the `NavigationEnd` tick re-reads it.
   */
  private _readHideTabBar(): boolean {
    let route = this._router.routerState.root;
    while (route.firstChild) route = route.firstChild;
    return route.snapshot?.data['hideTabBar'] === true;
  }
}
