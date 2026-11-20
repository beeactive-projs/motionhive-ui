import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import { PaginatedResponse } from '../../models/common/pagination.model';
import {
  ConversationFolder,
  ConversationListItem,
  MessagePage,
  MessagingReach,
  MessagingSettings,
  MessagingUnreadCount,
  ShareRef,
  ShareResult,
  MessageView,
  ReportMessagePayload,
  SendMessageResult,
  UserBlock,
  UserBlockReason,
} from '../../models/messaging';

/**
 * MessagingService — thin HTTP wrapper over the BE messaging endpoints.
 *
 * Returns Observables; the MessagingStore wraps these for signal-friendly
 * consumption. Polling-style and background calls (unread-count refresh,
 * stream ack) are marked `silentRequest()` so they bypass the global
 * loading bar.
 *
 * For SSE realtime see `MessagingRealtimeService` — `EventSource` does
 * not flow through this HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ─── Conversations ───────────────────────────────────────────

  /**
   * A page of conversations. `folder` picks chats, requests or archived;
   * omitted, the API lists everything but deleted requests, as before
   * requests existed (web reads it this way).
   */
  listConversations(
    page = 1,
    limit = 20,
    folder?: ConversationFolder,
  ): Observable<PaginatedResponse<ConversationListItem>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    if (folder) {
      params = params.set('folder', folder);
    }
    return this._http.get<PaginatedResponse<ConversationListItem>>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATIONS,
      { params },
    );
  }

  getConversation(id: string): Observable<ConversationListItem> {
    return this._http.get<ConversationListItem>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION(id),
    );
  }

  /** Cursor-paginated messages, newest first. Omit `before` for the first page. */
  listMessages(
    conversationId: string,
    opts: { before?: string; limit?: number } = {},
  ): Observable<MessagePage> {
    let params = new HttpParams();
    if (opts.before) params = params.set('before', opts.before);
    if (opts.limit !== undefined) params = params.set('limit', String(opts.limit));
    return this._http.get<MessagePage>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_MESSAGES(conversationId),
      { params },
    );
  }

  // ─── Send / mutate ───────────────────────────────────────────

  sendMessage(recipientId: string, body: string): Observable<SendMessageResult> {
    return this._http.post<SendMessageResult>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.MESSAGES,
      { recipientId, body },
    );
  }

  /** One message, with its cards in the reader's language. */
  getMessage(id: string): Observable<MessageView> {
    return this._http.get<MessageView>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.MESSAGE(id),
      { context: silentRequest() },
    );
  }

  /** Send one public thing to up to 10 people; one result per person. */
  shareTo(
    recipientIds: string[],
    attachment: ShareRef,
    caption?: string,
  ): Observable<{ results: ShareResult[] }> {
    const body: { recipientIds: string[]; attachment: ShareRef; caption?: string } = {
      recipientIds,
      attachment,
    };
    if (caption) {
      body.caption = caption;
    }
    return this._http.post<{ results: ShareResult[] }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.SHARES,
      body,
    );
  }

  // ─── Message requests and archive ────────────────────────────

  /** Take a message request in: it becomes a chat. Returns the conversation. */
  acceptRequest(conversationId: string): Observable<ConversationListItem> {
    return this._http.post<ConversationListItem>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_ACCEPT(conversationId),
      {},
    );
  }

  /** Delete a message request. The sender is never told. */
  declineRequest(conversationId: string): Observable<{ declinedAt: string }> {
    return this._http.post<{ declinedAt: string }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_DECLINE(conversationId),
      {},
    );
  }

  setArchived(conversationId: string, archived: boolean): Observable<{ archived: boolean }> {
    return this._http.patch<{ archived: boolean }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_ARCHIVE(conversationId),
      { archived },
    );
  }

  /** What happens if the reader writes to this person, before they type. */
  reach(userId: string): Observable<MessagingReach> {
    return this._http.get<MessagingReach>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.REACH(userId),
      { context: silentRequest() },
    );
  }

  getSettings(): Observable<MessagingSettings> {
    return this._http.get<MessagingSettings>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.SETTINGS,
    );
  }

  updateSettings(settings: MessagingSettings): Observable<MessagingSettings> {
    return this._http.patch<MessagingSettings>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.SETTINGS,
      settings,
    );
  }

  /**
   * Mark as read up to a timestamp. Omit `upToIso` to mark the entire
   * conversation read at the server's "now".
   */
  markRead(
    conversationId: string,
    upToIso?: string,
  ): Observable<{ lastReadAt: string }> {
    return this._http.patch<{ lastReadAt: string }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_READ(conversationId),
      upToIso ? { upToIso } : {},
      // Reading is a background side-effect of opening the thread —
      // silent so it doesn't flash the global loader.
      { context: silentRequest() },
    );
  }

  /**
   * "Mark as unread": a flag on the caller's side, cleared by the next
   * markRead. The read position (and so the other side's read receipt)
   * stays where it is.
   */
  markUnread(conversationId: string): Observable<{ markedUnread: true }> {
    return this._http.patch<{ markedUnread: true }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_UNREAD(conversationId),
      {},
    );
  }

  muteConversation(
    conversationId: string,
    untilIso: string | null,
  ): Observable<{ mutedUntil: string | null }> {
    return this._http.patch<{ mutedUntil: string | null }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION_MUTE(conversationId),
      { untilIso },
    );
  }

  /**
   * "Delete chat", for the caller only: the thread and its history leave
   * their inbox, the other participant keeps everything. A newer message
   * brings the thread back with only that message in it.
   */
  clearConversation(conversationId: string): Observable<{ clearedAt: string }> {
    return this._http.delete<{ clearedAt: string }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.CONVERSATION(conversationId),
    );
  }

  deleteOwnMessage(messageId: string): Observable<MessageView> {
    return this._http.delete<MessageView>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.MESSAGE(messageId),
    );
  }

  // ─── Blocks / reports ────────────────────────────────────────

  block(blockedId: string, reason?: UserBlockReason): Observable<UserBlock> {
    return this._http.post<UserBlock>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.BLOCKS,
      { blockedId, reason },
    );
  }

  listBlocks(): Observable<UserBlock[]> {
    return this._http.get<UserBlock[]>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.BLOCKS,
    );
  }

  unblock(blockedId: string): Observable<{ ok: true }> {
    return this._http.delete<{ ok: true }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.BLOCK(blockedId),
    );
  }

  report(payload: ReportMessagePayload): Observable<unknown> {
    return this._http.post<unknown>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.REPORTS,
      payload,
    );
  }

  // ─── Unread + SSE ack ────────────────────────────────────────

  unreadCount(): Observable<MessagingUnreadCount> {
    // Polled / called on every event — must be silent.
    return this._http.get<MessagingUnreadCount>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.UNREAD_COUNT,
      { context: silentRequest() },
    );
  }

  /** Tells the BE which SSE event id the client has fully processed. */
  ackStreamEvent(lastEventId: string): Observable<{ ok: true }> {
    return this._http.post<{ ok: true }>(
      this.baseUrl + API_ENDPOINTS.MESSAGING.STREAM_ACK,
      { lastEventId },
      { context: silentRequest() },
    );
  }
}
