import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, personAddOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'mh-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
})
export class Tabs {
  constructor() {
    addIcons({ peopleOutline, personAddOutline, settingsOutline });
  }
}
