import { Service } from '@angular/core';

import { ClientFilterId } from '../clients.filters';

/** What the next entry into the Clients page has to do before anything else. */
export interface ClientsReturn {
  /** The chip to land on, or null to keep whichever one the coach left on. */
  filter: ClientFilterId | null;
}

/**
 * "The coach's client list changed from somewhere else — reload it."
 *
 * `ClientsStore` is page-scoped, so a screen pushed on top of the Clients tab
 * cannot reach it to force a refetch, and its freshness window is measured
 * from the last load rather than from the last time anyone looked: the normal
 * path of opening the tab, inviting someone and coming straight back lands
 * well inside it, and the new pending row would not appear.
 *
 * Not a URL parameter. Every way back inside the app (the chevron, the swipe,
 * Android's back button) is Ionic popping to the page's *saved* URL, query
 * string included, so an instruction left in the URL is replayed on every
 * later return from a client page: a reload nobody asked for, and the chip
 * snapping back under a coach who has since picked another. This is read
 * once, by the page's `ionViewWillEnter`, which every one of those exits
 * fires.
 */
@Service()
export class ClientsRefreshService {
  private _pending: ClientsReturn | null = null;

  /** Something outside the Clients page changed its list. */
  invalidate(): void {
    this._pending ??= { filter: null };
  }

  /** The list changed, and the coach should land on the chip that shows it. */
  invalidateOn(filter: ClientFilterId): void {
    this._pending = { filter };
  }

  /** For the next entry into the Clients page, once: what to do, or null. */
  consume(): ClientsReturn | null {
    const pending = this._pending;
    this._pending = null;
    return pending;
  }
}
