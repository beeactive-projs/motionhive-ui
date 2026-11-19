import { Component, computed, input } from '@angular/core';
import { IonItem, IonLabel, IonSkeletonText } from '@ionic/angular/standalone';

/** Cycled by row, so a column of placeholders reads as names, not as bars. */
const TITLE_WIDTHS = ['45%', '62%', '38%', '54%'];
const LINE_WIDTHS = ['78%', '64%', '86%', '70%'];

/** The leading block: an lg avatar, or the md tile of a compact row. */
const BLOCK_SIZE = '3.25rem';
const COMPACT_BLOCK_SIZE = '2.5rem';

/**
 * The loading twin of the conversation and person rows: the avatar block and
 * the flat-list skin's two lines, so the real rows land without a shift.
 *
 * `time` adds the conversation row's time at the end of the title line; the
 * person row has none. `compact` is the twin of a compact row (the exercise
 * library's, `mh-compact-row` in ion-list.css): the md tile's block and the
 * shorter lines.
 */
@Component({
  selector: 'mh-row-skeleton',
  imports: [IonItem, IonLabel, IonSkeletonText],
  templateUrl: './row-skeleton.html',
  host: { 'aria-hidden': 'true', '[class.mh-compact-row]': 'compact()' },
})
export class RowSkeleton {
  readonly index = input(0);
  readonly time = input(false);
  readonly compact = input(false);

  readonly titleWidth = computed(() => TITLE_WIDTHS[this.index() % TITLE_WIDTHS.length]);
  readonly lineWidth = computed(() => LINE_WIDTHS[this.index() % LINE_WIDTHS.length]);
  readonly blockSize = computed(() => (this.compact() ? COMPACT_BLOCK_SIZE : BLOCK_SIZE));
}
