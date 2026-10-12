import { FieldTree } from '@angular/forms/signals';
import { focusFirstInvalid } from 'core';

/**
 * Mobile's submission `onInvalid`: focuses the first field with an error.
 * Core's `focusFirstInvalid` focuses the bound element, but an `ion-input`
 * host can't take focus — Ionic moves it to the inner input via `setFocus()`.
 * Custom controls (`mh-password-input`) implement `focus()` and go through core.
 */
export function focusFirstInvalidIonic(form: FieldTree<unknown>): void {
  const field = form().errorSummary()[0]?.fieldTree;
  const element = field?.().formFieldBindings()[0]?.element as
    | (HTMLElement & { setFocus?: () => Promise<void> })
    | undefined;
  if (element?.setFocus) {
    void element.setFocus();
  } else {
    focusFirstInvalid(form);
  }
}
