import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';

/**
 * Put on the `ion-modal` once its enter animation has finished, and taken off
 * again on dismiss. Ionic's own `presented` flag flips before the animation
 * starts, so it cannot answer "is it safe to pop the keyboard yet" —
 * `mhAutofocus` reads this class instead.
 */
export const SHEET_PRESENTED_CLASS = 'mh-presented';

/** Put on the `ion-modal` of a `fit` sheet; the auto-height rules in ion-modal.css key off it. */
const SHEET_FIT_CLASS = 'mh-sheet-fit';

/** A fit sheet has one open stop: all of it. Its height is its content's. */
const FIT_BREAKPOINTS: readonly number[] = [0, 1];

/**
 * Ionic's dismiss roles for a person closing the sheet themselves: `gesture`
 * is the swipe down, `backdrop` covers the scrim tap, Escape and Android back.
 * Code closing the sheet dismisses with no role.
 */
const USER_DISMISS_ROLES: readonly (string | undefined)[] = ['gesture', 'backdrop'];

const HandleBehaviors = { Cycle: 'cycle', None: 'none' } as const;

/**
 * The bottom sheet every mobile overlay is built on: grabber, a fixed header
 * (title, optional subtitle, close button), projected body, and a Cancel /
 * Save footer within thumb reach.
 *
 * The header is deliberately not customisable, so every sheet reads the same.
 * Swipe down, a scrim tap, Android back and the close button all dismiss; the
 * close button is also the one a screen reader can reach. The scrim stays on
 * at every snap point, so the page behind keeps its place but cannot scroll
 * or take taps.
 *
 * Each sheet supplies only its own fields and keeps its own `open` binding, so
 * the parent stays in charge of when it shows.
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
    TranslatePipe,
  ],
  templateUrl: './sheet-shell.html',
  styleUrl: './sheet-shell.scss',
})
export class SheetShell {
  readonly open = model(false);
  readonly title = input.required<string>();
  /**
   * Optional line under the title, in smaller plain text: "One-off · Thu 21
   * May", a client's email. Title, subtitle and the close button are the
   * whole header, the same on every sheet; anything richer belongs in the body.
   */
  readonly subtitle = input('');
  /**
   * Size the sheet to its content instead of to snap points: Ionic's
   * auto-height sheet. For short, fixed bodies like an action list, where a
   * fraction of the screen is either too much (empty sheet) or too little
   * (clipped rows) depending on the phone. The body is not an `ion-content`
   * here, it scrolls itself past most of the screen's height, and
   * `breakpoints` is ignored.
   */
  readonly fit = input(false);
  /** The sheet's fields, declared by the consumer as `<ng-template #body>`. */
  readonly body = input.required<TemplateRef<unknown>>();
  /**
   * Optional strip pinned between the header and the scrolling body — a
   * search bar or a filter row. Anything inside `body` scrolls away; a
   * search that scrolls away is a search you have to scroll back up to use.
   */
  readonly sticky = input<TemplateRef<unknown> | null>(null);
  /** Translated text; empty falls back to "Save". */
  readonly saveLabel = input('');
  /** Ionic palette name for the confirm button — `danger` for destructive sheets. */
  readonly saveColor = input('primary');
  /**
   * Translated label on the footer's dismiss button; empty falls back to
   * "Cancel". Override it where "Cancel" would sit next to a destructive
   * confirm that also says cancel — the cancel-session sheet reads
   * "Keep / Cancel session" instead of "Cancel / Cancel session".
   */
  readonly dismissLabel = input('');
  readonly canSave = input(true);
  readonly saving = input(false);
  /** Off for the sheets that are a list of actions rather than a form. */
  readonly showFooter = input(true);
  /**
   * Paint the body on the sheet's own surface instead of the page slate.
   *
   * `ion-content` defaults to `--ion-background-color`, which is why a form
   * sheet's fields read as cards floating on a page. A sheet that is nothing
   * but rows has no cards to float, so the slate turns into a gutter framing
   * white rows — one continuous surface is what those want instead.
   */
  readonly flushBody = input(false);
  /**
   * Snap points as fractions of the screen. Keep the `0`: it is what lets a
   * swipe down dismiss. Two or more open stops (half-open and tall) make the
   * grabber a button that steps between them, so resizing never needs a drag.
   *
   * Opening at 0.75 or lower? Add a `0.95` stop when the body holds a text
   * field (the keyboard eats the half-open height), a list that can grow, or
   * copy of unknown length. Short fixed action menus keep a single stop:
   * pulling them up would only reveal empty sheet.
   */
  readonly breakpoints = input<readonly number[]>([0, 0.6, 0.95]);
  readonly initialBreakpoint = input(0.6);
  /**
   * A second footer action that takes Cancel's place — the filter sheets'
   * "Reset". It sits beside the confirm, in thumb reach, rather than in the
   * header's top corner; swipe, scrim and back still close the sheet. Needs
   * the footer: ignored when `showFooter` is off.
   */
  readonly actionLabel = input('');
  readonly actionDisabled = input(false);

  readonly save = output<void>();
  /**
   * Fires once the modal is actually gone. Anything that navigates after a
   * choice must wait for this rather than for `open` flipping false — Ionic
   * is still animating the dismissal then, and tearing down the page under
   * it leaves the sheet orphaned on screen.
   */
  readonly dismissed = output<void>();
  readonly action = output<void>();

  /**
   * True from the end of the enter animation to dismissal. Mirrored onto the
   * modal element as a class so `mhAutofocus` can tell an already-open sheet
   * from one still sliding in.
   */
  readonly presented = signal(false);

  readonly snapPoints = computed(() => (this.fit() ? FIT_BREAKPOINTS : this.breakpoints()));
  readonly startPoint = computed(() => (this.fit() ? 1 : this.initialBreakpoint()));
  readonly modalClass = computed(() =>
    [this.presented() ? SHEET_PRESENTED_CLASS : '', this.fit() ? SHEET_FIT_CLASS : ''].filter(Boolean).join(' '),
  );

  /**
   * Tapping the grabber steps through the open snap points: the single
   * pointer alternative to dragging (WCAG 2.5.7). With one open stop there is
   * nothing to step to, so the grabber stays a drag affordance only.
   */
  readonly handleBehavior = computed(() =>
    this.snapPoints().filter((stop) => stop > 0).length > 1 ? HandleBehaviors.Cycle : HandleBehaviors.None,
  );

  /**
   * While a save is in flight the person cannot swipe, tap the scrim or press
   * back to close — the request would finish behind a sheet they think they
   * cancelled. Code can still close it. Outside a save this stays a plain
   * `true`: any other value makes Ionic resist every swipe down, not just
   * the ones it will refuse.
   */
  readonly canDismiss = computed(() => (this.saving() ? this._refuseUserDismiss : true));

  private readonly _translateService = inject(TranslateService);
  private readonly _modal = viewChild(IonModal);
  private readonly _modalElement = viewChild(IonModal, { read: ElementRef });

  private readonly _refuseUserDismiss = async (_data?: unknown, role?: string): Promise<boolean> =>
    !USER_DISMISS_ROLES.includes(role);

  constructor() {
    addIcons({ close });
    // A title that resolves after the sheet is already in the DOM — every
    // `computed()` one here does — has to be pushed onto the dialog by hand.
    effect(() => {
      this.title();
      if (this.presented()) this.syncDialogLabel();
    });
  }

  /**
   * Re-apply the dialog's accessible name.
   *
   * Ionic copies the host `aria-label` onto the shadow `.modal-wrapper` — the
   * element that actually carries `role="dialog"` — once, in
   * `componentWillLoad`, into a plain instance field that never re-renders.
   * Every title here is a `computed()` that fills in when a row is chosen, so
   * the name froze at whatever it was when the page first rendered: a sheet
   * reading "Archive Anna Popescu?" announced "Archive this client?", and on
   * a destructive confirmation that is a hazard, not a blemish.
   *
   * `aria-labelledby` is not a way out — an IDREF cannot cross the shadow
   * boundary to reach the heading, which is slotted light DOM — so the label
   * is written onto the wrapper directly, before the sheet is announced.
   */
  syncDialogLabel(): void {
    this._shadowElement('.modal-wrapper')?.setAttribute('aria-label', this.title());
  }

  /**
   * Run before the sheet is announced: the dialog's name, plus the grabber's.
   *
   * Ionic renders the grabber as a shadow `<button>` with a hard-coded English
   * label, reachable by a screen reader even when it does nothing. Where it
   * steps between snap points it gets a translated name; where it does not,
   * it is hidden so nobody lands on a button with no action.
   */
  syncShadowAria(): void {
    this.syncDialogLabel();
    const grabber = this._shadowElement('.modal-handle');
    if (!grabber) return;
    if (this.handleBehavior() === HandleBehaviors.Cycle) {
      grabber.removeAttribute('aria-hidden');
      grabber.setAttribute('aria-label', this._translateService.instant('a11y.resizeSheet'));
    } else {
      grabber.setAttribute('aria-hidden', 'true');
    }
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

  private _shadowElement(selector: string): HTMLElement | null {
    const host = this._modalElement()?.nativeElement as HTMLElement | undefined;
    return host?.shadowRoot?.querySelector<HTMLElement>(selector) ?? null;
  }
}
