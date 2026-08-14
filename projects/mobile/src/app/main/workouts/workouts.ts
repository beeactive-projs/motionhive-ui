import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { barbellOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';

/** Placeholder — workout history, routines and the player land in M2/M3. */
@Component({
  selector: 'mh-workouts',
  imports: [EmptyState, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './workouts.html',
  styleUrl: './workouts.scss',
})
export class Workouts {
  constructor() {
    addIcons({ barbellOutline });
  }
}
