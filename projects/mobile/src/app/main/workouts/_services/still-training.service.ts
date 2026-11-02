import { DestroyRef, Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { TranslateService } from '@ngx-translate/core';

/** One fixed id: there is only ever one open workout to ask about. */
const STILL_TRAINING_ID = 2;
/** Asked this long after the last set. */
const AFTER_LAST_SET_MS = 30 * 60 * 1000;
/** Nothing goes out at night: from 22:00 to 07:00 the question waits for the morning job. */
const QUIET_FROM_HOUR = 22;
const QUIET_UNTIL_HOUR = 7;

/**
 * "Still training?", once, 30 minutes after the last set, for a workout left
 * open (Workouts R2, Active Workout). Scheduled ahead on the phone, moved on
 * at every tick and withdrawn when the workout ends, so no server and no
 * background process. Tapping it opens the workout, where Finish is.
 *
 * Never at night: the 02:15 job closes a forgotten workout and says so in
 * the morning. Never asks for permission itself: the rest alert asks once,
 * with its reason, when the first rest runs.
 */
@Service()
export class StillTrainingService {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);
  private readonly _available = Capacitor.isNativePlatform();

  constructor() {
    if (!this._available) return;
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      if (action.notification.id !== STILL_TRAINING_ID) return;
      const route = (action.notification.extra as { route?: string } | undefined)?.route;
      if (route) void this._router.navigateByUrl(route);
    });
    inject(DestroyRef).onDestroy(() => void listener.then((handle) => handle.remove()));
  }

  /** After a set: the question moves to 30 minutes from now. */
  async remind(logId: string, name: string, now = Date.now()): Promise<void> {
    if (!this._available) return;
    await this.cancel();
    const at = new Date(now + AFTER_LAST_SET_MS);
    if (isQuietHour(at)) return;
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: STILL_TRAINING_ID,
            title: this._translateService.instant('workouts.stillTraining.title'),
            body: this._translateService.instant('workouts.stillTraining.body', { name }),
            schedule: { at, allowWhileIdle: true },
            extra: { route: `/tabs/workouts/log/${logId}` },
          },
        ],
      });
    } catch {
      // A reminder that can't be scheduled must never break a workout.
    }
  }

  /** Finished, discarded or paused: nothing to ask. */
  async cancel(): Promise<void> {
    if (!this._available) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: STILL_TRAINING_ID }] });
    } catch {
      // Nothing queued is the same outcome.
    }
  }
}

/** From 22:00 to 07:00 local time. */
export function isQuietHour(at: Date): boolean {
  const hour = at.getHours();
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}
