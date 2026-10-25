import { Component } from '@angular/core';
import { IonSkeletonText } from '@ionic/angular/standalone';

interface BubbleSkeleton {
  mine: boolean;
  /** Of the row, which is the 82% a real bubble may take. */
  width: string;
  /** Closes its run: the avatar (theirs) and the time sit under it. */
  last: boolean;
}

/** A short exchange, oldest first: runs on both sides, of a few lengths. */
const BUBBLES: BubbleSkeleton[] = [
  { mine: false, width: '62%', last: false },
  { mine: false, width: '40%', last: true },
  { mine: true, width: '55%', last: true },
  { mine: false, width: '74%', last: true },
  { mine: true, width: '36%', last: false },
  { mine: true, width: '66%', last: true },
  { mine: false, width: '48%', last: true },
];

/**
 * The loading twin of a chat transcript: a day pill, then bubble runs in
 * `mh-message-bubble`'s geometry (gutter, gaps, the time under a run), so the
 * thread lands where the placeholders were. Neutral on both sides: honey is
 * the reader's own bubble, and a placeholder has no sender yet.
 */
@Component({
  selector: 'mh-thread-skeleton',
  imports: [IonSkeletonText],
  templateUrl: './thread-skeleton.html',
  styleUrl: './thread-skeleton.scss',
  host: { 'aria-hidden': 'true' },
})
export class ThreadSkeleton {
  readonly bubbles = BUBBLES;
}
