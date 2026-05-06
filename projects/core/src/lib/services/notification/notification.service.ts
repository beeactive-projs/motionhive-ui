import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { silentRequest } from '../../interceptors/silent-request.context';
import { PaginatedResponse } from '../../models/common/pagination.model';
import {
  BellNotification,
  CategoryPreferenceView,
  Device,
  ListNotificationsParams,
  NotificationCategory,
  RegisterDevicePayload,
  UpdatePreferencesPayload,
} from '../../models/notification';

/**
 * NotificationService — thin HTTP wrapper over the BE notification
 * endpoints. Returns Observables; the NotificationStore wraps these
 * for signal-friendly consumption.
 *
 * Background requests (polling, viewed-tracking, heartbeats) are
 * marked with `silentRequest()` so they bypass the global loading
 * bar — the bell has its own in-popover skeleton and the badge poll
 * shouldn't flash a top-of-page spinner every 60s.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly _http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ─── Bell list ────────────────────────────────────────────────

  list(params: ListNotificationsParams = {}): Observable<PaginatedResponse<BellNotification>> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.unreadOnly) httpParams = httpParams.set('unreadOnly', 'true');

    // Bell list refresh — silent, the popover has its own skeleton.
    return this._http.get<PaginatedResponse<BellNotification>>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.BASE,
      { params: httpParams, context: silentRequest() },
    );
  }

  unreadCount(): Observable<{ count: number }> {
    // Polled every 60s — must be silent, otherwise the global
    // loading bar flashes on every tick.
    return this._http.get<{ count: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
      { context: silentRequest() },
    );
  }

  // ─── Receipt mutations ────────────────────────────────────────

  markAsRead(receiptId: string): Observable<void> {
    return this._http.patch<void>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.READ(receiptId),
      {},
    );
  }

  markAllAsRead(): Observable<{ updated: number }> {
    return this._http.patch<{ updated: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.READ_ALL,
      {},
    );
  }

  /**
   * Mark a batch as viewed. Called on bell-dropdown open — analytics
   * signal only, doesn't change the unread badge. Silent so the
   * dropdown opens without flashing the global loader.
   */
  markAsViewed(ids: string[]): Observable<{ updated: number }> {
    return this._http.patch<{ updated: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.VIEWED,
      { ids },
      { context: silentRequest() },
    );
  }

  /**
   * Click-through: sets clicked_at + read_at in one save. Called when
   * the user follows a notification's deep link.
   */
  markAsClicked(receiptId: string): Observable<void> {
    return this._http.patch<void>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.CLICKED(receiptId),
      {},
    );
  }

  dismiss(receiptId: string): Observable<void> {
    return this._http.patch<void>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.DISMISS(receiptId),
      {},
    );
  }

  remove(receiptId: string): Observable<void> {
    return this._http.delete<void>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATIONS.BY_ID(receiptId),
    );
  }

  // ─── Settings ─────────────────────────────────────────────────

  /**
   * Returns ~6 category rows in display order. Each row has the
   * merged effective channel state for that category.
   */
  getSettings(): Observable<CategoryPreferenceView[]> {
    return this._http.get<CategoryPreferenceView[]>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATION_SETTINGS.BASE,
    );
  }

  /**
   * Whole-payload save — only categories the user changed are sent.
   * The BE expands a category-level toggle into per-type writes.
   */
  updateSettings(payload: UpdatePreferencesPayload): Observable<{ written: number }> {
    return this._http.patch<{ written: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATION_SETTINGS.BASE,
      payload,
    );
  }

  /**
   * Reset a single category to defaults. Removes any per-type
   * overrides the user had under this category.
   */
  resetCategoryToDefault(
    category: NotificationCategory | string,
  ): Observable<{ removed: number }> {
    return this._http.delete<{ removed: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATION_SETTINGS.RESET_CATEGORY(category),
    );
  }

  resetAllToDefault(): Observable<{ removed: number }> {
    return this._http.delete<{ removed: number }>(
      this.baseUrl + API_ENDPOINTS.NOTIFICATION_SETTINGS.BASE,
    );
  }

  // ─── Devices (push registration storage) ──────────────────────

  registerDevice(payload: RegisterDevicePayload): Observable<Device> {
    return this._http.post<Device>(
      this.baseUrl + API_ENDPOINTS.DEVICES.REGISTER,
      payload,
    );
  }

  listDevices(): Observable<Device[]> {
    return this._http.get<Device[]>(this.baseUrl + API_ENDPOINTS.DEVICES.LIST);
  }

  revokeDevice(deviceId: string): Observable<void> {
    return this._http.delete<void>(
      this.baseUrl + API_ENDPOINTS.DEVICES.BY_ID(deviceId),
    );
  }

  heartbeatDevice(deviceId: string): Observable<void> {
    // Periodic heartbeat — silent like polling.
    return this._http.patch<void>(
      this.baseUrl + API_ENDPOINTS.DEVICES.HEARTBEAT(deviceId),
      {},
      { context: silentRequest() },
    );
  }
}
