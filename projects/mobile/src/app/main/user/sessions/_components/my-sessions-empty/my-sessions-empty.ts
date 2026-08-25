import { Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * The trainee list's empty state: hexagon tile, one line, one action — the
 * action routes to Discover, because booking lives there, not here.
 *
 * Not `mh-empty-state`: the design's hexagon-tile hero is the same frame the
 * coach's `mh-sessions-empty` uses, and that component documents why the
 * generic block does not stretch to it. The no-coach variant swaps copy only
 * — same frame, no separate layout.
 */
@Component({
  selector: 'mh-my-sessions-empty',
  imports: [HexAvatar, IonButton],
  templateUrl: './my-sessions-empty.html',
  styleUrl: './my-sessions-empty.scss',
})
export class MySessionsEmpty {
  /** True once we know the trainee has no coach yet — swaps the copy. */
  readonly noCoach = input(false);

  readonly browse = output<void>();

  readonly message = computed(() =>
    this.noCoach()
      ? 'Find a coach on Discover and book your first session.'
      : 'Sessions you book with a coach show up here.',
  );
}
