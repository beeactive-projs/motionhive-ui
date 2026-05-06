import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Context flag for "background" HTTP calls that should not trigger
 * the global loading bar.
 *
 * Use it on:
 *   - Polled requests (notification unread-count every 60s)
 *   - Heartbeats and analytics pings
 *   - Anything the user didn't explicitly initiate
 *
 * Don't use it on:
 *   - User-initiated CRUD where the loading state is the feedback
 *     they're waiting for (creating an invoice, saving a profile,
 *     etc.) — those should keep firing the loader.
 *
 * Example:
 *   this._http.get(url, { context: silentRequest() })
 */
const SILENT_REQUEST = new HttpContextToken<boolean>(() => false);

export function silentRequest(): HttpContext {
  return new HttpContext().set(SILENT_REQUEST, true);
}

export function isSilentRequest(context: HttpContext): boolean {
  return context.get(SILENT_REQUEST);
}
