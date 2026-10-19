import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, mailOutline } from 'ionicons/icons';

import {
  RecentPerson,
  SuggestedPerson,
  SuggestionStrip,
} from '../../config/recent-searches.config';
import { AvatarTone, avatarToneFor } from '../../utils/avatar-tone.utils';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * What an open search shows before anything is typed, after Messenger: the
 * last few people a search ended on, then a strip of people worth a tap.
 *
 * Laid out as a grouped flat list (`mh-section-label` + `mh-flat-list`), so
 * it sits straight in `ion-content` like the results that replace it. Either
 * part can be empty; the page decides whether to show this at all.
 *
 * Any number of labelled strips follow the recents, in the order given (the
 * Clients tab puts its pending requests above its newest clients). A person
 * still waiting has their status said with their name.
 *
 * Only emits: the page owns the stored list and where a tap goes.
 */
@Component({
  selector: 'mh-search-start',
  imports: [HexAvatar, IonButton, IonIcon, IonItem, IonLabel, IonList, TranslatePipe],
  templateUrl: './search-start.html',
  styleUrl: './search-start.scss',
})
export class SearchStart {
  readonly recents = input<RecentPerson[]>([]);
  /** Empty strips are left out. */
  readonly strips = input<SuggestionStrip[]>([]);

  /** A recent or a suggestion was tapped. A recent is never pending. */
  readonly select = output<SuggestedPerson>();
  readonly remove = output<RecentPerson>();
  readonly clearAll = output<void>();

  constructor() {
    addIcons({ closeOutline, mailOutline });
  }

  toneFor(id: string): AvatarTone {
    return avatarToneFor(id);
  }

  /**
   * The strip has room for a first name; the full one is the button's name.
   * An email-only invite's name is the address, so it shows the part before
   * the @, which is what reads as a name.
   */
  shortName(name: string): string {
    const first = name.trim().split(/\s+/)[0] ?? name;
    return first.includes('@') ? first.slice(0, first.indexOf('@')) : first;
  }
}
