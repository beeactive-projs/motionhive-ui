import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input, model, output, viewChild } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';

/**
 * The bottom sheet the account area edits in: grabber, centred title, close
 * button, projected body, and a Cancel / Save footer.
 *
 * Nine sheets share this chrome. Each supplies only its own fields and keeps
 * its own `open` binding, so the parent stays in charge of when it shows.
 *
 * The body arrives as a `TemplateRef`, not through `<ng-content>`. Ionic
 * relocates the modal element when it presents, so anything not captured in an
 * `<ng-template>` is left behind — projecting content directly into `ion-modal`
 * renders a sheet with an empty title and an empty body, which is exactly what
 * it did before this. Everything inside the `<ng-template>` below binds against
 * this component; the outlet's template binds against the consumer's, so each
 * sheet keeps its own fields in its own context:
 *
 *     <ng-template #body>…fields…</ng-template>
 *     <mh-sheet-shell [(open)]="open" title="Name" [body]="body" (save)="save()" />
 */
@Component({
  selector: 'mh-sheet-shell',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
    NgTemplateOutlet,
  ],
  templateUrl: './sheet-shell.html',
  styleUrl: './sheet-shell.scss',
})
export class SheetShell {
  readonly open = model(false);
  readonly title = input.required<string>();
  /** The sheet's fields, declared by the consumer as `<ng-template #body>`. */
  readonly body = input.required<TemplateRef<unknown>>();
  readonly saveLabel = input('Save');
  readonly canSave = input(true);
  readonly saving = input(false);
  /** Off for the sheets that are a list of actions rather than a form. */
  readonly showFooter = input(true);
  readonly breakpoints = input<readonly number[]>([0, 0.6, 0.95]);
  readonly initialBreakpoint = input(0.6);

  readonly save = output<void>();

  private readonly _modal = viewChild(IonModal);

  constructor() {
    addIcons({ close });
  }

  dismiss(): void {
    this.open.set(false);
  }

  /**
   * Close and await the dismissal, for callers that navigate in the same turn.
   * `dismiss()` only flips the signal, and a leaving page never gets the change
   * detection pass that applies `[isOpen]` — the modal would stay presented
   * over the new route.
   */
  async close(): Promise<void> {
    this.open.set(false);
    await this._modal()?.dismiss();
  }
}
