import { Component, computed, model, signal } from '@angular/core';
import { IonDatetime, IonItem, IonLabel, IonList, IonModal } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { giftOutline } from 'ionicons/icons';

import {
  BIRTHDAY_MIN,
  birthdayLabel,
  defaultBirthdayStart,
  pickedDay,
  todayIso,
} from '../../config/about-you.config';
import { DETAIL_TILES } from '../../config/detail-tiles.config';
import { DatetimeLocaleDirective } from '../../directives/datetime-locale.directive';
import { HexAvatar } from '../hex-avatar/hex-avatar';

/**
 * The birthday as a card row with its value, opening the date picker: the
 * welcome flow's About you step and Account's birthday sheet. A row rather
 * than a text field, like the coach's city on the welcome flow, so nobody
 * lands on a field asking them to type a date.
 *
 * The picker is wheels (day, month, year), as a phone asks for a birthday:
 * a calendar opens on this month, decades away from the one to pick. It runs
 * from 1900 to today; nothing gates an age.
 *
 *     <mh-birthday-field [(value)]="birthDate" />
 */
@Component({
  selector: 'mh-birthday-field',
  imports: [DatetimeLocaleDirective, HexAvatar, IonDatetime, IonItem, IonLabel, IonList, IonModal, TranslatePipe],
  templateUrl: './birthday-field.html',
})
export class BirthdayField {
  /** `YYYY-MM-DD`; null while none is picked. */
  readonly value = model<string | null>(null);

  readonly tile = DETAIL_TILES.birthday;
  readonly min = BIRTHDAY_MIN;
  readonly max = todayIso();
  readonly pickerOpen = signal(false);

  /** "14 March 1992", or null for the row's invitation. */
  readonly label = computed(() => birthdayLabel(this.value()));

  /** The wheel's position: the birthday, or decades back when there is none yet. */
  readonly pickerValue = computed(() => this.value() ?? defaultBirthdayStart());

  constructor() {
    addIcons({ giftOutline });
  }

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  /** The picker's Done: a day replaces the value, anything else leaves it. */
  onPicked(raw: string | string[] | null | undefined): void {
    const day = pickedDay(raw);
    if (day) {
      this.value.set(day);
    }
  }
}
