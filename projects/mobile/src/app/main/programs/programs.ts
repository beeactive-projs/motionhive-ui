import { Component } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { albumsOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';

/** Placeholder — the coaching programs builder lands later. */
@Component({
  selector: 'mh-programs',
  imports: [EmptyState, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, NotificationBell],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
})
export class Programs {
  constructor() {
    addIcons({ albumsOutline });
  }
}
