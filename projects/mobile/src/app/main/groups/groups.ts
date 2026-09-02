import { Component } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleCircleOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';

/** Placeholder — the groups feed, discovery and detail surfaces land later. */
@Component({
  selector: 'mh-groups',
  imports: [EmptyState, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, NotificationBell],
  templateUrl: './groups.html',
  styleUrl: './groups.scss',
})
export class Groups {
  constructor() {
    addIcons({ peopleCircleOutline });
  }
}
