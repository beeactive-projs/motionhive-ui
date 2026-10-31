import { Component, input, output } from '@angular/core';
import { IonButton, IonSkeletonText } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { DiscoverStripItem, stripItemLabel } from '../../discover.config';

/**
 * A sideways row of hex avatars over names, the calm Home's "Your hive"
 * strip: Discover's coaches taking clients and its groups to join. Each
 * item is one button whose accessible name says the whole item; the name
 * takes up to two centred lines and the line under it one.
 *
 * The strip bleeds to the screen's edges (the page places it inside its
 * gutter), so an item cut off at the edge says there is more to scroll.
 */
@Component({
  selector: 'mh-discover-strip',
  imports: [HexAvatar, IonButton, IonSkeletonText],
  templateUrl: './discover-strip.html',
  styleUrl: './discover-strip.scss',
})
export class DiscoverStrip {
  /** Names the group of buttons for a screen reader: the section's title. */
  readonly label = input.required<string>();
  readonly items = input<DiscoverStripItem[]>([]);
  /** Placeholder tiles in the items' geometry, for the first load. */
  readonly loading = input(false);

  readonly select = output<string>();

  readonly placeholders = [0, 1, 2, 3, 4];

  readonly itemLabel = stripItemLabel;
}
