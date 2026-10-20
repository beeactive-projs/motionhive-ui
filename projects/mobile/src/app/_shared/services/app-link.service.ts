import { DestroyRef, Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { APP_HOME_URL, WEB_APP_URL } from 'core';

import { resolveAppLink } from '../config/app-link.config';

/**
 * A cold start can report its link twice (as the launch URL and as an
 * `appUrlOpen` event). Inside this window the second report is the same tap.
 */
const SAME_TAP_MS = 2_000;

/**
 * Opens web app links inside the app (Android App Links).
 *
 * An email's "Open conversation" or "Verify email" is a link to the web
 * app. The manifest claims those paths for this app and the web domain
 * confirms it with `/.well-known/assetlinks.json`, so Android hands the
 * tap to us instead of the browser. This routes it.
 *
 * Only paths the app has a screen for are claimed, so a link that still
 * resolves to nothing (a profile tab mobile does not have) lands on home
 * rather than a blank page.
 */
@Service()
export class AppLinkService {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _appHomeUrl = inject(APP_HOME_URL);
  private readonly _host = new URL(WEB_APP_URL).host;

  private lastUrl: string | null = null;
  private lastAt = 0;

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    // The link that started the app, if one did.
    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (launch?.url) this.open(launch.url);
    });

    // A link tapped while the app is already running.
    const listener = CapacitorApp.addListener('appUrlOpen', ({ url }) => this.open(url));
    this._destroyRef.onDestroy(() => void listener.then((handle) => handle.remove()));
  }

  private open(url: string): void {
    const now = Date.now();
    if (url === this.lastUrl && now - this.lastAt < SAME_TAP_MS) return;
    this.lastUrl = url;
    this.lastAt = now;

    const link = resolveAppLink(url, this._host);
    if (!link) {
      void this._router.navigateByUrl(this._appHomeUrl);
      return;
    }
    void this._router.navigate(link.commands, {
      queryParams: link.queryParams ?? undefined,
    });
  }
}
