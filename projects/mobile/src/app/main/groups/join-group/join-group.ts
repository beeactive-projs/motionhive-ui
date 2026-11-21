import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import { GroupService, apiErrorMessage } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { GROUP_ICONS } from '../groups.icons';

/**
 * A group's invite link (`<web app>/join/:token`), opened in the app. The
 * app claims the path (iOS universal links, Android App Links), so a link
 * shared from a group lands here instead of the website: it joins, then
 * swaps itself for the group's page. An expired or revoked link says so.
 */
@Component({
  selector: 'mh-join-group',
  imports: [
    EmptyState,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
  templateUrl: './join-group.html',
  styleUrl: './join-group.scss',
})
export class JoinGroupPage implements ViewWillEnter {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _groupService = inject(GroupService);
  private readonly _translateService = inject(TranslateService);

  readonly error = signal<string | null>(null);

  private _tried: string | null = null;

  constructor() {
    addIcons(GROUP_ICONS);
  }

  ionViewWillEnter(): void {
    const token = this._route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set(this._translateService.instant('groups.joinLink.invalidOrExpired'));
      return;
    }
    // Ionic keeps the page alive: one join per link.
    if (this._tried === token) {
      return;
    }
    this._tried = token;
    this.error.set(null);
    this._groupService
      .joinViaLink(token)
      .pipe(take(1))
      .subscribe({
        next: (member) => {
          void this._router.navigate(['/tabs/groups', member.groupId], { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.error.set(
            apiErrorMessage(error, this._translateService.instant('groups.joinLink.invalidOrExpired')),
          );
        },
      });
  }

  goToGroups(): void {
    void this._router.navigate(['/tabs/groups'], { replaceUrl: true });
  }
}
