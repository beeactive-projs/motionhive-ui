import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { PublicSessionInstance } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { discoverTitle, sessionResultLine } from '../../discover.config';
import { Highlight } from '../highlight/highlight';

/**
 * One upcoming session in search's results, as a flat-list row so it reads
 * with the coaches and groups above it: "Alergare ușoară în parc" over
 * "Sat 7 Nov · 07:00 · Irina Moldovan". The Discover tab's agenda keeps the
 * session cards (`mh-discover-session-row`).
 */
@Component({
  selector: 'mh-session-result-row',
  imports: [Highlight, HexAvatar, IonBadge, IonItem, IonLabel, TranslatePipe],
  templateUrl: './session-result-row.html',
  styleUrl: './session-result-row.scss',
})
export class SessionResultRow {
  readonly instance = input.required<PublicSessionInstance>();
  readonly booked = input(false);
  readonly highlight = input('');

  readonly select = output<void>();

  readonly title = computed(() => discoverTitle(this.instance()));

  readonly line = computed(() => sessionResultLine(this.instance()));
}
