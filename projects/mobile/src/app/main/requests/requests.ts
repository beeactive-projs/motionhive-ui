import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'mh-requests',
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class Requests {}
