import { Component, output } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * The first thing a coach with no clients sees.
 *
 * Deliberately not `mh-empty-state`: this is onboarding, not an empty list.
 * It needs a hexagon tile, one hero CTA, and a pair of cards naming both ways
 * in — invite, or be found on Discover. Same reasoning as `mh-sessions-empty`.
 *
 * The host page owns the icons — `addIcons(CLIENT_ICONS)` there covers the
 * names this template renders.
 */
@Component({
  selector: 'mh-clients-empty',
  imports: [HexAvatar, IonButton, IonIcon, IonItem, IonLabel, IonList],
  templateUrl: './clients-empty.html',
  styleUrl: './clients-empty.scss',
})
export class ClientsEmpty {
  readonly invite = output<void>();
}
