import { Component } from '@angular/core';
import { IonItem, IonLabel, IonSkeletonText } from '@ionic/angular/standalone';

/**
 * The loading twin of the session-row card (`.mh-session-row` skin):
 * time-rail slot plus two label lines, in the row's exact geometry so
 * nothing shifts when data lands. Pages loop it under their skeleton
 * state; it takes no inputs on purpose.
 */
@Component({
  selector: 'mh-session-row-skeleton',
  imports: [IonItem, IonLabel, IonSkeletonText],
  templateUrl: './session-row-skeleton.html',
  styleUrl: './session-row-skeleton.scss',
})
export class SessionRowSkeleton {}
