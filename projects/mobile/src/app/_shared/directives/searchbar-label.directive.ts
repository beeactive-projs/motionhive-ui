import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { IonSearchbar } from '@ionic/angular/standalone';

/**
 * Gives an `ion-searchbar`'s real input its name.
 *
 * Ionic renders the inner `<input>` with a hardcoded `aria-label="search text"`
 * and copies only `lang` and `dir` from the host, so the label a template puts
 * on `<ion-searchbar>` never reaches the field: every search field in the app
 * was announced as "search text", in English even in Romanian. This copies the
 * host's `aria-label`, or the placeholder when there is none, onto the input
 * once Stencil has rendered it, and again whenever the host's label changes.
 * Stencil never writes its own value back: the attribute is the same on every
 * render, so its diff leaves the DOM alone.
 *
 * The selector is the bare element, so a component only has to import this.
 */
@Directive({ selector: 'ion-searchbar' })
export class SearchbarLabelDirective {
  private readonly _searchbar = inject(IonSearchbar, { self: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _observer = new MutationObserver(() => this._sync());
  private _input: HTMLInputElement | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => this._observer.disconnect());
    afterNextRender(() => {
      void this._searchbar.getInputElement().then((input) => {
        this._input = input;
        this._sync();
        this._observer.observe(this._elementRef.nativeElement, {
          attributeFilter: ['aria-label'],
        });
      });
    });
  }

  private _sync(): void {
    const host = this._elementRef.nativeElement;
    const label = host.getAttribute('aria-label') || this._searchbar.placeholder;
    if (this._input && label) this._input.setAttribute('aria-label', label);
  }
}
