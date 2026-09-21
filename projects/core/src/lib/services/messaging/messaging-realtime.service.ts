import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import { MessagingStreamEnvelope, MessagingStreamEvent } from '../../models/messaging';
import { TokenService } from '../auth/token.service';

/**
 * Connection lifecycle states the UI can react to.
 *
 *   idle       — never connected (or explicitly disconnected)
 *   connecting — `EventSource` constructed, waiting for `open`
 *   open       — receiving events
 *   closed     — connection ended; the browser will auto-retry
 */
export type MessagingStreamStatus = 'idle' | 'connecting' | 'open' | 'closed';

/**
 * MessagingRealtimeService — thin wrapper around the browser `EventSource`
 * pointed at `GET /messaging/stream?ticket=<jwt>`.
 *
 * Why not WebSockets: the BE deliberately ships SSE only (see
 * docs/plans/messaging-backend-plan.md §7). EventSource cannot set
 * headers, so something has to go in the query string.
 *
 * That something is NOT the access token. A URL is copied into access
 * logs, proxy logs and browser history, and the access token is a
 * two-hour key to the whole API — one logged line used to be enough to
 * take an account over. So each connection first POSTs for a **stream
 * ticket**: sixty seconds, and refused by every endpoint but this one.
 * The POST carries the access token the proper way, in a header.
 *
 * Lifecycle:
 *   - `connect()` fetches a ticket and opens the stream. Idempotent;
 *     calling while connected — or while a ticket is in flight — is a
 *     no-op, so a burst of calls cannot open two streams.
 *   - `disconnect()` closes it cleanly.
 *   - The browser auto-reconnects on transient drops and sends
 *     `Last-Event-ID` so the BE's in-process ring buffer can replay
 *     missed events (10-minute window, 100-event cap — best-effort).
 *
 * Events come out of `events$`. Heartbeats are forwarded too (the store
 * uses them as a stream-health beacon). The MessagingStore is the only
 * intended subscriber.
 */
/** Backoff after the browser gives up on a stale-JWT SSE connection. */
const RECONNECT_BACKOFF_MS = 3_000;

@Injectable({ providedIn: 'root' })
export class MessagingRealtimeService implements OnDestroy {
  private readonly _tokens = inject(TokenService);
  private readonly _http = inject(HttpClient);

  private source: EventSource | null = null;
  /**
   * A ticket request is in flight. `connect()` is called from several
   * places (login, reconnect backoff, `online`), and without this a
   * second call during that round trip would open a second stream.
   */
  private ticketPending = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Listener bound to `window.online` so we can wake the stream the
   * moment connectivity returns. Stored so we can detach on destroy
   * / explicit disconnect — without that the listener would leak.
   */
  private onlineListener: (() => void) | null = null;

  /** Push channel for parsed events. Subscribers MUST handle their own teardown. */
  readonly events$ = new Subject<MessagingStreamEnvelope>();

  /** Last event id we successfully parsed (also tracked natively by EventSource). */
  readonly lastEventId = signal<string | null>(null);

  private readonly _status = signal<MessagingStreamStatus>('idle');
  readonly status = this._status.asReadonly();

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Open the SSE stream. The access token is read at call time from
   * TokenService — callers should call `connect()` AFTER auth has
   * hydrated. Returns immediately; the stream opens once the ticket
   * lands.
   */
  connect(): void {
    if (this.source || this.ticketPending) return; // already up, or on the way

    const token = this._tokens.getAccessToken();
    if (!token) {
      // No token → don't even try. Caller (the store) re-invokes on
      // login.
      return;
    }

    // Network-aware: don't open the EventSource while the browser
    // says we're offline. EventSource fires `error` repeatedly when
    // there's no network and our backoff would keep churning a new
    // connection every 3 seconds. We instead attach a one-shot
    // `online` listener and wait for connectivity to return.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._status.set('closed');
      this.attachOnlineListener();
      return;
    }

    this._status.set('connecting');
    this.ticketPending = true;

    this._http
      .post<{ ticket: string }>(
        environment.apiUrl + API_ENDPOINTS.MESSAGING.STREAM_TICKET,
        {},
        // Nobody asked for this request — it is the stream reconnecting in
        // the background. Left loud, a flaky connection would put a modal
        // over whatever the user was doing, once every backoff.
        { context: silentRequest() },
      )
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.ticketPending = false;
          // `disconnect()` may have run while the ticket was in flight.
          if (this._status() === 'idle') return;
          this.open(response.ticket);
        },
        error: () => {
          this.ticketPending = false;
          // Usually an expired access token. The auth interceptor
          // refreshes it on the next REST call, so back off and retry
          // rather than giving up on the stream for the session.
          this._status.set('closed');
          this.scheduleReconnect();
        },
      });
  }

  /** Ticket in hand — open the stream itself. */
  private open(ticket: string): void {
    const url =
      environment.apiUrl +
      API_ENDPOINTS.MESSAGING.STREAM +
      `?ticket=${encodeURIComponent(ticket)}`;

    const es = new EventSource(url);

    es.addEventListener('open', () => {
      this._status.set('open');
    });

    es.addEventListener('message', (e: MessageEvent) => {
      let parsed: MessagingStreamEvent | null = null;
      try {
        parsed = JSON.parse(e.data as string) as MessagingStreamEvent;
      } catch {
        // Malformed payload — skip. Network corruption is rare in
        // practice over TLS, but we don't want a bad line to crash
        // the whole subscription.
        return;
      }
      const id = e.lastEventId || '';
      if (id) this.lastEventId.set(id);
      this.events$.next({ id, event: parsed });
    });

    es.addEventListener('error', () => {
      // EventSource auto-retries transient errors. When the browser
      // gives up (readyState=CLOSED) the connection is done for. We
      // throw the closed source away and reconnect after a small
      // backoff, which mints a fresh ticket — a ticket only has to
      // outlive the handshake, so an old one being long expired by
      // now is expected, not a failure.
      if (es.readyState === EventSource.CLOSED) {
        this._status.set('closed');
        this.scheduleReconnect();
      }
    });

    this.source = es;
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.detachOnlineListener();
    // Set first: an in-flight ticket request checks this on arrival and
    // drops the ticket rather than opening a stream nobody asked for.
    this._status.set('idle');
    if (!this.source) return;
    this.source.close();
    this.source = null;
  }

  /**
   * Cycle the connection. Public escape hatch — currently unused in
   * the store (the error handler auto-reconnects), but kept for
   * call sites that explicitly know the token rotated.
   */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    // While the browser says we're offline, don't bother arming the
    // timer — `connect()` would short-circuit anyway. Instead attach
    // an `online` listener that triggers the reconnect the moment
    // network comes back.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.attachOnlineListener();
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // disconnect() clears `source`. connect() re-reads the token.
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      this.connect();
    }, RECONNECT_BACKOFF_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private attachOnlineListener(): void {
    if (this.onlineListener || typeof window === 'undefined') return;
    const listener = () => {
      this.detachOnlineListener();
      // Network back. Drop any defunct source, then reconnect with a
      // fresh token + new EventSource.
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      this.connect();
    };
    this.onlineListener = listener;
    window.addEventListener('online', listener);
  }

  private detachOnlineListener(): void {
    if (this.onlineListener && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineListener);
    }
    this.onlineListener = null;
  }
}
