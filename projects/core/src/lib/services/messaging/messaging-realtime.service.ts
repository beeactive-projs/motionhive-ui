import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
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
 * pointed at `GET /messaging/stream?token=<jwt>`.
 *
 * Why not WebSockets: the BE deliberately ships SSE only (see
 * docs/plans/messaging-backend-plan.md §7). EventSource cannot set
 * headers, so the JWT goes in the query string — same token the REST
 * client uses, just delivered differently because of the browser API.
 *
 * Lifecycle:
 *   - `connect()` opens the stream. Idempotent; calling while already
 *     connected is a no-op.
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

  private source: EventSource | null = null;
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
   * Open the SSE stream. The JWT is read at call time from TokenService
   * — callers should call `connect()` AFTER auth has hydrated.
   */
  connect(): void {
    if (this.source) return; // already connected

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

    const url =
      environment.apiUrl +
      API_ENDPOINTS.MESSAGING.STREAM +
      `?token=${encodeURIComponent(token)}`;

    this._status.set('connecting');
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
      // gives up (readyState=CLOSED) it's almost always because the
      // baked-in JWT expired and the server keeps returning 401. We
      // throw the closed source away and reconnect after a small
      // backoff, which re-reads the token from TokenService — by
      // then the auth interceptor will have refreshed it via the
      // next user-initiated REST call.
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
    if (!this.source) return;
    this.source.close();
    this.source = null;
    this._status.set('idle');
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
