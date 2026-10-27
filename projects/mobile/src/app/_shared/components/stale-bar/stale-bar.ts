import { Component, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';

/**
 * "Couldn't refresh" — the bar a list screen shows above rows it could not
 * reload.
 *
 * Keeping stale rows on screen is right; letting them pass for current is
 * not, and this is the only thing that says so. It has to stay put and offer
 * the retry: these screens refresh on every entry, and a toast would be gone
 * before a failure on entry had been read.
 *
 * Not `mh-notice`, which is an icon and a sentence with nothing to act on.
 * The page renders this straight into `ion-content`, outside `.mh-page`,
 * above the list it is about.
 */
@Component({
  selector: 'mh-stale-bar',
  imports: [IonButton, IonIcon, TranslatePipe],
  templateUrl: './stale-bar.html',
  styleUrl: './stale-bar.scss',
  host: { role: 'status' },
})
export class StaleBar {
  readonly retry = output<void>();

  constructor() {
    addIcons({ cloudOfflineOutline });
  }
}
