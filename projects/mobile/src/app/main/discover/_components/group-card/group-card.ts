import { Component, computed, input, output } from '@angular/core';
import { IonCard } from '@ionic/angular/standalone';

import { DiscoverGroup } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { GROUP_AVATAR_TONE } from '../../../../_shared/utils/avatar-tone.utils';
import { discoverGroupMetaParts } from '../../discover.config';

/**
 * A group to join on the Discover tab: the group's violet hexagon, its name
 * on up to two lines, and "3 members · Cluj-Napoca" (led by "Request
 * pending" once the reader has asked).
 */
@Component({
  selector: 'mh-group-card',
  imports: [HexAvatar, IonCard],
  templateUrl: './group-card.html',
  styleUrl: './group-card.scss',
})
export class GroupCard {
  readonly group = input.required<DiscoverGroup>();

  readonly select = output<void>();

  readonly meta = computed(() => discoverGroupMetaParts(this.group()));

  /** Violet, as a group is on every screen. */
  readonly tone = GROUP_AVATAR_TONE;
}
