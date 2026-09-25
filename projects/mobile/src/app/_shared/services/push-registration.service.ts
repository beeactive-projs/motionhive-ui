import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { AuthStore, DevicePlatform, NotificationService, NotificationStore } from 'core';

import { queryParamsFor, routeFor } from '../config/notification-deep-link';
import type { NotificationData } from 'core';

/**
 * Connects the phone to the push system: asks for permission, hands the
 * OS token to the API, and routes a tap.
 *
 * The server half has existed for a while — `device_token`, the
 * registration endpoints, the dispatcher — but nothing ever called it,
 * so the table was empty and every push resolved to "this user has no
 * devices". This is the missing end.
 *
 * One implementation covers both platforms. The plugin returns an APNs
 * token on iOS and an FCM token on Android; which vendor that belongs
 * to is the server's problem, decided by the `platform` we send with
 * it.
 *
 * Registration is tied to being signed in. A token identifies a device,
 * not a person, so registering before login would file it against
 * nobody, and leaving it registered after logout would send the next
 * person's alerts to the last person's phone.
 */
@Service()
export class PushRegistrationService {
  private readonly _auth = inject(AuthStore);
  private readonly _api = inject(NotificationService);
  private readonly _notifications = inject(NotificationStore);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly available = Capacitor.isNativePlatform();
  private listeners: PluginListenerHandle[] = [];
  private registeredDeviceId: string | null = null;
  private started = false;

  /** The token the OS last gave us, for diagnostics on the account screen. */
  readonly token = signal<string | null>(null);
  /** null until we have asked; false means declined and we stop asking. */
  readonly permitted = signal<boolean | null>(null);

  constructor() {
    if (!this.available) return;

    effect(() => {
      if (this._auth.isAuthenticated()) void this.start();
      else void this.stop();
    });

    this._destroyRef.onDestroy(() => void this.stop());
  }

  /**
   * Ask for permission and register. Called on sign-in, and safe to
   * call again — the OS returns the same token and the API upserts on
   * it, so re-running produces one row rather than a duplicate.
   */
  async start(): Promise<void> {
    if (!this.available || this.started) return;
    this.started = true;

    try {
      let status = await PushNotifications.checkPermissions();
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await PushNotifications.requestPermissions();
      }

      const granted = status.receive === 'granted';
      this.permitted.set(granted);
      if (!granted) {
        this.started = false;
        return;
      }

      await this.attachListeners();
      // Triggers the 'registration' listener with the token.
      await PushNotifications.register();
    } catch {
      // A push we cannot register for must never block signing in.
      this.permitted.set(false);
      this.started = false;
    }
  }

  /**
   * Revoke this device and stop listening. Called on sign-out so the
   * next person to use the phone does not receive the last one's
   * notifications.
   */
  async stop(): Promise<void> {
    if (!this.available) return;
    this.started = false;

    const deviceId = this.registeredDeviceId;
    this.registeredDeviceId = null;
    this.token.set(null);

    for (const listener of this.listeners) await listener.remove();
    this.listeners = [];

    if (deviceId) {
      // Best effort: a failed revoke leaves a stale row the server
      // prunes when the vendor reports the token dead.
      this._api.revokeDevice(deviceId).subscribe({ error: () => undefined });
    }
  }

  private async attachListeners(): Promise<void> {
    this.listeners.push(
      await PushNotifications.addListener('registration', (token) => {
        this.token.set(token.value);
        this.sendToken(token.value);
      }),
    );

    this.listeners.push(
      await PushNotifications.addListener('registrationError', () => {
        this.permitted.set(false);
      }),
    );

    // Fires only while the app is in the foreground. The OS does not
    // show a banner in that case, which is what we want: the in-app
    // banner is the right surface when someone is already looking at
    // the app. Refreshing the store makes it appear.
    this.listeners.push(
      await PushNotifications.addListener('pushNotificationReceived', () => {
        this._notifications.refreshUnreadCount();
      }),
    );

    // The tap. Routes through the same resolver the notification centre
    // uses, so a push and a bell row open the same place — and a screen
    // that only exists on the web lands on the centre rather than
    // nowhere.
    this.listeners.push(
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => this.openFrom(action.notification.data),
      ),
    );
  }

  private sendToken(value: string): void {
    const platform =
      Capacitor.getPlatform() === 'ios'
        ? DevicePlatform.Ios
        : DevicePlatform.Android;

    this._api
      .registerDevice({
        platform,
        tokenString: value,
        deviceLabel: `${Capacitor.getPlatform()} app`,
      })
      .subscribe({
        next: (device) => (this.registeredDeviceId = device.id),
        // Silent: the user did nothing wrong and can do nothing about
        // it. They simply will not get pushes until the next sign-in.
        error: () => undefined,
      });
  }

  /**
   * Turn a push payload back into a route.
   *
   * The server flattens the deep link for transport, because both
   * vendors only carry strings: `screen`, `entityId`, and the query
   * params prefixed `qp_`. This rebuilds the shape the resolver reads.
   */
  private openFrom(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return;
    const flat = raw as Record<string, unknown>;

    const screen = typeof flat['screen'] === 'string' ? flat['screen'] : null;
    if (!screen) return;

    const queryParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(flat)) {
      if (key.startsWith('qp_') && typeof value === 'string') {
        queryParams[key.slice(3)] = value;
      }
    }

    const data: NotificationData = {
      screen,
      entityId:
        typeof flat['entityId'] === 'string' ? flat['entityId'] : undefined,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    };

    const commands = routeFor(data);
    // No mobile screen for this one. The notification centre always
    // exists and names where it lives instead, which beats a dead tap.
    void this._router.navigate(commands ?? ['/tabs/home/notifications'], {
      queryParams: commands ? (queryParamsFor(data) ?? undefined) : undefined,
    });
  }
}
