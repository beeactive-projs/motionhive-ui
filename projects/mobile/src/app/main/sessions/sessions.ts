import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';

/** Placeholder — the real coach sessions list lands in M2. */
@Component({
  selector: 'mh-sessions',
  imports: [EmptyState, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions {
  constructor() {
    addIcons({ calendarOutline });
  }
}
