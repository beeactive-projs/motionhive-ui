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
    IonToolbar,
    NgTemplateOutlet,
  ],
  templateUrl: './sheet-shell.html',
  styleUrl: './sheet-shell.scss',
})
export class SheetShell {
  readonly open = model(false);
  readonly title = input.required<string>();
  /**
   * One-line summary under the title — "One-off · Thu 21 May". Setting it also
   * switches the header to the design's left-aligned form-sheet layout; empty
   * keeps the centred single-line title the simpler sheets use.
   */
  readonly subtitle = input('');
  /** The sheet's fields, declared by the consumer as `<ng-template #body>`. */
  readonly body = input.required<TemplateRef<unknown>>();
  readonly saveLabel = input('Save');
  /** Ionic palette name for the confirm button — `danger` for destructive sheets. */
  readonly saveColor = input('primary');
  /**
   * Label on the footer's dismiss button. Override it where "Cancel" would sit
   * next to a destructive confirm that also says cancel — the cancel-session
   * sheet reads "Keep / Cancel session" instead of "Cancel / Cancel session".
   */
  readonly dismissLabel = input('Cancel');
  readonly canSave = input(true);
  readonly saving = input(false);
  /** Off for the sheets that are a list of actions rather than a form. */
  readonly showFooter = input(true);
  /**
   * Off for sheets whose body already names what they are about — a title bar
   * repeating it costs a row of height and pushes the content down.
   *
   * `title` stays required either way: with the bar hidden it becomes the
   * modal's `aria-label`, so the dialog keeps an accessible name. Dismissal
   * falls back to the grabber and the backdrop, both of which Ionic provides.
   */
  readonly showHeader = input(true);
  /**
   * Paint the body on the sheet's own surface instead of the page slate.
   *
   * `ion-content` defaults to `--ion-background-color`, which is why a form
   * sheet's fields read as cards floating on a page. A sheet that is nothing
   * but rows has no cards to float, so the slate turns into a gutter framing
   * white rows — one continuous surface is what those want instead.
   */
  readonly flushBody = input(false);
  readonly breakpoints = input<readonly number[]>([0, 0.6, 0.95]);
  readonly initialBreakpoint = input(0.6);
  /**
   * Text action at the header's right edge — the filter sheet's "Reset".
   * Setting it also moves the title to the start edge, same as `subtitle`,
   * since a centred title would sit under the action.
   */
  readonly actionLabel = input('');
  readonly actionDisabled = input(false);

  readonly save = output<void>();
  readonly action = output<void>();

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
