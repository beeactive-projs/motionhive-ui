// projects/core/src/lib/stores/messaging.store.ts
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize, tap, throwError } from 'rxjs';
import {
  ConversationListItem,
  MessageView,
  MessagingStreamEnvelope,
  MessagingStreamEvent,
  ReportMessagePayload,
  SendMessageResult,
  ThreatFlags,
  UserBlockReason,
} from '../models/messaging';

/**
 * Per-conversation message pagination + loading state. Stored in a
 * map keyed by conversation id so the inbox can keep multiple threads
 * warm as the user clicks between them.
 */
interface ConversationMessages {
  items: MessageView[];
  /** Cursor for the next "older" page. Null when we've reached the top. */
  nextBefore: string | null;
  /** True while a fetch (first page or older) is in flight. */
  loading: boolean;
  /** True once we've loaded at least one page successfully. */
  hasLoaded: boolean;
}

const EMPTY_MESSAGES: ConversationMessages = {
  items: [],
  nextBefore: null,
  loading: false,
  hasLoaded: false,
};
import { MessagingService } from '../services/messaging/messaging.service';
import { MessagingRealtimeService } from '../services/messaging/messaging-realtime.service';
import { AuthStore } from './auth.store';

/** Filter chip selection driven by the inbox UI. */
export type InboxFilter = 'all' | 'unread' | 'groups' | 'coaches';

/**
 * Minimum gap between two automatic conversation reloads triggered by
 * the auth effect. The effect itself only fires on real auth state
 * transitions, but during boot the auth flow can update `user` two or
 * three times (localStorage hydrate → /users/me response → optional
 * profile refresh), and Angular signal equality is reference-based,
 * so we get N effect ticks even though `isAuthenticated()` returns the
 * same `true`. This dedup window absorbs that without sacrificing real
 * "load again on re-login" behaviour.
 */
const AUTO_LOAD_DEDUP_WINDOW_MS = 5_000;

/**
 * How many messages to fetch per page — both the first load and each
 * scroll-up "load earlier". Kept small so the first paint is fast on mobile;
 * history streams in a page at a time as the user scrolls up.
 */
const MESSAGE_PAGE_SIZE = 25;

/**
 * Default fallback when a 429 response doesn't include `retryAfter`
 * (it usually does, see MessagingRateLimitService on the BE).
 */
const DEFAULT_RETRY_AFTER_MS = 30_000;

/**
 * MessagingStore — signal-based state for the messaging feature.
 *
 * Owns:
 *   - Conversation list, filter/search state, unread badge total.
 *   - Per-conversation message cache + pagination.
 *   - Active conversation id mirror (URL is still source of truth —
 *     `ConversationPane` writes it from the route).
 *   - Composer drafts, send state, rate-limit window, send error.
 *   - Threat-flags captured from send responses (sender-only).
 *   - SSE event fan-in (`message.created`, `.deleted`, `read`, `muted`).
 *   - Block / mute / report actions.
 *
 * Boot discipline:
 *   - The auth effect only acts on real transitions (false→true,
 *     true→false), not on every signal tick caused by an upstream
 *     `setUser(...)`. Without this, the auth-boot "localStorage
 *     hydrate + /users/me refresh" sequence would fan out into
 *     multiple loadConversations calls and trip the BE rate limiter.
 *   - `loadConversations()` short-circuits if a request is in flight,
 *     we've loaded within the dedup window, OR the BE 429'd us
 *     recently.
 */
@Injectable({ providedIn: 'root' })
export class MessagingStore {
  private readonly _api = inject(MessagingService);
  private readonly _realtime = inject(MessagingRealtimeService);
  private readonly _auth = inject(AuthStore);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  // ─── Internal state ───────────────────────────────────────────
  private readonly _conversations = signal<ConversationListItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _hasLoaded = signal(false);
  private readonly _activeId = signal<string | null>(null);
  private readonly _filter = signal<InboxFilter>('all');
  private readonly _searchQuery = signal<string>('');

  /**
   * Per-conversation message cache + pagination + loading state.
   * Keyed by conversation id. Reset on logout via `reset()`.
   */
  private readonly _messagesByConv = signal<
    Record<string, ConversationMessages>
  >({});

  /**
   * Per-conversation composer draft text. Survives thread switches
   * within a session; cleared on logout. v1 keeps drafts in-memory
   * only — persistent drafts (localStorage) is a polish item.
   *
   * Key 'new' is reserved for the New Message picker's draft so the
   * user can type before choosing a recipient.
   */
  private readonly _composerDraft = signal<Record<string, string>>({});

  /**
   * In-flight send tracking. Maps conversationId → temp message id
   * (the optimistic insert). One in flight at a time per conversation
   * is enough for v1 (composer disables itself while sending).
   */
  private readonly _sending = signal<Record<string, boolean>>({});

  /**
   * "New message" picker on/off. URL stays /messages while compose
   * mode is true — see plan §14 decision #3 for why this isn't a
   * separate route.
   */
  private readonly _composeMode = signal(false);

  /**
   * `Date.now()` at which the BE-imposed send rate limit clears, if
   * any. Composer reads this signal to disable + show a "Slow down"
   * tooltip with a countdown.
   */
  private readonly _sendRateLimitedUntil = signal<number | null>(null);

  /**
   * Last user-facing send error message. Composer shows it as inline
   * feedback (separate from the global ErrorDialog, because 4xx is
   * specifically user-fault and we want a calmer presentation).
   */
  private readonly _sendError = signal<string | null>(null);

  /**
   * Per-conversation latest threat flags from the SEND response. Only
   * the sender sees this (BE never emits flags via SSE). Cleared when
   * the user navigates away from the thread (active conversation
   * change) so a stale banner doesn't follow them around.
   */
  private readonly _threatFlagsByConv = signal<Record<string, ThreatFlags>>({});

