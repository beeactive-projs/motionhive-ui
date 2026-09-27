import { DestroyRef, Service, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/** One fixed id: there is only ever one rest running, so a new one replaces it. */
const REST_NOTIFICATION_ID = 1;

/**
 * Tells the user rest is over when they are not looking at the app.
 *
 * The rest timer itself is a docked bar that derives its remainder from a
 * deadline, which is correct while the app is on screen and silent the moment
 * it is not: a Capacitor WebView is throttled in the background and suspended
 * outright on iOS, so someone who switches to Spotify between sets gets no
 * alert at all. This closes that gap.
 *
 * Deliberately NOT a push notification. Nothing about "the rest I started
 * ninety seconds ago has ended" needs a server to know it — the deadline is
 * already on the device. Scheduling it locally means no Firebase, no APNs, no
 * device token and no network at the moment it matters, which is often a gym
 * basement.
 *
 * Scheduled only while the app is backgrounded, and cancelled on resume. The
 * alternative — schedule always — fires an OS banner over a user who is
 * watching the countdown, on top of the haptic the bar already gives them.
 *
 * On the web there is no plugin, so every method is a no-op and the bar
 * behaves as it always did.
 */
@Service()
export class RestAlertService {
  private readonly _destroyRef = inject(DestroyRef);

  /** Epoch ms the current rest ends, or null when nothing is resting. */
  private endsAt: number | null = null;
  /** True once something is actually scheduled with the OS. */
  private scheduled = false;
  /** null until we have asked; false means the user said no and we stop trying. */
  private readonly _permitted = signal<boolean | null>(null);

  private readonly available = Capacitor.isNativePlatform();

  constructor() {
    if (!this.available) return;

    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // Back on screen: the bar takes over, so nothing should be queued.
        void this.clear();
      } else {
        void this.arm();
      }
    });

    this._destroyRef.onDestroy(() => {
      void this.clear();
      void listener.then((handle) => handle.remove());
    });
  }

  /**
   * Mirror the rest timer's deadline. Pass null when rest ends, is skipped,
   * or the user leaves the workout. Safe to call on every change — nothing
   * reaches the OS until the app is actually backgrounded.
   */
  track(endsAt: number | null): void {
    this.endsAt = endsAt;
    if (endsAt === null) void this.clear();
  }

  /** Schedule the alert for the deadline we are holding, if it is still ahead. */
  private async arm(): Promise<void> {
    const endsAt = this.endsAt;
    if (!this.available || endsAt === null || endsAt <= Date.now()) return;
    if (!(await this.ensurePermission())) return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REST_NOTIFICATION_ID,
            title: 'Rest over',
            body: 'Time for your next set.',
            schedule: {
              at: new Date(endsAt),
              // Android throttles inexact alarms into batches, which for a
              // ninety-second rest can mean minutes late. Exact is the point.
              allowWhileIdle: true,
            },
          },
        ],
      });
      this.scheduled = true;
    } catch {
      // A denied or unavailable notification must never break a workout.
      this.scheduled = false;
    }
  }

  /** Withdraw a scheduled alert. Cheap and safe when there is nothing queued. */
  private async clear(): Promise<void> {
    if (!this.available || !this.scheduled) return;
    this.scheduled = false;
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: REST_NOTIFICATION_ID }],
      });
    } catch {
      // Nothing to withdraw is the same outcome as withdrawing it.
    }
  }

  /**
   * Ask once, remember the answer. Asked here rather than on first launch so
   * the prompt arrives attached to something the user just did, which is the
   * only context in which it reads as reasonable rather than as a toll.
   */
  private async ensurePermission(): Promise<boolean> {
    const known = this._permitted();
    if (known !== null) return known;

    try {
      let status = await LocalNotifications.checkPermissions();
      if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
        status = await LocalNotifications.requestPermissions();
      }
      const granted = status.display === 'granted';
      this._permitted.set(granted);
      return granted;
    } catch {
      this._permitted.set(false);
      return false;
    }
  }
}
