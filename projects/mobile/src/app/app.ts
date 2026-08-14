import { Component, afterNextRender, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';
import { AuthService } from 'core';

import { ThemeService } from './_shared/services/theme.service';

@Component({
  selector: 'mh-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Instantiated here so the stored theme preference applies before first paint.
  private readonly _themeService = inject(ThemeService);

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
  }
}
