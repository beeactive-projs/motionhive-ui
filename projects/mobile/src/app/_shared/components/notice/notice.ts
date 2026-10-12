import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  warningOutline,
} from 'ionicons/icons';

import { NoticeTone, NoticeTones } from './notice.enums';

const ICON_BY_TONE: Record<NoticeTone, string> = {
  [NoticeTones.Medium]: 'information-circle-outline',
  [NoticeTones.Info]: 'information-circle-outline',
  [NoticeTones.Success]: 'checkmark-circle-outline',
  [NoticeTones.Warning]: 'warning-outline',
  [NoticeTones.Danger]: 'alert-circle-outline',
};

/**
 * A boxed message in a page's flow: an icon and a sentence on a wash fill —
 * the web app's `p-message`, which Ionic has no counterpart for (`ion-toast`
 * floats; this stays where the thing it explains is). The page sets
 * `role="alert"` or `role="status"` when the notice reports an outcome.
 */
@Component({
  selector: 'mh-notice',
  imports: [IonIcon],
  templateUrl: './notice.html',
  styleUrl: './notice.scss',
  host: { '[attr.data-tone]': 'tone()' },
})
export class Notice {
  readonly tone = input<NoticeTone>(NoticeTones.Medium);

  protected readonly icon = computed(() => ICON_BY_TONE[this.tone()]);

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline, informationCircleOutline, warningOutline });
  }
}
