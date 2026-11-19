import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, closeOutline } from 'ionicons/icons';

import { PhotoViewerService } from '../../services/photo-viewer.service';

/**
 * A photo full screen, over whatever screen opened it (`PhotoViewerService`,
 * `mhViewPhoto`). Drawn once, in the tab shell. It looks like a group post's
 * photos (`PhotoView`): black around the photo in both themes, a close X,
 * the count and arrows when there are several.
 *
 * A modal rather than a page: the photos are handed over ready to show
 * (a private workout photo is an object URL that only the opening screen
 * holds), so there is nothing a link could open on its own.
 */
@Component({
  selector: 'mh-photo-viewer',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, TranslatePipe],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
})
export class PhotoViewer {
  readonly viewer = inject(PhotoViewerService);

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, closeOutline });
    // Leaving the screen that opened it (a banner tap, a link) closes it: the
    // photo belongs to that screen, which may drop a private one as it goes.
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart && this.viewer.isOpen()) {
          this.viewer.close();
        }
      });
  }
}
