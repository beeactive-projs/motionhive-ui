import { Component, computed, input, output } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/angular/standalone';

import { PublicSessionInstance, formatSessionDuration, formatSessionTime } from 'core';

import {
  discoverMeta,
  discoverTitle,
  discoverTone,
  fullChip,
  isOnlineSession,
  sessionPriceParts,
  spotsLabel,
} from '../../discover.config';

/**
 * One discoverable session: the session-row geometry with the spine keyed
 * to the session TYPE (Discover's question is "what kind of thing is this",
 * not "do I have a seat"), a spots-or-full third line, and a two-line mono
 * price block where the other rows keep their chevron.
 */
@Component({
  selector: 'mh-discover-session-row',
  imports: [IonBadge, IonIcon, IonItem, IonLabel, IonNote],
  templateUrl: './discover-session-row.html',
  styleUrl: './discover-session-row.scss',
})
export class DiscoverSessionRow {
  readonly instance = input.required<PublicSessionInstance>();
  /** Whether the viewer already holds a booking on this instance. */
  readonly booked = input(false);

  readonly select = output<void>();

  readonly title = computed(() => discoverTitle(this.instance()));

  readonly time = computed(() => formatSessionTime(this.instance().startAt));

  readonly duration = computed(() => {
    const minutes = this.instance().template?.durationMinutes;
    return minutes ? formatSessionDuration(minutes) : '';
  });

  /** Drives the spine colour via a `data-tone` attribute. */
  readonly tone = computed(() => discoverTone(this.instance().template?.type));

  readonly meta = computed(() => discoverMeta(this.instance()));

  readonly isOnline = computed(() => isOnlineSession(this.instance()));

  readonly spots = computed(() => spotsLabel(this.instance()));

  readonly chip = computed(() => fullChip(this.instance()));

  private readonly _price = computed(() =>
    sessionPriceParts(
      this.instance().template?.priceAmountCents ?? 0,
      this.instance().template?.priceCurrency ?? 'RON',
    ),
  );

  readonly isFree = computed(() => this._price().free);

  readonly priceAmount = computed(() => {
    const price = this._price();
    return price.free ? '' : price.amount;
  });

  readonly priceCurrency = computed(() => {
    const price = this._price();
    return price.free ? '' : price.currency;
  });
}
