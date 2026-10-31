import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonItem, IonLabel, IonSpinner } from '@ionic/angular/standalone';

import { DiscoverGroup } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { GROUP_AVATAR_TONE } from '../../../../_shared/utils/avatar-tone.utils';
import { GroupVerb, discoverGroupMeta } from '../../discover.config';
import { Highlight } from '../highlight/highlight';

/**
 * One group seen from outside, as a flat-list row: the group's hexagon, its
 * name, and "12 members · Cluj-Napoca" (led by "Request pending" once the
 * reader has asked to join). Discover's search and its all-groups list.
 *
 * In search it can carry a verb (Join, Request) beside the row; the page
 * runs the join, so the row only reports the press and shows it busy.
 */
@Component({
  selector: 'mh-discover-group-row',
  imports: [Highlight, HexAvatar, IonButton, IonItem, IonLabel, IonSpinner],
  templateUrl: './group-row.html',
  styleUrl: './group-row.scss',
  host: {
    '[class.has-verb]': '!!verb()',
    '[style.--verb-room]': 'verbRoom()',
  },
})
export class DiscoverGroupRow {
  readonly group = input.required<DiscoverGroup>();
  /** A search term to mark in the name. */
  readonly highlight = input('');
  readonly verb = input<{ verb: GroupVerb; label: string } | null>(null);
  readonly busy = input(false);

  readonly select = output<void>();
  readonly verbPress = output<GroupVerb>();

  readonly meta = computed(() => discoverGroupMeta(this.group()));

  /** "Join, Forță pentru începători": the verb says which group it acts on. */
  readonly verbLabel = computed(() => {
    const verb = this.verb();
    return verb ? `${verb.label}, ${this.group().name}` : null;
  });

  /**
   * The width the verb takes from the label: the capsule's 2rem of padding
   * and a 1rem gap before it, plus about half an em a letter at its
   * 0.75rem semibold (0.375rem). In rem, so it grows with the text size
   * like the button does.
   */
  readonly verbRoom = computed(() => {
    const verb = this.verb();
    return verb ? `${3 + 0.375 * Array.from(verb.label).length}rem` : null;
  });

  /** Violet, as a group is on every screen. */
  readonly tone = GROUP_AVATAR_TONE;
}
