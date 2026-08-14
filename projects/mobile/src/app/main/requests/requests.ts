import { Component } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAddOutline } from 'ionicons/icons';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';

/**
 * Placeholder — accept/decline/resend/cancel land in M2. Blocked on a paged
 * requests endpoint: the plain `getPendingRequests()` returns `ClientRequest[]`
 * (unpaginated, and a different shape from the `InstructorClient` the row needs).
 */
@Component({
  selector: 'mh-requests',
  imports: [EmptyState, IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class Requests {
  constructor() {
    addIcons({ personAddOutline });
  }
}
