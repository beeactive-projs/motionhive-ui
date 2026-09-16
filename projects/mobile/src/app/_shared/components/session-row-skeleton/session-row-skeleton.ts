import { Component, input } from '@angular/core';
import { IonItem, IonLabel, IonSkeletonText } from '@ionic/angular/standalone';

/**
 * The loading twin of the session-row card (`.mh-session-row` skin):
 * time-rail slot plus two label lines, in the row's exact geometry so
 * nothing shifts when data lands. Pages loop it under their skeleton
 * state.
 *
 * `rail` is off for the rows that carry no leading rail — a routine, a
 * program, a client on a plan — so their placeholder does not promise a
 * time column the real row never draws.
 */
@Component({
  selector: 'mh-session-row-skeleton',
  imports: [IonItem, IonLabel, IonSkeletonText],
  templateUrl: './session-row-skeleton.html',
  styleUrl: './session-row-skeleton.scss',
})
export class SessionRowSkeleton {
  readonly rail = input(true);
}
