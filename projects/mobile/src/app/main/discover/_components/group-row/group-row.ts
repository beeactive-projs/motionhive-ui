import { Component, computed, input, output } from '@angular/core';
import { IonItem, IonLabel } from '@ionic/angular/standalone';

import { DiscoverGroup } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { GROUP_AVATAR_TONE } from '../../../../_shared/utils/avatar-tone.utils';
import { discoverGroupMeta } from '../../discover.config';

/**
 * One group seen from outside, as a flat-list row: the group's hexagon, its
 * name, and "12 members · Cluj-Napoca" (led by "Request pending" once the
 * reader has asked to join). Discover's search and its all-groups list.
 */
@Component({
  selector: 'mh-discover-group-row',
  imports: [HexAvatar, IonItem, IonLabel],
  templateUrl: './group-row.html',
  styleUrl: './group-row.scss',
})
export class DiscoverGroupRow {
  readonly group = input.required<DiscoverGroup>();

  readonly select = output<void>();

  readonly meta = computed(() => discoverGroupMeta(this.group()));

  /** Violet, as a group is on every screen. */
  readonly tone = GROUP_AVATAR_TONE;
}
