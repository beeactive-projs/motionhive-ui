import { Component, afterNextRender, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';

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

  constructor() {
    // launchAutoHide is off in capacitor.config.ts — hide once the UI has rendered.
    afterNextRender(() => void SplashScreen.hide());
  }
}
