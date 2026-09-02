import { Component } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { flashOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';

/** Placeholder — the exercise library lands later. */
@Component({
  selector: 'mh-exercises',
  imports: [EmptyState, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, NotificationBell],
  templateUrl: './exercises.html',
  styleUrl: './exercises.scss',
})
export class Exercises {
  constructor() {
    addIcons({ flashOutline });
  }
}
