import { Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { AuthService, MessagingStore, NotificationStore } from 'core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronDownOutline, closeOutline, searchOutline } from 'ionicons/icons';

import { ErrorDialog } from './_shared/components/error-dialog/error-dialog';
import { ThemeService } from './_shared/services/theme.service';
import { PushRegistrationService } from './_shared/services/push-registration.service';
import { AppLinkService } from './_shared/services/app-link.service';

@Component({
  selector: 'mh-root',
  imports: [ErrorDialog, IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Instantiated here so the stored theme preference applies before first paint.
  private readonly _themeService = inject(ThemeService);
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * Instantiated for its constructor: it hydrates `AuthStore` from the stored
   * session and kicks off the /users/me refresh. `authGuard` only checks that a
   * token exists, so without this a cold start into /tabs renders with an empty
   * AuthStore — the shell reads roles from it, so a coach would get the trainee
   * tab bar and no role pill until some unrelated request happened to construct
   * this service.
   */
  private readonly _authService = inject(AuthService);

  /**
   * Instantiated for its constructor: it watches the signed-in state and
   * registers or revokes this device's push token accordingly. Nothing
   * reads it, but without something constructing it no device is ever
   * registered and every push resolves to "this user has no devices".
   */
  private readonly _pushRegistration = inject(PushRegistrationService);

  /**
   * Instantiated for its constructor: it routes web app links (from emails)
   * that Android hands to the app instead of the browser.
   */
  private readonly _appLinkService = inject(AppLinkService);

  private readonly _messagingStore = inject(MessagingStore);
  private readonly _notificationStore = inject(NotificationStore);

  constructor() {
    // The outline replacements for Ionic's built-in sharp glyphs, named by
    // string in app.config.ts (back button) and on every ion-searchbar and
    // ion-select (searchIcon, clearIcon, toggleIcon), so no page owns them.
    addIcons({ chevronBackOutline, chevronDownOutline, closeOutline, searchOutline });

    // launchAutoHide is off in capacitor.config.ts — hide once the UI has rendered.
    afterNextRender(() => void SplashScreen.hide());

    // Android hardware back. Ionic's router outlet and its overlays register
    // their own handlers for pages and modals; what nobody owns is the root, so
    // back on a first-level tab does nothing and the app looks wedged.
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) void CapacitorApp.exitApp();
    });

    // Back from the background. Android freezes the WebView while the app is
    // away, so the message stream and the counts are stale; both stores
    // catch up. The WebView does not reliably fire `visibilitychange` for
    // this, which is what the stores listen to on their own.
    const resume = CapacitorApp.addListener('resume', () => {
      this._messagingStore.resync();
      this._notificationStore.refreshUnreadCount();
    });

    this._destroyRef.onDestroy(() => {
      void listener.then((handle) => handle.remove());
      void resume.then((handle) => handle.remove());
    });
  }
}