  /**
   * `Date.now()` of the most recent successful or failed load attempt.
   * Used by the dedup window so a noisy auth flow doesn't queue
   * multiple loads in close succession.
   */
  private lastLoadAttemptAt = 0;

  /**
   * `Date.now()` at which the rate limiter is expected to clear.
   * Set after a 429; cleared once we successfully load again.
   */
  private rateLimitedUntilAt = 0;

  /** Tracks the last `isAuthenticated()` value the effect acted on. */
  private lastAuthState: boolean | null = null;

  /**
   * Tracks the user id we last loaded for. Bumps when a different
   * person signs in (same browser, different account) so we can drop
   * cached state that belongs to the previous identity even when the
   * auth state went directly true → true without a false in between
   * (e.g. token refresh that resolves to a different `sub`, or a
   * hard refresh after a manual auth swap).
   */
  private lastAuthedUserId: string | null = null;

  /** True once we've connected the realtime stream for this session. */
  private realtimeConnected = false;

  /**
   * Pending debounced markRead timers, keyed by conversationId. Used
   * by `scheduleLiveMarkRead` so a burst of incoming SSE messages on
   * the active thread coalesces into a single PATCH after a short
   * quiet window.
   */
  private liveMarkReadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly LIVE_MARK_READ_DEBOUNCE_MS = 1500;

  /**
   * LRU tracking for the per-conversation message cache. Most-recently-
   * touched conversation id ends up at the back of the queue; when we
   * exceed `MAX_CACHED_CONVERSATIONS`, the front (least recent) is
   * evicted. Without this bound, switching through dozens of threads
   * in a long session keeps every history page in memory until logout.
   *
   * The active conversation is NEVER evicted — even if it slides off
   * the end of the recency list a defensive guard skips it.
   */
  private cachedConversationOrder: string[] = [];
  private static readonly MAX_CACHED_CONVERSATIONS = 10;

  // ─── Public readonly surface ──────────────────────────────────
  readonly conversations = this._conversations.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasLoaded = this._hasLoaded.asReadonly();
  readonly activeId = this._activeId.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  readonly unreadTotal = computed(() =>
    this._conversations().reduce((sum, c) => sum + c.unreadCount, 0),
  );
  readonly hasUnread = computed(() => this.unreadTotal() > 0);

  /** Per-chip counts used by the inbox filter row. */
  readonly filterCounts = computed(() => {
    const all = this._conversations();
    return {
      all: all.length,
      unread: all.filter((c) => c.unreadCount > 0).length,
    };
  });

