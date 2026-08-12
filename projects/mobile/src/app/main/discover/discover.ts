import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { compassOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';

/** Placeholder — the coaches / sessions / groups tabs land in M2. */
@Component({
  selector: 'mh-discover',
  imports: [EmptyState, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './discover.html',
  styleUrl: './discover.scss',
})
export class Discover {
  constructor() {
    addIcons({ compassOutline });
  }
}
