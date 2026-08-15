import { Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { AuthService } from 'core';

import { ErrorDialog } from './_shared/components/error-dialog/error-dialog';
import { ThemeService } from './_shared/services/theme.service';

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

  constructor() {
    // launchAutoHide is off in capacitor.config.ts — hide once the UI has rendered.
    afterNextRender(() => void SplashScreen.hide());

    // Android hardware back. Ionic's router outlet and its overlays register
    // their own handlers for pages and modals; what nobody owns is the root, so
    // back on a first-level tab does nothing and the app looks wedged.
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) void CapacitorApp.exitApp();
    });
    this._destroyRef.onDestroy(() => void listener.then((handle) => handle.remove()));
  }
}
