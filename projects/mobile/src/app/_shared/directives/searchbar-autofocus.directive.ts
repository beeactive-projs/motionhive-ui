import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { IonSearchbar } from '@ionic/angular/standalone';

import { SHEET_PRESENTED_CLASS } from '../components/sheet-shell/sheet-shell';

/**
 * Puts the caret in an `ion-searchbar` the moment it can take a keystroke.
 *
 * A search field that appears on a tap — the header takeover on the list
 * pages, the first row of a picker sheet — should not need a second tap to
 * type into. Two things make a plain focus call not enough:
 *
 * - Ionic renders the searchbar's inner `<input>` a frame after Angular
 *   creates the element, and `setFocus()` is a silent no-op until then.
 *   `getInputElement()` waits for that render.
 * - Inside a sheet the body is built before the enter animation runs, and a
 *   keyboard mid-slide fights the sheet for the screen. So under a modal the
 *   directive waits for `ionModalDidPresent` — unless the sheet is already
 *   up, which is the case for a searchbar revealed by a segment switch.
 */
@Directive({ selector: 'ion-searchbar[mhAutofocus]' })
export class SearchbarAutofocusDirective {
  private readonly _searchbar = inject(IonSearchbar, { self: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // Not in the constructor itself: a searchbar that is the first node of a
    // sheet body is not in the document yet, and `closest()` would miss the modal.
    afterNextRender(() => this._arm());
  }

  private _arm(): void {
    const modal = this._elementRef.nativeElement.closest('ion-modal');
    if (!modal || modal.classList.contains(SHEET_PRESENTED_CLASS)) {
      this._focus();
      return;
    }
    const onPresent = () => this._focus();
    modal.addEventListener('ionModalDidPresent', onPresent, { once: true });
    this._destroyRef.onDestroy(() => modal.removeEventListener('ionModalDidPresent', onPresent));
  }

  private _focus(): void {
    void this._searchbar.getInputElement().then((input) => input.focus());
  }
}
