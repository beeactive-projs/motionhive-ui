import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * The first thing a coach with no sessions sees.
 *
 * Deliberately not `mh-empty-state`, which is a one-icon/one-action contract
 * shared by six screens. This is not an empty list — it is onboarding, and it
 * needs a hexagon tile, two CTAs at different weights, and a pair of cards
 * saying what sessions are actually for. Growing the shared component to cover
 * that would roughly double its API for a single caller and drag the other five
 * screens through a re-test.
 *
 * The host page owns the icons — `addIcons(SESSION_ICONS)` there covers the
 * names this template renders.
 */
@Component({
  selector: 'mh-sessions-empty',
  imports: [HexAvatar, IonButton, IonIcon, IonItem, IonLabel, IonList],
  templateUrl: './sessions-empty.html',
  styleUrl: './sessions-empty.scss',
})
export class SessionsEmpty {
  /**
   * Whether the coach has any existing session to copy from.
   *
   * Gates the second CTA, because "start from a template" is self-defeating on
   * a screen whose whole premise is that nothing exists yet — an empty window
   * does not prove an empty account (a series can have ended, or sit outside
   * the loaded range), but with nothing to copy the button is a dead end.
   */
  readonly hasTemplates = input(false);

  readonly create = output<void>();
  readonly fromTemplate = output<void>();
}
