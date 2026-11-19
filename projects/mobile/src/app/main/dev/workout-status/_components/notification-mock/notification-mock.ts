import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TIMER_HEX_SHAPE, cellFigure } from '../../../../../_shared/config/hexagon.config';

/**
 * A picture of a notification in the shade: the app's mark on its navy
 * accent (`mh_notification_accent`) and its name, what it is about, the
 * text, and its buttons as text in that accent. Two shapes: the
 * ongoing workout notification (`RestLive.java`), whose custom view puts the
 * title, the clock and the line on one row with the rest's bar under it,
 * and a plain alert (rest over, still training), title over body. Its
 * buttons are pictures too.
 */
@Component({
  selector: 'mh-notification-mock',
  imports: [TranslatePipe],
  templateUrl: './notification-mock.html',
  styleUrl: './notification-mock.scss',
})
export class NotificationMock {
  /** Beside the app's name: "Rest", "Workout". */
  readonly sub = input('');
  /** Bold: "Go", "Push day · ", "Rest over". */
  readonly title = input('');
  /** Bold, after the title: the Chronometer. */
  readonly clock = input('');
  readonly text = input('');
  /** Title, clock and text on one row, the ongoing notification's custom view. */
  readonly inline = input(false);
  /** The rest left under the text, 0 to 1; null for none. */
  readonly progress = input<number | null>(null);
  readonly actions = input<readonly string[]>([]);

  readonly hex = cellFigure(TIMER_HEX_SHAPE);
}
