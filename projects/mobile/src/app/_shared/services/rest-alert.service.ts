import { DestroyRef, Service, inject, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { TranslateService } from '@ngx-translate/core';

/** Set once the person has been asked, with the reason, whatever they said. */
const ASKED_KEY = 'mh-rest-notifications-asked';

/** One fixed id: there is only ever one rest running, so a new one replaces it. */
const REST_NOTIFICATION_ID = 1;

/**
 * Whether a change of rest takes its alert down, still to come or already
 * on the lock screen: the rest ended (skipped, started, the workout left),
 * or nothing runs any more and an alert this side set is still waiting.
 */
export function restAlertEnded(
  before: number | null,
  after: number | null,
  scheduled: boolean,
): boolean {
  return after === null && (before !== null || scheduled);
}

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
 * It follows the workout's one rest, `ActiveSessionStore.rest()`, whether
 * the logger or the lock screen started it: `LockScreenService` feeds it from
 * sign-in on, so a rest begun on the lock screen still alerts after the app
 * was opened and left again.
 *
 * Once the rest is over it comes down again, from the lock screen too: when
 * the rest ends, when the app comes back to the front, and when it is opened
 * from cold. Left there, the last one of a workout stayed in Notification
 * Center for good, under a Live Activity already saying "Done".
 *
 * On Android, while the workout's ongoing notification shows, it is never
 * scheduled: that notification turns to Go and sounds itself (`RestLive.java`).
 *
 * On the web there is no plugin, so every method is a no-op and the bar
 * behaves as it always did.
 */
@Service()
export class RestAlertService {
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _translateService = inject(TranslateService);

  /** Epoch ms the current rest ends, or null when nothing is resting. */
  private endsAt: number | null = null;
  /** What comes next ("Set 3 · 62.5 kg × 8 · Bench press"), for the alert's text. */
  private next = '';
  /** True once something is actually scheduled with the OS. */
  private scheduled = false;
  /** The lock screen's own notification says Go (Android): nothing to schedule here. */
  private nativeAlert = false;
  /** null until we have asked; false means the user said no and we stop trying. */
  private readonly _permitted = signal<boolean | null>(null);

  private readonly available = Capacitor.isNativePlatform();

  constructor() {
    if (!this.available) return;

    // Opened from cold, on screen: an alert left from an earlier rest is old
    // news. Not when a lock screen button only woke the app behind it, or
    // this would take down the alert that button has just set.
    void CapacitorApp.getState()
      .then(({ isActive }) => {
        if (isActive) void this.clear(true);
      })
      .catch(() => undefined);

    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // Back on screen: the bar takes over, so nothing should be queued,
        // not even one the lock screen's ✓ scheduled while the app slept.
        void this.clear(true);
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
   * Mirror the rest's deadline (`LockScreenService`, from the store). Null
   * when rest ends, is skipped, or the workout is left. Safe to call on
   * every change — nothing reaches the OS until the app is backgrounded.
   * `nativeAlert`: the lock screen's own notification sounds at Go.
   */
  track(endsAt: number | null, next = '', nativeAlert = false): void {
    const ended = restAlertEnded(this.endsAt, endsAt, this.scheduled);
    this.endsAt = endsAt;
    this.next = next;
    this.nativeAlert = nativeAlert;
    if (ended) void this.clear(true);
  }

  /** Schedule the alert for the deadline we are holding, if it is still ahead. */
  private async arm(): Promise<void> {
    const endsAt = this.endsAt;
    if (!this.available || this.nativeAlert || endsAt === null || endsAt <= Date.now()) return;
    if (!(await this.ensurePermission())) return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REST_NOTIFICATION_ID,
            title: this._translateService.instant('workouts.restAlert.title'),
            body: this._body(),
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

  /** The set to do now, so the alert alone says what to load; the old sentence when nothing is known. */
  private _body(): string {
    if (this.next) {
      return this.next;
    }
    return this._translateService.instant('workouts.restAlert.body');
  }

  /**
   * Withdraw the alert: the one still to come, and the one on the lock
   * screen once it has gone off. Cheap and safe when there is neither.
   * `always`: one this side did not schedule too (the lock screen's ✓ sets
   * its own).
   */
  private async clear(always = false): Promise<void> {
    if (!this.available) {
      return;
    }
    if (!this.scheduled && !always) {
      return;
    }
    this.scheduled = false;
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: REST_NOTIFICATION_ID }],
      });
      // `cancel` only reaches one still to come.
      await LocalNotifications.removeDeliveredNotificationsById({ ids: [REST_NOTIFICATION_ID] });
    } catch {
      // Nothing to withdraw is the same outcome as withdrawing it.
    }
  }

  /**
   * Whether to ask now, with the reason, at the first workout: on a phone,
   * never asked before, and the system has not been answered yet.
   */
  async shouldAsk(): Promise<boolean> {
    if (!this.available) return false;
    try {
      const { value } = await Preferences.get({ key: ASKED_KEY });
      if (value) return false;
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'prompt' || status.display === 'prompt-with-rationale';
    } catch {
      return false;
    }
  }

  /** "Turn on": the system question, now that the reason has been given. */
  async askNow(): Promise<void> {
    await this._remember();
    await this.ensurePermission();
  }

  /** "Not now": no system prompt behind their back later in the workout. */
  async declineForNow(): Promise<void> {
    await this._remember();
    this._permitted.set(false);
  }

  private async _remember(): Promise<void> {
    try {
      await Preferences.set({ key: ASKED_KEY, value: '1' });
    } catch {
      // Asking again next time is the worst that happens.
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