  /**
   * Filtered + searched conversation list rendered by the inbox.
   *
   * Sort: pinned-at-top is deferred (no BE field). Server order is
   * `last_message_at DESC NULLS LAST` — exactly what the design wants.
   */
  readonly visibleConversations = computed(() => {
    const filter = this._filter();
    const query = this._searchQuery().trim().toLowerCase();

    return this._conversations().filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0) return false;
      if (filter === 'groups' && c.type !== 'GROUP') return false;
      // 'coaches' is disabled in the UI for v1; defensive no-op here.
      if (filter === 'coaches') return false;

      if (query) {
        const haystack =
          (c.type === 'GROUP' ? c.name ?? '' : participantName(c)) +
          ' ' +
          (c.lastMessagePreview ?? '');
        if (!haystack.toLowerCase().includes(query)) return false;
      }

      return true;
    });
  });

  readonly activeConversation = computed(() => {
    const id = this._activeId();
    if (!id) return null;
    return this._conversations().find((c) => c.id === id) ?? null;
  });

  /**
   * Read a conversation's message state. Returns the empty shape when
   * the conversation hasn't been touched yet — callers don't need to
   * null-check.
   */
  messagesFor(conversationId: string | null): ConversationMessages {
    if (!conversationId) return EMPTY_MESSAGES;
    return this._messagesByConv()[conversationId] ?? EMPTY_MESSAGES;
  }

  // ── F4 public read surfaces ─────────────────────────────────
  readonly composeMode = this._composeMode.asReadonly();
  readonly sendRateLimitedUntil = this._sendRateLimitedUntil.asReadonly();
  readonly sendError = this._sendError.asReadonly();

  /** Realtime stream status. Inbox renders a "Reconnecting…" chip on 'closed'. */
  readonly streamStatus = this._realtime.status;

  /**
   * Threat flags for the ACTIVE conversation, or null. Used by the
   * threat banner inside the thread. Only the sender sees this — flags
   * are computed BE-side from the message they just sent.
   */
  readonly activeThreatFlags = computed<ThreatFlags | null>(() => {
    const id = this._activeId();
    if (!id) return null;
    return this._threatFlagsByConv()[id] ?? null;
  });

  /** Composer draft for a specific conversation, or '' if none. */
  draftFor(conversationId: string | null): string {
    const key = conversationId ?? 'new';
    return this._composerDraft()[key] ?? '';
  }

  /** True while a send for the given conversation is in flight. */
  isSending(conversationId: string | null): boolean {
    const key = conversationId ?? 'new';
    return this._sending()[key] === true;
  }

  constructor() {
    // Transition-only effect. We read `isAuthenticated()` so the
    // effect re-runs when it changes, but we only act when the
    // observed value differs from the previous one. This collapses
    // the auth-boot "localStorage hydrate + profile fetch" sequence
    // (two `setUser` calls with the same boolean truth value but
    // different object references) into a single onLogin call.
    //
    // We also track the user id so a "true → true" transition where
    // the underlying identity changed (e.g. a tab swapped accounts)
    // triggers a full state reset. Without this guard, residual
    // messages / drafts / threat flags belonging to user A could be
    // visible to user B after the swap.
    effect(() => {
      const isAuthed = this._auth.isAuthenticated();
      const userId = this._auth.user()?.id ?? null;
      const sameAuthState = isAuthed === this.lastAuthState;
      const sameUser = userId === this.lastAuthedUserId;
      if (sameAuthState && sameUser) return;

      this.lastAuthState = isAuthed;
      this.lastAuthedUserId = userId;

      if (!isAuthed) {
        this.onLogout();
        return;
      }
      // If the user id changed while we were already authed (no
      // false transition in between), purge state from the previous
      // identity before re-loading.
      if (!sameUser) {
        this.reset();
      }
      this.onLogin();
    });

    // SSE → store fan-in. We subscribe once for the lifetime of the
    // store (root-scoped). The realtime service handles connect/
    // disconnect on auth; this subscription just shovels parsed
    // envelopes into the per-event handler.
    this._realtime.events$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((envelope) => this.handleStreamEnvelope(envelope));
  }

  // ─── Inbox UI actions ─────────────────────────────────────────

  setFilter(filter: InboxFilter): void {
    this._filter.set(filter);
  }

  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  /**
   * Save the composer draft for a conversation (or 'new' for the
   * picker draft). Caller debounces — store accepts every keystroke.
   */
  saveDraft(conversationId: string | null, text: string): void {
    const key = conversationId ?? 'new';
    this._composerDraft.update((all) => ({ ...all, [key]: text }));
  }

  /** Open the New Message picker. URL stays /messages. */
  enterComposeMode(): void {
    this._composeMode.set(true);
  }

  exitComposeMode(): void {
    this._composeMode.set(false);
    // Discard the 'new' draft so the picker starts fresh next time
    // and clear any inline error left from a failed picker send.
    this._composerDraft.update((all) => omitKey(all, 'new'));
    this._sendError.set(null);
  }

  /** Clear an inline send error (composer dismiss button). */
  clearSendError(): void {
    this._sendError.set(null);
  }

  /**
   * Set the active conversation id. URL is still the source of truth
   * for the active thread (F3 wires the route param into this), but
   * surfaces such as the conversation list also call this directly
   * so the active-row style updates synchronously on click.
   */
  setActiveId(id: string | null): void {
    this._activeId.set(id);
  }

  /**
   * Programmatically navigate to a conversation. Sets the active id
   * and triggers a (de-duped) load of the first message page, then
   * routes.
   *
   * NOTE: we intentionally do NOT call `markReadOnEntry` here.
   * The route subscriber in `ConversationPane` is the single owner
   * of mark-read on entry — that subscriber fires on both
   * permalinks and in-app clicks (we route to /messages/:id in
   * both cases), so calling it here too would PATCH twice for
   * every click. Single source of truth = the route entry.
   */
  openConversation(id: string): void {
    this._activeId.set(id);
    this.loadMessages(id);
    void this._router.navigate(['/messages', id]);
  }

  /**
   * Mark a conversation as read on the BE and clear its local unread
   * count optimistically.
   *
   * Called from two paths: `openConversation()` (in-app click) and the
   * route subscriber in `ConversationPane` (cold-load / permalink).
   * The route path can't gate on `unreadCount > 0` because the
   * conversation list may not have loaded yet — `activeConversation()`
   * is null until then. Calling unconditionally is fine: the BE
   * markRead is idempotent (it sets `last_read_at = NOW()`).
   */
  markReadOnEntry(id: string): void {
    // Optimistic unread clear on the inbox row. No-op when the row
    // hasn't loaded yet — that's fine, the next list refresh will
    // come back with the BE's authoritative `unreadCount: 0`.
    this.patchConversation(id, { unreadCount: 0 });
    // Cancel any pending debounced markRead for this id — the entry
    // call subsumes it (we're about to PATCH `now`, so a 1.5s-later
    // PATCH would be wasted).
    const pending = this.liveMarkReadTimers.get(id);
    if (pending) {
      clearTimeout(pending);
      this.liveMarkReadTimers.delete(id);
    }
    // Fire-and-forget. We don't roll back on failure — a stuck
    // "unread" is preferable to flashing it back on a transient blip.
    this._api.markRead(id).pipe(catchError(() => EMPTY)).subscribe();
  }

  /**
   * Debounced markRead for the actively-viewed conversation while
   * SSE messages stream in. Coalesces a burst of incoming messages
   * into a single PATCH after a quiet window. Cancelled by
   * `markReadOnEntry` (which PATCHes immediately) and by `reset`.
   */
  private scheduleLiveMarkRead(id: string): void {
    const existing = this.liveMarkReadTimers.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.liveMarkReadTimers.delete(id);
      this._api.markRead(id).pipe(catchError(() => EMPTY)).subscribe();
    }, MessagingStore.LIVE_MARK_READ_DEBOUNCE_MS);
    this.liveMarkReadTimers.set(id, timer);
  }

  /** Cancel every pending debounced markRead. Called on reset/logout. */
  private cancelAllLiveMarkRead(): void {
    for (const timer of this.liveMarkReadTimers.values()) {
      clearTimeout(timer);
    }
    this.liveMarkReadTimers.clear();
  }

  // ─── F5 safety actions ────────────────────────────────────────

  /** Dismiss the threat banner for the active conversation. */
  dismissThreatFlags(): void {
    const id = this._activeId();
    if (!id) return;
    this._threatFlagsByConv.update((all) => omitKey(all, id));
  }

  /**
   * Block a user.
   *
   * On success the BE soft-deletes our side's view of every shared
   * conversation, so we mirror that locally: drop the row from the
   * inbox, clear cached messages + drafts, navigate back to /messages
   * if we were viewing it.
   *
   * Returns a Promise so the dialog can keep its submitting state in
   * sync. Errors bubble to the global handler — block is a deliberate
   * action, a generic toast is fine.
   */
  blockUser(params: {
    blockedId: string;
    reason: UserBlockReason | null;
    conversationId: string | null;
  }): Promise<boolean> {
    const { blockedId, reason, conversationId } = params;

    return new Promise((resolve) => {
      this._api
        .block(blockedId, reason ?? undefined)
        .pipe(
          tap(() => {
            if (conversationId) {
              this.removeConversation(conversationId);
              this.dropConversationCaches(conversationId);
              // If we were viewing this thread, navigate away.
              if (this._activeId() === conversationId) {
                this._activeId.set(null);
                void this._router.navigate(['/messages']);
              }
            }
            resolve(true);
          }),
          catchError((err: unknown) => {
            resolve(false);
            return throwError(() => err);
          }),
        )
        .subscribe({ error: () => resolve(false) });
    });
  }

  /**
   * Toggle mute on a conversation.
   *
   * v1 has no "mute for N hours" picker — it's an indefinite toggle.
   * To unmute, send `untilIso: null`. To mute indefinitely, send a
   * far-future ISO (year 2099). The BE stores it as-is; the inbox row
   * just looks at the boolean derived from `muted`.
   *
   * Optimistic flip — the SSE `conversation.muted` event reconciles
   * cross-device, and on failure the row state will drift slightly
   * until the next list refresh (acceptable for v1).
   */
  toggleMute(conversationId: string): Promise<boolean> {
    const conv = this._conversations().find((c) => c.id === conversationId);
    if (!conv) return Promise.resolve(false);

    const willMute = !conv.muted;
    const untilIso = willMute ? '2099-12-31T23:59:59.000Z' : null;

    // Optimistic flip.
    this.patchConversation(conversationId, { muted: willMute });

    return new Promise((resolve) => {
      this._api
        .muteConversation(conversationId, untilIso)
        .pipe(
          tap(() => resolve(true)),
          catchError((err: unknown) => {
            // Roll back on failure.
            this.patchConversation(conversationId, { muted: !willMute });
            resolve(false);
            return throwError(() => err);
          }),
        )
        .subscribe({ error: () => resolve(false) });
    });
  }

  /**
   * Report a message or conversation. The BE accepts either
   * `messageId` or `conversationId` (at least one required). No local
   * state changes — the report goes to a moderation queue; the user
   * gets a confirmation toast from the dialog.
   */
  reportMessage(payload: ReportMessagePayload): Promise<boolean> {
    return new Promise((resolve) => {
      this._api
        .report(payload)
        .pipe(
          tap(() => resolve(true)),
          catchError((err: unknown) => {
            resolve(false);
            return throwError(() => err);
          }),
        )
        .subscribe({ error: () => resolve(false) });
    });
  }

  /**
   * Load the first page of messages for a conversation. Idempotent —
   * skipped if a load is in flight OR we already have data and this
   * isn't a forced refresh.
   */
  loadMessages(conversationId: string, opts: { force?: boolean } = {}): void {
    const state = this.messagesFor(conversationId);
    if (state.loading) return;
    if (!opts.force && state.hasLoaded) return;

    this.patchMessages(conversationId, { loading: true });

    this._api
      .listMessages(conversationId, { limit: MESSAGE_PAGE_SIZE })
      .pipe(
        tap((page) => {
          // The BE returns newest-first. We store oldest-first so the
          // template can render top→bottom in chronological order.
          const oldestFirst = [...page.items].reverse();
          this.patchMessages(conversationId, {
            items: oldestFirst,
            nextBefore: page.nextBefore,
            hasLoaded: true,
          });
        }),
        catchError(() => EMPTY),
        finalize(() => this.patchMessages(conversationId, { loading: false })),
      )
      .subscribe();
  }

  // ─── Sending ──────────────────────────────────────────────────

  /**
   * Send a message.
   *
   * Two call shapes:
   *   - Existing conversation: `sendMessage({ conversationId, recipientId, body })`.
   *   - New conversation (from the picker): same params, but
   *     `conversationId` is `null` — the BE auto-creates the
   *     conversation on first send and returns it in the response.
   *
   * Optimistic insert: a temp message is added to the active thread
   * immediately with id `optim-<random>`. On 201, we replace it with
   * the server's row. On error, we strip it back out and surface the
   * BE's message via `sendError` (which the composer renders inline).
   *
   * 429 sets `sendRateLimitedUntil` so the composer disables for the
   * BE-supplied window. 403 surfaces the reason as an inline error
   * (suspended, new-account rule). Everything else bubbles to the
   * global error interceptor.
   *
   * Returns the resolved conversationId so the picker can route.
   */
  sendMessage(params: {
    conversationId: string | null;
    recipientId: string;
    body: string;
  }): Promise<string | null> {
    const { conversationId, recipientId, body } = params;
    const trimmed = body.trim();
    if (!trimmed) return Promise.resolve(conversationId);

    // Honour any active rate-limit window.
    if (this._sendRateLimitedUntil() && Date.now() < this._sendRateLimitedUntil()!) {
      return Promise.resolve(conversationId);
    }

    const draftKey = conversationId ?? 'new';
    const senderId = this._auth.user()?.id ?? null;
    const now = new Date().toISOString();
    const optimisticId = `optim-${cryptoRandom()}`;

    // Insert into the active thread when we have one. New-message
    // sends don't have a thread to insert into until the BE responds.
    if (conversationId) {
      const optimistic: MessageView = {
        id: optimisticId,
        conversationId,
        senderId,
        kind: 'TEXT',
        body: trimmed,
        deletedAt: null,
        createdAt: now,
      };
      this.patchMessages(conversationId, {
        items: [...this.messagesFor(conversationId).items, optimistic],
        hasLoaded: true,
      });
    }

    this._sending.update((s) => ({ ...s, [draftKey]: true }));
    this._sendError.set(null);

    return new Promise((resolve) => {
      this._api
        .sendMessage(recipientId, trimmed)
        .pipe(
          tap((res: SendMessageResult) => {
            // Race guard: if the user blocked the recipient while
            // this send was in flight, blockUser will have removed
            // the conversation row + caches. Re-creating them here
            // would ghost the freshly-blocked thread back into the
            // inbox. Detect by: existing-conversation send where the
            // conversation no longer appears in the inbox AND we
            // have no cached messages for it (blockUser dropped them).
            if (
              conversationId &&
              !this._conversations().some((c) => c.id === conversationId) &&
              !(conversationId in this._messagesByConv())
            ) {
              this._composerDraft.update((all) => omitKey(all, draftKey));
              resolve(conversationId);
              return;
            }

            // Clear the draft on success — composer is now empty.
            this._composerDraft.update((all) => omitKey(all, draftKey));

            const realConvId = res.conversation.id;

            // Silent-drop branch: the BE accepted the request but the
            // recipient won't receive it (they blocked us, no longer
            // exist, etc.). The BE returns a synthetic conversation
            // shell to avoid leaking that signal. We keep the message
            // visible to the SENDER in the existing thread and surface
            // a calm inline notice — but we do NOT upsert the synthetic
            // row into the inbox or navigate into it (it 404s on click).
            //
            // Two callsite shapes need handling:
            //   - Existing conversation (conversationId != null):
            //     replace the optimistic bubble with the canonical row.
            //   - From the picker (conversationId == null):
            //     exit compose mode and clear the picker draft so the
            //     user isn't stuck on a frozen picker screen — the
            //     inline error explains why no thread was created.
            if (!res.delivered) {
              if (conversationId) {
                // Replace optimistic insert with the canonical row so
                // the bubble looks "sent" to the user.
                this.patchMessages(conversationId, {
                  items: this.messagesFor(conversationId).items.map((m) =>
                    m.id === optimisticId ? res.message : m,
                  ),
                });
              } else {
                // From the picker. Close compose mode so the user is
                // not trapped on a half-state screen; the inline error
                // (next set call) tells them why no thread opened.
                this._composeMode.set(false);
              }
              this._sendError.set(
                'Message couldn’t be delivered. They may have left or blocked messages from you.',
              );
              resolve(conversationId);
              return;
            }

            // Replace optimistic insert with the server row.
            if (conversationId) {
              this.patchMessages(conversationId, {
                items: this.messagesFor(conversationId).items.map((m) =>
                  m.id === optimisticId ? res.message : m,
                ),
              });
            } else {
              // New conversation: seed the messages cache with the
              // first message so the thread renders without an extra
              // round-trip.
              this.patchMessages(realConvId, {
                items: [res.message],
                hasLoaded: true,
              });
            }

            // Upsert the conversation list item — promotes it to the
            // top via re-sort, refreshes preview + last_message_at.
            this._conversations.update((list) => [
              res.conversation,
              ...list.filter((c) => c.id !== realConvId),
            ]);

            // Capture / clear threat flags for this conversation.
            // Only the sender (us) ever sees these — the BE computes
            // them on the message we just sent and returns them in
            // the same response. The banner stays visible until the
            // user dismisses it or sends a clean message.
            if (res.threatFlags.anyFlag) {
              this._threatFlagsByConv.update((all) => ({
                ...all,
                [realConvId]: res.threatFlags,
              }));
            } else {
              this._threatFlagsByConv.update((all) => omitKey(all, realConvId));
            }

            // For new conversations, route into the thread.
            if (!conversationId) {
              this._composeMode.set(false);
              this._activeId.set(realConvId);
              void this._router.navigate(['/messages', realConvId]);
            }

            resolve(realConvId);
          }),
          catchError((err: unknown) => {
            // Roll back the optimistic insert.
            if (conversationId) {
              this.patchMessages(conversationId, {
                items: this.messagesFor(conversationId).items.filter(
                  (m) => m.id !== optimisticId,
                ),
              });
            }

            if (err instanceof HttpErrorResponse) {
              if (err.status === 429) {
                const retryAfter = (err.error as { retryAfter?: number })
                  ?.retryAfter;
                const windowMs = retryAfter
                  ? retryAfter * 1000
                  : DEFAULT_RETRY_AFTER_MS;
                this._sendRateLimitedUntil.set(Date.now() + windowMs);
                this._sendError.set(
                  retryAfter
                    ? `Slow down — try again in ${retryAfter}s.`
                    : 'Slow down — too many messages.',
                );
                resolve(conversationId);
                return EMPTY;
              }
              if (err.status === 403) {
                // BE supplies user-facing copy in `message` already.
                const reason =
                  (err.error as { message?: string })?.message ??
                  'You can’t send this message.';
                this._sendError.set(reason);
                resolve(conversationId);
                return EMPTY;
              }
              if (err.status === 400) {
                this._sendError.set('Message couldn’t be sent.');
                resolve(conversationId);
                return EMPTY;
              }
              if (err.status === 0) {
                // No network. Inline-only — global handler also fires.
                this._sendError.set('You’re offline. Check your connection.');
                resolve(conversationId);
                return throwError(() => err);
              }
            }

            // 5xx + anything else: let the global handler show the
            // dialog AND surface an inline error so the composer
            // doesn't sit silent.
            this._sendError.set('Couldn’t send. Try again.');
            resolve(conversationId);
            return throwError(() => err);
          }),
          finalize(() => {
            this._sending.update((s) => omitKey(s, draftKey));
          }),
        )
        .subscribe({
          // Swallow the error AFTER catchError has had a chance to
          // bubble it to the global interceptor. Without this the
          // unhandled rejection would log; with it, the global error
          // dialog still fires from the HTTP interceptor layer.
          error: () => {},
        });
    });
  }

  /**
   * Load one more page of OLDER messages (toward the start of the
   * conversation). Called when the user scrolls within ~200px of the
   * top of the thread. No-op when there's no cursor (we've hit the
   * top) or a load is already in flight.
   */
  loadOlderMessages(conversationId: string): void {
    const state = this.messagesFor(conversationId);
    if (state.loading) return;
    if (!state.nextBefore) return;

    this.patchMessages(conversationId, { loading: true });

    this._api
      .listMessages(conversationId, { before: state.nextBefore, limit: MESSAGE_PAGE_SIZE })
      .pipe(
        tap((page) => {
          const oldestFirst = [...page.items].reverse();
          this.patchMessages(conversationId, {
            // Prepend older messages.
            items: [...oldestFirst, ...this.messagesFor(conversationId).items],
            nextBefore: page.nextBefore,
          });
        }),
        catchError((err: unknown) => {
          // BE returns 400 when the `before` cursor message no longer
          // belongs to the conversation (deleted by moderator, etc.).
          // Without clearing nextBefore we'd loop forever showing
          // "Loading earlier messages…" — hide the affordance by
          // marking the top reached.
          if (err instanceof HttpErrorResponse && err.status === 400) {
            this.patchMessages(conversationId, { nextBefore: null });
          }
          return EMPTY;
        }),
        finalize(() => this.patchMessages(conversationId, { loading: false })),
      )
      .subscribe();
  }

  // ─── Data actions ─────────────────────────────────────────────

  /**
   * Refresh the conversation list. Idempotent in three ways:
   *   - Skipped if a request is already in flight.
   *   - Skipped if we loaded within the dedup window AND this isn't
   *     a forced refresh.
   *   - Skipped if the BE is currently rate-limiting us.
   *
   * Pass `force: true` to bypass the dedup window (used by F2 manual
   * refresh, F6 SSE-triggered refreshes).
   */
  loadConversations(opts: { force?: boolean } = {}): void {
    if (this._loading()) return;

    const now = Date.now();

    if (now < this.rateLimitedUntilAt) {
      // BE asked us to back off. Honour it silently.
      return;
    }

    if (!opts.force && now - this.lastLoadAttemptAt < AUTO_LOAD_DEDUP_WINDOW_MS) {
      // Loaded too recently. Treat the call as a no-op so a noisy
      // auth boot doesn't stampede the BE.
      return;
    }

    this.lastLoadAttemptAt = now;
    this._loading.set(true);

    this._api
      .listConversations(1, 50)
      .pipe(
        tap((page) => {
          this._conversations.set(page.items);
          this._hasLoaded.set(true);
          // Clear any prior 429 window on a successful load.
          this.rateLimitedUntilAt = 0;
        }),
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 429) {
            // Respect Retry-After if the BE provided one (it does —
            // MessagingRateLimitService throws with a `retryAfter`
            // body field).
            const body = err.error as { retryAfter?: number } | null;
            const retryAfterMs = body?.retryAfter
              ? body.retryAfter * 1000
              : DEFAULT_RETRY_AFTER_MS;
            this.rateLimitedUntilAt = Date.now() + retryAfterMs;
            return EMPTY;
          }
          // Anything else (5xx, network) bubbles to the global
          // ErrorDialog via the existing error interceptor.
          return throwError(() => err);
        }),
        catchError(() => {
          // Final safety net so the signal doesn't get stuck loading
          // if an unexpected error escapes.
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  // ─── SSE event handling ───────────────────────────────────────

  /**
   * Route a parsed SSE envelope to the right handler. Heartbeats are
   * no-ops (the realtime service uses them as a health beacon, but
   * the store has no state to update). Everything else is acked to
   * the BE so the server's per-user cursor advances.
   *
   * Exhaustive switch on event type — if the BE adds a new variant,
   * the `never` arm forces a compile error so we don't silently drop
   * events we don't understand.
   */
  private handleStreamEnvelope(envelope: MessagingStreamEnvelope): void {
    const { event, id } = envelope;

    switch (event.type) {
      case 'message.created':
        this.applyMessageCreated(event);
        break;
      case 'message.deleted':
        this.applyMessageDeleted(event);
        break;
      case 'conversation.read':
        this.applyConversationRead(event);
        break;
      case 'conversation.muted':
        this.applyConversationMuted(event);
        break;
      case 'heartbeat':
        // No-op. The realtime service already tracks lastEventId.
        return;
      default: {
        const _exhaustive: never = event;
        return _exhaustive;
      }
    }

    // Ack so the BE can advance the per-user cursor (best-effort —
    // even without ack, the EventSource `Last-Event-ID` header drives
    // replay, but the ack lets the server prune the buffer earlier).
    if (id) {
      this._api
        .ackStreamEvent(id)
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
  }

  /**
   * Apply a `message.created` event.
   *
   *   - Skip the echo of our own send: the optimistic insert already
   *     wrote this message into the cache, and the POST response will
   *     replace it with the canonical row. Otherwise we'd render the
   *     same message twice.
   *   - If the user is currently viewing this conversation, append to
   *     the cached message list AND clear local unread (the BE will
   *     mark-read on the next user interaction or `markReadOnEntry`).
   *   - Always upsert the conversation row: refresh preview, bump
   *     unread count when not active, promote to the top of the list.
   *   - If the conversation isn't in the list at all (first message of
   *     a brand-new DM from someone we've never talked to), fetch it
   *     so the inbox row materialises without a full reload.
   */
  private applyMessageCreated(
    event: Extract<MessagingStreamEvent, { type: 'message.created' }>,
  ): void {
    const { conversationId, message } = event.payload;
    const myId = this._auth.user()?.id ?? null;
    const isMine = message.senderId !== null && message.senderId === myId;

    // De-dup: did the optimistic-insert path already place this row?
    // We match on id (canonical BE id replaces the `optim-…` temp id
    // on the POST response — so by the time the SSE arrives it's
    // either already present with the real id, or about to be).
    const existing = this.messagesFor(conversationId).items;
    const alreadyPresent = existing.some((m) => m.id === message.id);

    if (!alreadyPresent && !isMine) {
      // Append in chronological order. The cache stores oldest-first;
      // a newly-created message goes to the end.
      const view: MessageView = {
        id: message.id,
        conversationId,
        senderId: message.senderId,
        kind: (message.kind as MessageView['kind']) ?? 'TEXT',
        body: message.body,
        deletedAt: null,
        createdAt: message.createdAt,
      };
      this.patchMessages(conversationId, {
        items: [...existing, view],
        // Only flip hasLoaded if we'd already begun loading — we
        // don't want a stray SSE to short-circuit the first REST
        // page load by signalling "we have data".
        hasLoaded: existing.length > 0 ? true : this.messagesFor(conversationId).hasLoaded,
      });
    }

    const isActive = this._activeId() === conversationId;

    // If the user is currently viewing this thread and the message
    // wasn't their own, schedule a markRead. Debounced 1.5s so a
    // burst of incoming messages doesn't fan out into one PATCH per
    // message — the recipient's UI shows the messages instantly,
    // the BE just needs to land the cursor eventually.
    if (isActive && !isMine) {
      this.scheduleLiveMarkRead(conversationId);
    }

    // Upsert the inbox row. Two cases:
    //   1. The row exists → patch preview / lastMessageAt / unread.
    //   2. The row is missing → fetch the full conversation so the
    //      inbox materialises. We can't synthesise it here (no
    //      otherUser snapshot in the SSE payload).
    const present = this._conversations().some((c) => c.id === conversationId);

    if (present) {
      this._conversations.update((list) => {
        const idx = list.findIndex((c) => c.id === conversationId);
        if (idx < 0) return list;
        const prev = list[idx];
        const updated: ConversationListItem = {
          ...prev,
          lastMessageAt: message.createdAt,
          lastMessagePreview: previewFromBody(message.body),
          unreadCount: isMine || isActive ? prev.unreadCount : prev.unreadCount + 1,
        };
        // Promote to the top (server order is last_message_at DESC).
        const without = list.filter((_, i) => i !== idx);
        return [updated, ...without];
      });
    } else if (!isMine) {
      // Missing row. Fetch the full conversation snapshot, then
      // insert. Fire-and-forget — a transient failure just means
      // the row appears on the next refresh.
      this._api
        .getConversation(conversationId)
        .pipe(catchError(() => EMPTY))
        .subscribe((conv) => {
          this._conversations.update((list) => {
            // Guard against a concurrent insert (REST refresh racing
            // the SSE handler).
            if (list.some((c) => c.id === conv.id)) return list;
            return [conv, ...list];
          });
        });
    }
  }

  /**
   * Apply a `message.deleted` event. The sender removed their message;
   * render the tombstone in place (same shape the BE serves on
   * subsequent fetches: `body = '[deleted]'`, `deletedAt` set).
   */
  private applyMessageDeleted(
    event: Extract<MessagingStreamEvent, { type: 'message.deleted' }>,
  ): void {
    const { conversationId, messageId } = event.payload;
    const items = this.messagesFor(conversationId).items;
    const idx = items.findIndex((m) => m.id === messageId);
    if (idx < 0) return;

    const next: MessageView[] = items.slice();
    next[idx] = {
      ...next[idx],
      body: '[deleted]',
      deletedAt: new Date().toISOString(),
    };
    this.patchMessages(conversationId, { items: next });
  }

  /**
   * Apply a `conversation.read` event. The BE emits this to the *other*
   * active participants when someone marks a conversation read, carrying
   * the reader's `userId` + `lastReadAt`.
   *
   * - When `userId` is someone else (the common case for a DM): the other
   *   side just read the thread, so we advance `lastReadByOther` — this
   *   drives the "Read" receipt on our own messages.
   * - When `userId` is us (a cross-device echo, if the BE ever sends one):
   *   clear our local unread badge.
   */
  private applyConversationRead(
    event: Extract<MessagingStreamEvent, { type: 'conversation.read' }>,
  ): void {
    const { conversationId, userId, lastReadAt } = event.payload;
    const myId = this._auth.user()?.id ?? null;

    if (userId === myId) {
      this._conversations.update((list) =>
        list.map((c) =>
          c.id === conversationId && c.unreadCount > 0
            ? { ...c, unreadCount: 0 }
            : c,
        ),
      );
      return;
    }

    // The other participant read the thread — advance the read marker so
    // our sent messages flip to "Read". Guard against an out-of-order event
    // moving the marker backwards.
    this._conversations.update((list) =>
      list.map((c) => {
        if (c.id !== conversationId) return c;
        if (
          c.lastReadByOther &&
          new Date(lastReadAt).getTime() <= new Date(c.lastReadByOther).getTime()
        ) {
          return c;
        }
        return { ...c, lastReadByOther: lastReadAt };
      }),
    );
  }

  /**
   * Apply a `conversation.muted` event. Flips the `muted` flag on the
   * inbox row. `mutedUntil` is parsed but not stored separately — v1
   * only needs the boolean for the row indicator.
   */
  private applyConversationMuted(
    event: Extract<MessagingStreamEvent, { type: 'conversation.muted' }>,
  ): void {
    const { conversationId, userId, mutedUntil } = event.payload;
    const myId = this._auth.user()?.id ?? null;
    if (userId !== myId) return;

    const muted = mutedUntil !== null;
    this._conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, muted } : c)),
    );
  }

  // ─── Internal ─────────────────────────────────────────────────

  private onLogin(): void {
    // Reset bookkeeping so logout-then-login from the same session
    // gives a fresh, non-stale view.
    this.lastLoadAttemptAt = 0;
    this.rateLimitedUntilAt = 0;
    this.loadConversations();

    if (!this.realtimeConnected) {
      // Realtime stream wires up here so the badge updates live in F2+.
      this._realtime.connect();
      this.realtimeConnected = true;
    }
  }

  private onLogout(): void {
    if (this.realtimeConnected) {
      this._realtime.disconnect();
      this.realtimeConnected = false;
    }
    this.reset();
  }

  private reset(): void {
    this._conversations.set([]);
    this._hasLoaded.set(false);
    this._loading.set(false);
    this._activeId.set(null);
    this._filter.set('all');
    this._searchQuery.set('');
    this._messagesByConv.set({});
    this._composerDraft.set({});
    this._sending.set({});
    this._composeMode.set(false);
    this._sendRateLimitedUntil.set(null);
    this._sendError.set(null);
    this._threatFlagsByConv.set({});
    this.cancelAllLiveMarkRead();
    this.cachedConversationOrder = [];
    this.lastLoadAttemptAt = 0;
    this.rateLimitedUntilAt = 0;
  }

  /**
   * Shallow-merge into the per-conversation message state. Always
   * starts from the previous entry (or `EMPTY_MESSAGES` if absent) so
   * callers can patch a single field without clobbering the rest.
   *
   * Also bumps the LRU ordering and evicts the least-recently-touched
   * conversation when the cache exceeds `MAX_CACHED_CONVERSATIONS`.
   */
  private patchMessages(
    conversationId: string,
    patch: Partial<ConversationMessages>,
  ): void {
    this._messagesByConv.update((all) => {
      const prev = all[conversationId] ?? EMPTY_MESSAGES;
      return { ...all, [conversationId]: { ...prev, ...patch } };
    });
    this.touchCache(conversationId);
  }

  /**
   * Mark `id` as the most-recently-touched cache entry. Evicts the
   * least-recently-touched one when the cache exceeds the limit,
   * skipping the currently-active conversation so the user always
   * has their thread in memory.
   */
  private touchCache(id: string): void {
    const idx = this.cachedConversationOrder.indexOf(id);
    if (idx >= 0) this.cachedConversationOrder.splice(idx, 1);
    this.cachedConversationOrder.push(id);

    while (
      this.cachedConversationOrder.length > MessagingStore.MAX_CACHED_CONVERSATIONS
    ) {
      // Don't evict the active conversation even if it's at the front.
      // Active state should always have its messages in memory.
      const candidate = this.cachedConversationOrder[0];
      if (candidate === this._activeId()) {
        // Bump it to the back of the queue and try the new front.
        this.cachedConversationOrder.shift();
        this.cachedConversationOrder.push(candidate);
        continue;
      }
      this.cachedConversationOrder.shift();
      this._messagesByConv.update((all) => omitKey(all, candidate));
      // Also drop the draft + threat flags for an evicted conv —
      // they're useless without the thread in memory and would
      // otherwise leak memory forever.
      this._composerDraft.update((all) => omitKey(all, candidate));
      this._threatFlagsByConv.update((all) => omitKey(all, candidate));
    }
  }

  /**
   * Patch a single conversation row in-place (no re-sort). Returns
   * silently when the row isn't loaded — callers don't need to
   * pre-check existence.
   */
  private patchConversation(
    id: string,
    patch: Partial<ConversationListItem>,
  ): void {
    this._conversations.update((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  /** Drop a conversation row from the inbox. No-op if not present. */
  private removeConversation(id: string): void {
    this._conversations.update((list) => list.filter((c) => c.id !== id));
  }

  /**
   * Drop every per-conversation cache entry tied to this id. Used on
   * block (we lose access to the conversation) and at logout.
   */
  private dropConversationCaches(id: string): void {
    this._messagesByConv.update((all) => omitKey(all, id));
    this._composerDraft.update((all) => omitKey(all, id));
    this._threatFlagsByConv.update((all) => omitKey(all, id));
    this._sending.update((all) => omitKey(all, id));
  }
}

/**
 * Mirror of the BE's preview truncation. BE just slices at 200 chars
 * (`MessagingService.previewFromBody` in the API) — no whitespace
 * collapse, no ellipsis. Match that exactly so the row preview doesn't
 * visually change when the next REST refresh lands.
 */
const PREVIEW_MAX = 200;
function previewFromBody(body: string): string {
  return body.slice(0, PREVIEW_MAX);
}

/** Helper for the search filter — pulls the DM other-user's display name. */
function participantName(c: ConversationListItem): string {
  const u = c.otherUser;
  if (!u) return '';
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
}

/**
 * Return a new record without the given key. Used to drop
 * per-conversation entries from maps (drafts, sending flags, message
 * caches, threat flags) without mutating the previous snapshot.
 */
function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const { [key]: _drop, ...rest } = record;
  return rest;
}

/**
 * Browser `crypto.randomUUID()` when available, falling back to a
 * non-crypto random suffix. Used only for optimistic-insert temp ids
 * (they never leave the FE) so the fallback's collision risk is fine.
 */
function cryptoRandom(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID(): string }).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
