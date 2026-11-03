import { IonItemSliding } from '@ionic/angular/standalone';

/**
 * A swipe option's tap: report it, then close the row. Ionic leaves a row
 * open after an option is tapped, so the next render would show it half
 * swiped with stale buttons. Rows expose it to their template as a field
 * (`readonly emitAndClose = emitAndClose`).
 */
export function emitAndClose(sliding: IonItemSliding, action: { emit: () => void }): void {
  action.emit();
  void sliding.close();
}
