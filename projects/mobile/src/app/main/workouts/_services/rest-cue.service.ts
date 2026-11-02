import { Service } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * What the phone does as a rest runs out, while the app is open: one light
 * tap at ten seconds to go, then a buzz and a short chime at zero. Outside
 * the app the scheduled notification takes over, under the phone's own
 * notification settings (RestAlertService).
 *
 * The chime is made here with Web Audio rather than shipped as a file: two
 * short tones, nothing to load, and it follows the ringer switch like any
 * page sound. iOS only lets a page make a sound after a tap, so `unlock()`
 * is called from the tick that starts the rest.
 *
 * `Haptics` no-ops on the web build.
 */
@Service()
export class RestCueService {
  private _audio: AudioContext | null = null;

  /** From a tap: lets the page play the chime later, when no one is touching it. */
  unlock(): void {
    try {
      this._audio ??= new AudioContext();
      if (this._audio.state === 'suspended') void this._audio.resume();
    } catch {
      this._audio = null;
    }
  }

  /** Ten seconds to go. */
  soon(vibrate: boolean): void {
    if (vibrate) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  /** Rest is over. */
  done({ sound, vibrate }: { sound: boolean; vibrate: boolean }): void {
    if (vibrate) {
      void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
    }
    if (sound) this._chime();
  }

  private _chime(): void {
    const audio = this._audio;
    if (!audio || audio.state !== 'running') return;
    const start = audio.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const at = start + i * 0.16;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
      tone.connect(gain).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.15);
    });
  }
}
