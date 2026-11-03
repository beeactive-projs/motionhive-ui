import { Service } from '@angular/core';

/**
 * "The reader asked a coach, or took the request back, somewhere else."
 *
 * A coach's profile opens on top of the Coaches screen, whose stores are
 * page-scoped and out of its reach, and whose freshness window is measured
 * from the last load: sending a request and coming straight back lands inside
 * it, and the row would not say "Request sent". Reloading instead would drop
 * the reader back to the first page they had scrolled past, so the change is
 * patched onto the row.
 *
 * Read once, by the page's `ionViewWillEnter`, which every way back fires
 * (the reason `ClientsRefreshService` gives for not using the URL holds here
 * too).
 */
@Service()
export class CoachesRefreshService {
  /** The coach's user id, and whether a request to them is now waiting. */
  private readonly _requests = new Map<string, boolean>();

  requestChanged(coachUserId: string, sent: boolean): void {
    this._requests.set(coachUserId, sent);
  }

  /** For the next entry into the Coaches page, once. */
  consume(): ReadonlyMap<string, boolean> {
    const requests = new Map(this._requests);
    this._requests.clear();
    return requests;
  }
}
