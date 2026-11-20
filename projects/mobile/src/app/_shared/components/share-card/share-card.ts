import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonCard, IonIcon, IonProgressBar } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  barbellOutline,
  calendarOutline,
  chevronForwardOutline,
  eyeOffOutline,
  listOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';

import { MessageAttachment, ShareCardState, appLocale } from 'core';

import {
  SHARE_STYLES,
  sessionDateParts,
  shareActionKey,
  shareLink,
} from '../../config/share.config';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * A public thing someone sent into a chat: a session, a group, a coach, an
 * exercise or a starter. One shell (a strip in the kind's colour, the body,
 * an action row) and a body per kind. The same card for every reader: nothing
 * like "you're booked" on it, the page it opens says that.
 *
 * Tapping opens the thing; a card for something gone or no longer public
 * says "No longer available" and opens nothing.
 */
@Component({
  selector: 'mh-share-card',
  imports: [HexAvatar, IonCard, IonIcon, IonProgressBar, TranslatePipe],
  templateUrl: './share-card.html',
  styleUrl: './share-card.scss',
})
export class ShareCard {
  private readonly _router = inject(Router);
  private readonly _translateService = inject(TranslateService);

  readonly attachment = input.required<MessageAttachment>();

  readonly card = computed(() => this.attachment().card);
  readonly style = computed(() => SHARE_STYLES[this.attachment().type]);
  readonly isUnavailable = computed(() => this.card().state === ShareCardState.Unavailable);
  readonly isEnded = computed(() => this.card().state === ShareCardState.Ended);
  readonly link = computed(() => shareLink(this.attachment(), this._router.url));
  readonly actionKey = computed(() => shareActionKey(this.card()));
  /** The strip's colour, an Ionic slot. */
  readonly stripColor = computed(() => {
    if (this.isUnavailable()) {
      return 'var(--ion-color-medium)';
    }
    return `var(--ion-color-${this.style().color})`;
  });

  readonly session = computed(() => {
    const card = this.card();
    if (card.type === 'SESSION' && card.state !== ShareCardState.Unavailable) {
      return card;
    }
    return null;
  });
  readonly sessionDate = computed(() => {
    const session = this.session();
    if (!session) {
      return null;
    }
    return sessionDateParts(session.startAt, session.timezone, appLocale());
  });

  /** Where the session is: online, or the venue's name, or its city. */
  readonly sessionPlace = computed(() => {
    const session = this.session();
    if (!session) {
      return '';
    }
    if (session.online) {
      return this._translateService.instant('share.online');
    }
    if (session.placeName) {
      return session.placeName;
    }
    return session.placeCity ?? '';
  });
  /** Seats taken, 0 to 1, for the bar; null with no limit. */
  readonly seatsFill = computed(() => {
    const session = this.session();
    if (!session?.capacity) {
      return null;
    }
    return Math.min(1, session.confirmedCount / session.capacity);
  });

  readonly group = computed(() => {
    const card = this.card();
    if (card.type === 'GROUP' && card.state !== ShareCardState.Unavailable) {
      return card;
    }
    return null;
  });
  readonly coach = computed(() => {
    const card = this.card();
    if (card.type === 'COACH' && card.state !== ShareCardState.Unavailable) {
      return card;
    }
    return null;
  });
  readonly exercise = computed(() => {
    const card = this.card();
    if (card.type === 'EXERCISE' && card.state !== ShareCardState.Unavailable) {
      return card;
    }
    return null;
  });
  /** The exercise's main muscles, in the reader's language. */
  readonly muscles = computed(() => {
    const exercise = this.exercise();
    if (!exercise) {
      return '';
    }
    return exercise.primaryMuscles.map((muscle) => muscle.commonName).join(', ');
  });
  readonly program = computed(() => {
    const card = this.card();
    if (card.type === 'PROGRAM' && card.state !== ShareCardState.Unavailable) {
      return card;
    }
    return null;
  });

  /** A starter is a routine (one workout) or a program (weeks of them). */
  readonly programKind = computed(() => {
    if (this.program()?.isSingleWorkout) {
      return 'share.routine';
    }
    return 'share.program';
  });

  constructor() {
    addIcons({
      barbellOutline,
      calendarOutline,
      chevronForwardOutline,
      eyeOffOutline,
      listOutline,
      peopleOutline,
      personOutline,
    });
  }

  open(): void {
    const link = this.link();
    if (link) {
      void this._router.navigate(link);
    }
  }
}
