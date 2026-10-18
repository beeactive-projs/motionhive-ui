import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowForwardOutline } from 'ionicons/icons';

import { appLocale } from 'core';
import { GuestControls } from '../../../_shared/components/guest-controls/guest-controls';
import { Logo } from '../../../_shared/components/logo/logo';
import { AuthHeader } from '../_components/auth-header/auth-header';

/**
 * Where someone lands after confirming their account deletion: signed out,
 * told the date it will be erased, and how to keep it until then. The date
 * arrives as `?until=` (ISO) from the deletion screen.
 */
@Component({
  selector: 'mh-account-closed',
  imports: [
    AuthHeader,
    GuestControls,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonToolbar,
    Logo,
    TranslatePipe,
  ],
  templateUrl: './account-closed.html',
  styleUrl: './account-closed.scss',
})
export class AccountClosed {
  private readonly _navController = inject(NavController);
  private readonly _until = inject(ActivatedRoute).snapshot.queryParamMap.get('until');

  /** "14 November 2026" in the app's language; empty if the link lost it. */
  protected readonly date = computed(() => {
    const until = this._until ? new Date(this._until) : null;
    if (!until || Number.isNaN(until.getTime())) return '';
    return until.toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  constructor() {
    addIcons({ arrowForwardOutline });
  }

  protected goToLogin(): void {
    void this._navController.navigateRoot('/auth/login');
  }
}
