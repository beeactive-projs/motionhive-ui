import { Component, computed, input } from '@angular/core';
import { IonItem, IonLabel, IonSkeletonText } from '@ionic/angular/standalone';

/** Cycled by row, so a column of placeholders reads as names, not as bars. */
const TITLE_WIDTHS = ['45%', '62%', '38%', '54%'];
const LINE_WIDTHS = ['78%', '64%', '86%', '70%'];

/**
 * The loading twin of the conversation and person rows: the avatar block and
 * the flat-list skin's two lines, so the real rows land without a shift.
 *
 * `time` adds the conversation row's time at the end of the title line; the
 * person row has none.
 */
@Component({
  selector: 'mh-row-skeleton',
  imports: [IonItem, IonLabel, IonSkeletonText],
  templateUrl: './row-skeleton.html',
  host: { 'aria-hidden': 'true' },
})
export class RowSkeleton {
  readonly index = input(0);
  readonly time = input(false);

  readonly titleWidth = computed(() => TITLE_WIDTHS[this.index() % TITLE_WIDTHS.length]);
  readonly lineWidth = computed(() => LINE_WIDTHS[this.index() % LINE_WIDTHS.length]);
}
