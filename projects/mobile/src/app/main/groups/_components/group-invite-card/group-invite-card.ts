import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { lockClosedOutline } from 'ionicons/icons';

import { CategoryStore, PendingGroupInvitation, categoryNames, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { GROUP_AVATAR_TONE } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * A group invitation waiting on the reader: who asked, the group (picture,
 * name, members, what it trains, its description), what joining shares, then
 * a quiet second verb and Join group. Trainee Home and Groups home both draw
 * it, and the invite notification opens Groups, where it waits on top.
 *
 * The second verb is the screen's: Home's "Not now" only puts the card away
 * there (the coach is not told), Groups' "Decline" answers the invitation.
 * The card only reports the choice; the screen acts on it.
 */
@Component({
  selector: 'mh-group-invite-card',
  imports: [HexAvatar, IonButton, IonIcon, IonSpinner, TranslatePipe],
  templateUrl: './group-invite-card.html',
  styleUrl: './group-invite-card.scss',
})
export class GroupInviteCard {
  private readonly _translateService = inject(TranslateService);
  private readonly _categoryStore = inject(CategoryStore);

  readonly invitation = input.required<PendingGroupInvitation>();
  /** Which answer is on its way, so its button spins and both hold still. */
  readonly answering = input<'join' | 'later' | null>(null);
  /** The quiet verb's label, a translation key. */
  readonly laterLabel = input('groups.invite.notNow');

  readonly join = output<void>();
  readonly later = output<void>();

  readonly groupTone = GROUP_AVATAR_TONE;

  readonly kicker = computed(() => {
    const inviter = this.invitation().inviter;
    if (!inviter) {
      return this._translateService.instant('groups.invite.invitedYouNoName');
    }
    return this._translateService.instant('groups.invite.invitedYou', {
      name: displayName(inviter, ''),
    });
  });

  /** "4 members · Strength training": the first thing it trains, if any. */
  readonly facts = computed(() => {
    const group = this.invitation().group;
    const members = this._translateService.instant('count.members', {
      count: group.memberCount,
    });
    const names = categoryNames(group.categoryIds, this._categoryStore.byId());
    if (names.length === 0) {
      return members;
    }
    return `${members} · ${names[0]}`;
  });

  readonly busy = computed(() => this.answering() !== null);

  constructor() {
    addIcons({ lockClosedOutline });
    this._categoryStore.ensureLoaded();
  }
}
