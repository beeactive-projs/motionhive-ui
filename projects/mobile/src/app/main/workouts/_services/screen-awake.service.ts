import { Service } from '@angular/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

/**
 * Keeps the phone from dimming while a workout is on screen, so the next set
 * is there between sets without unlocking (Settings › Workouts, on by
 * default). Released as soon as the logger is left or the workout ends.
 * Every call is safe where the plugin isn't available.
 */
@Service()
export class ScreenAwakeService {
  private _held = false;

  async hold(): Promise<void> {
    if (this._held) return;
    try {
      const { isSupported } = await KeepAwake.isSupported();
      if (!isSupported) return;
      await KeepAwake.keepAwake();
      this._held = true;
    } catch {
      // Not keeping the screen on is never worth breaking a workout over.
    }
  }

  async release(): Promise<void> {
    if (!this._held) return;
    this._held = false;
    try {
      await KeepAwake.allowSleep();
    } catch {
      // Already asleep or never held: the same outcome.
    }
  }
}
