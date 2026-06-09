import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from 'primeng/button';

/** The `beforeinstallprompt` event isn't in the TS DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Renders an "Install app" button only when the browser reports the PWA is
 * installable (HTTPS + manifest + service worker + not already installed).
 * Clicking it opens the native install dialog. Self-hides everywhere else —
 * including dev and iOS Safari, which never fires `beforeinstallprompt`.
 */
@Component({
  selector: 'mh-install-app',
  imports: [Button],
  templateUrl: './install-app.html',
  styleUrl: './install-app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeinstallprompt)': 'onBeforeInstallPrompt($event)',
    '(window:appinstalled)': 'onAppInstalled()',
  },
})
export class InstallApp {
  protected readonly canInstall = signal(false);

  private _deferredPrompt: BeforeInstallPromptEvent | null = null;

  onBeforeInstallPrompt(event: Event): void {
    // Stop Chrome's default mini-infobar so we control when the prompt shows.
    event.preventDefault();
    this._deferredPrompt = event as BeforeInstallPromptEvent;
    this.canInstall.set(true);
  }

  onAppInstalled(): void {
    this._deferredPrompt = null;
    this.canInstall.set(false);
  }

  async install(): Promise<void> {
    const deferredPrompt = this._deferredPrompt;
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    // A captured prompt can only be used once.
    this._deferredPrompt = null;
    this.canInstall.set(false);
  }
}
