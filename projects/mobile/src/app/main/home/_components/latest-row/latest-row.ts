import { Component, input, output } from '@angular/core';
import { IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { LatestRow } from '../../home.config';

/**
 * One item of Latest, on Home and on its page: a flat-list row, the
 * avatar (or a trophy for a record), who or what with when, and one line
 * under it. The whole row opens the item.
 */
@Component({
  selector: 'mh-latest-row',
  imports: [HexAvatar, IonItem, IonLabel, IonNote],
  templateUrl: './latest-row.html',
  styleUrl: './latest-row.scss',
})
export class LatestRowItem {
  readonly row = input.required<LatestRow>();

  readonly select = output<void>();
}
