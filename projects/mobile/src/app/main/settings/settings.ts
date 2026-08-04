import { Component, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToast,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

import { AuthService } from 'core';

import {
  ThemePreference,
  ThemePreferences,
  ThemeService,
} from '../../_shared/services/theme.service';

@Component({
  selector: 'mh-settings',
  imports: [
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonRadio,
    IonRadioGroup,
    IonTitle,
    IonToast,
    IonToolbar,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly _themeService = inject(ThemeService);
  private readonly _authService = inject(AuthService);
  private readonly _navController = inject(NavController);

  readonly ThemePreferences = ThemePreferences;
  readonly themeToastOpen = signal(false);
  readonly isSigningOut = signal(false);

  constructor() {
    addIcons({ logOutOutline });
  }

  themePreference(): ThemePreference {
    return this._themeService.preference();
  }

  onThemeChange(preference: ThemePreference): void {
    this._themeService.setPreference(preference);
    this.themeToastOpen.set(true);
  }

  onSignOut(): void {
    if (this.isSigningOut()) return;
    this.isSigningOut.set(true);
    this._authService.logout().subscribe({
      next: () => this._navController.navigateRoot('/auth/login'),
      // Even if the server call fails (e.g. offline), drop the local
      // session so the user still lands back on the login page.
      error: () => {
        this.isSigningOut.set(false);
        this._authService.clearAuthDataAndRedirect();
      },
    });
  }
}
