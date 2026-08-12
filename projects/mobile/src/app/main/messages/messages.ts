import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubblesOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';

/** Placeholder — the inbox and thread land in M3 on core's MessagingStore. */
@Component({
  selector: 'mh-messages',
  imports: [EmptyState, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './messages.html',
  styleUrl: './messages.scss',
})
export class Messages {
  constructor() {
    addIcons({ chatbubblesOutline });
  }
}
