import { DestroyRef, Directive, ElementRef, afterNextRender, inject, signal } from '@angular/core';

import {
  KEYBOARD_HEIGHT_GUESS_PX,
  keyboardLift,
  revealDistance,
  scrollTopWithoutRoom,
} from '../config/keyboard.config';
import {
  FOLLOWS_KEYBOARD,
  KEYBOARD_ANIMATION_MS,
  KEYBOARD_TRANSITION,
  dismissKeyboard,
  focusedTextEntry,
  holdKeyboardResize,
  isTextEntry,
  releaseKeyboardResize,
} from '../utils/keyboard';

/** On the footer while the keyboard is up: the bar keeps only its buttons (layout.css, ion-footer.css). */
export const KEYBOARD_OPEN_CLASS = 'mh-keyboard-open';

/**
 * Marks what should show while a field inside it is typed in: a field with
 * its chips, a search with its results. Without one, the field's own row.
 */
export const KEYBOARD_BLOCK_ATTR = 'data-mh-keyboard-block';

/** Marks a control a tap on which keeps the keyboard up: an Add button, a chip's remove. */
export const KEEPS_KEYBOARD_ATTR = 'data-mh-keeps-keyboard';

/** Movement under which a touch on the content is a tap, not a drag. */
const TAP_SLOP_PX = 10;

/** How far the finger drags the content before the keyboard closes. */
const DRAG_DISMISS_PX = 24;

/** Ionic's own wait after a blur, in case focus is only moving to the next field. */
const BLUR_SETTLE_MS = 120;

/** The Ionic hosts of a text field: a tap on one is a tap on the field. */
const FIELD_HOSTS = 'ion-input, ion-textarea, ion-searchbar';

/** The window event the Keyboard plugin fires on both platforms, with the keyboard's height. */
type NativeKeyboardEvent = Event & { keyboardHeight?: number };

/** The last keyboard's height, the best guess for the next one. */
let lastKeyboardHeight: number | null = null;

/**
 * A form page's footer that behaves with the keyboard the way the chat's
 * send bar does: `<ion-footer mhKeyboardFooter>`.
 *
 * - **iOS** holds the plugin's late body resize off while the page is shown
 *   (`holdKeyboardResize`), lifts the bar onto the keyboard on
 *   `keyboardWillShow` / `keyboardWillHide` on the keyboard's own curve,
 *   gives the content that much room at the bottom (`--keyboard-offset`,
 *   ion-content's own property) and scrolls the focused field above the
 *   raised bar. The field is placed as it gains focus, on a guess at the
 *   keyboard, so Ionic's scroll assist finds it in place and leaves it (its
 *   own guess parks it behind the bar); the real height finishes the job as
 *   the keyboard rises. What belongs to the field (its chips, its results)
 *   is kept in view with it: mark the block `data-mh-keyboard-block`.
 * - **Both platforms** keep the bar compact while the keyboard is up (the
 *   `mh-keyboard-open` class; the stepped form's dots and quiet Skip step
 *   aside, layout.css), and close the keyboard on a tap outside a field, on
 *   a drag of the content, and when the page is left. A control that must
 *   keep it up carries `data-mh-keeps-keyboard`. Pages call `dismiss()`
 *   before a footer or header button acts.
 * - **Android** resizes its window itself, so nothing is lifted there.
 *
 * Every native call is caught: there is no Keyboard plugin on the web build,
 * and the keyboard events simply never come.
 */
@Directive({
  selector: 'ion-footer[mhKeyboardFooter]',
  exportAs: 'mhKeyboardFooter',
})
export class KeyboardFooterDirective {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  /** The keyboard is up, or on its way. */
  readonly open = signal(false);

  private _page: HTMLElement | null = null;
  private _content: HTMLIonContentElement | null = null;
  private _scroller: HTMLElement | null = null;
  private readonly _cleanups: (() => void)[] = [];
  private _holding = false;
  /** iOS: how far the bar is lifted. */
  private _lift = 0;
  /** iOS: the room added under the content. */
  private _room = 0;
  private _roomTimer: ReturnType<typeof setTimeout> | undefined;
  private _blurTimer: ReturnType<typeof setTimeout> | undefined;
  private _blockObserver: ResizeObserver | null = null;
  private _watchedBlock: Element | null = null;

  constructor() {
    // The page and its content are in the document only once rendered.
    afterNextRender(() => this._arm());
    this._destroyRef.onDestroy(() => this._disarm());
  }

  /** Close the keyboard if a field has it; a call that finds none does nothing. */
  dismiss(): void {
    const field = focusedTextEntry();
    if (field) {
      void dismissKeyboard(field);
    }
  }

  // ─── Wiring ───────────────────────────────────────────────────────────

  private _arm(): void {
    const footer = this._elementRef.nativeElement;
    this._page = footer.closest<HTMLElement>('.ion-page');
    let scope: HTMLElement | null = this._page;
    if (!scope) {
      scope = footer.parentElement;
    }
    if (scope) {
      this._content = scope.querySelector<HTMLIonContentElement>(':scope > ion-content');
    }

    this._listen(window, 'keyboardWillShow', (event) => this._onWillShow(event));
    this._listen(window, 'keyboardWillHide', () => this._onWillHide());

    const page = this._page;
    if (page) {
      this._listen(page, 'ionViewWillEnter', () => this._hold());
      // Leaving with the keyboard up would carry it onto the next screen.
      this._listen(page, 'ionViewWillLeave', () => this.dismiss());
      // On did-leave, not will-leave: a swipe back let go halfway is
      // cancelled with no event to say so (the chat's lesson).
      this._listen(page, 'ionViewDidLeave', () => this._release());
    }
    // Rendered on a page already in view (a footer that waits for data).
    if (this._isShown()) {
      this._hold();
    }

    const content = this._content;
    if (!content) {
      return;
    }
    void content.getScrollElement().then((scroller) => {
      this._scroller = scroller;
    });
    this._watchTouches(content);
    if (FOLLOWS_KEYBOARD) {
      // Capture: before Ionic's scroll assist, which listens on the field.
      this._listen(content, 'focusin', (event) => this._onFocusIn(event), { capture: true });
      this._listen(content, 'focusout', () => this._onFocusOut());
    }
  }

  private _disarm(): void {
    for (const cleanup of this._cleanups) {
      cleanup();
    }
    clearTimeout(this._roomTimer);
    clearTimeout(this._blurTimer);
    if (this._blockObserver) {
      this._blockObserver.disconnect();
    }
    this._release();
  }

  private _listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this._cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  /** iOS: no plugin resize while this page is on screen. */
  private _hold(): void {
    if (!FOLLOWS_KEYBOARD || this._holding) {
      return;
    }
    this._holding = true;
    void holdKeyboardResize();
  }

  private _release(): void {
    if (!this._holding) {
      return;
    }
    this._holding = false;
    void releaseKeyboardResize();
    // Off screen now: put the bar back where the page will find it.
    this._setOpen(false);
    this._placeBar(0, false);
    this._setRoom(0);
  }

  /** A page left in the stack behind hears the keyboard too, and must not move. */
  private _isShown(): boolean {
    if (!this._page) {
      return true;
    }
    return !this._page.classList.contains('ion-page-hidden');
  }

  // ─── The keyboard ─────────────────────────────────────────────────────

  private _onWillShow(event: Event): void {
    if (!this._isShown()) {
      return;
    }
    const height = (event as NativeKeyboardEvent).keyboardHeight;
    // A height of 0 is the iPad's floating suggestion bar: nothing is covered.
    if (typeof height === 'number' && height <= 0) {
      return;
    }
    this._setOpen(true);
    if (!FOLLOWS_KEYBOARD || typeof height !== 'number') {
      return;
    }
    lastKeyboardHeight = height;
    this._raise(keyboardLift(height, this._clearance()));
    this._reveal(true);
  }

  private _onWillHide(): void {
    if (!this.open()) {
      return;
    }
    this._setOpen(false);
    if (FOLLOWS_KEYBOARD) {
      this._raise(0);
    }
  }

  private _setOpen(open: boolean): void {
    // Set on the element at once, not through a binding a frame later: the
    // lift and the reveal measure the compact bar in this same step.
    this._elementRef.nativeElement.classList.toggle(KEYBOARD_OPEN_CLASS, open);
    this.open.set(open);
  }

  /** The bar's own foot clearance, which the keyboard covers: the lift leaves it out. */
  private _clearance(): number {
    const toolbar = this._elementRef.nativeElement.querySelector('ion-toolbar:last-of-type');
    if (!toolbar) {
      return 0;
    }
    const padding = parseFloat(getComputedStyle(toolbar).paddingBottom);
    if (Number.isNaN(padding)) {
      return 0;
    }
    return padding;
  }

  /**
   * iOS: move the bar to `lift` with the keyboard. Going up, the room comes
   * first so the field can scroll above the bar. Going down, the content
   * glides back with the bar out of the room, and the room goes once both
   * have landed, so nothing jumps. A smaller keyboard while up (the
   * suggestion bar hidden) keeps the room: extra room costs nothing, and
   * taking it away would jump a field that was scrolled into it.
   */
  private _raise(lift: number): void {
    clearTimeout(this._roomTimer);
    this._roomTimer = undefined;
    this._placeBar(lift, true);
    if (lift >= this._room) {
      this._setRoom(lift);
      return;
    }
    if (lift > 0) {
      return;
    }
    this._settleScroll(true);
    this._roomTimer = setTimeout(() => {
      this._roomTimer = undefined;
      this._setRoom(0);
    }, KEYBOARD_ANIMATION_MS);
  }

  /** Placed directly rather than through a binding, which would land a frame late. */
  private _placeBar(lift: number, animate: boolean): void {
    if (lift === this._lift) {
      return;
    }
    this._lift = lift;
    const footer = this._elementRef.nativeElement;
    if (animate) {
      footer.style.transition = KEYBOARD_TRANSITION;
    } else {
      footer.style.removeProperty('transition');
    }
    if (lift) {
      footer.style.transform = `translate3d(0, ${-lift}px, 0)`;
    } else {
      footer.style.removeProperty('transform');
    }
  }

  private _setRoom(px: number): void {
    this._room = px;
    const content = this._content;
    if (!content) {
      return;
    }
    if (px) {
      content.style.setProperty('--keyboard-offset', `${px}px`);
    } else {
      content.style.removeProperty('--keyboard-offset');
    }
  }

  /** Bring the scroll out of the room before the room is taken away. */
  private _settleScroll(animate: boolean): void {
    const content = this._content;
    const scroller = this._scroller;
    if (!content || !scroller || !this._room) {
      return;
    }
    const top = scrollTopWithoutRoom(
      scroller.scrollTop,
      scroller.scrollHeight,
      scroller.clientHeight,
      this._room,
    );
    if (top >= scroller.scrollTop) {
      return;
    }
    if (animate) {
      void content.scrollToPoint(undefined, top, KEYBOARD_ANIMATION_MS);
    } else {
      scroller.scrollTop = top;
    }
  }

  // ─── The field in view ────────────────────────────────────────────────

  /** iOS: scroll the focused field (and its block) above the raised bar. */
  private _reveal(animate: boolean): void {
    const content = this._content;
    const scroller = this._scroller;
    const field = focusedTextEntry();
    if (!content || !scroller || !field || !content.contains(field)) {
      return;
    }
    const distance = this._distanceFor(field, this._lift, this._elementRef.nativeElement.offsetTop);
    if (distance === 0) {
      return;
    }
    if (animate) {
      void content.scrollByPoint(0, distance, KEYBOARD_ANIMATION_MS);
    } else {
      scroller.scrollTop += distance;
    }
  }

  /** How far the content must scroll for `field` to clear a bar at `barOffsetTop`, raised by `lift`. */
  private _distanceFor(field: HTMLElement, lift: number, barOffsetTop: number): number {
    const content = this._content;
    if (!content) {
      return 0;
    }
    const footer = this._elementRef.nativeElement;
    let parentTop = 0;
    if (footer.offsetParent) {
      parentTop = footer.offsetParent.getBoundingClientRect().top;
    }
    let visibleTop = content.getBoundingClientRect().top;
    if (this._page) {
      const header = this._page.querySelector(':scope > ion-header');
      if (header) {
        visibleTop = header.getBoundingClientRect().bottom;
      }
    }
    let row: Element = field;
    const host = field.closest('ion-item, ion-searchbar');
    if (host) {
      row = host;
    }
    return revealDistance({
      blockBottom: this._blockOf(field).getBoundingClientRect().bottom,
      fieldTop: row.getBoundingClientRect().top,
      visibleTop,
      barTop: parentTop + barOffsetTop - lift,
    });
  }

  private _blockOf(field: HTMLElement): Element {
    const block = field.closest(`[${KEYBOARD_BLOCK_ATTR}]`);
    if (block && this._content && this._content.contains(block)) {
      return block;
    }
    const row = field.closest('ion-item, ion-searchbar');
    if (row) {
      return row;
    }
    return field;
  }

  /**
   * iOS, as a field gains focus. With the keyboard already up the bar is
   * where it will stay, so the field is placed exactly. Before it, the field
   * is placed for a bar raised by the last keyboard (or a guess) and the
   * compact bar, measured by putting the class on and off in one step (no
   * frame is drawn in between). Done at once rather than animated: Ionic's
   * scroll assist measures the field right after this, and a field already
   * in view is one it leaves alone.
   */
  private _onFocusIn(event: Event): void {
    const field = event.target;
    if (!isTextEntry(field) || !this._isShown()) {
      return;
    }
    clearTimeout(this._blurTimer);
    this._watchBlock(field);
    if (this.open()) {
      this._reveal(false);
      return;
    }
    const scroller = this._scroller;
    if (!scroller) {
      return;
    }
    const footer = this._elementRef.nativeElement;
    footer.classList.add(KEYBOARD_OPEN_CLASS);
    const clearance = this._clearance();
    const barOffsetTop = footer.offsetTop;
    footer.classList.remove(KEYBOARD_OPEN_CLASS);

    let height = KEYBOARD_HEIGHT_GUESS_PX;
    if (lastKeyboardHeight !== null) {
      height = lastKeyboardHeight;
    }
    const lift = keyboardLift(height, clearance);
    const distance = this._distanceFor(field, lift, barOffsetTop);
    if (distance === 0) {
      return;
    }
    this._setRoom(Math.max(this._room, lift));
    scroller.scrollTop += distance;
  }

  /** A field let go with no keyboard having come (a hardware keyboard): the room goes. */
  private _onFocusOut(): void {
    clearTimeout(this._blurTimer);
    this._blurTimer = setTimeout(() => {
      if (focusedTextEntry()) {
        return;
      }
      this._unwatchBlock();
      if (this.open() || this._lift > 0 || this._roomTimer !== undefined || this._room === 0) {
        return;
      }
      this._settleScroll(false);
      this._setRoom(0);
    }, BLUR_SETTLE_MS);
  }

  /** A block that grows while typed in (a chip added, results in) is kept in view. */
  private _watchBlock(field: HTMLElement): void {
    const block = this._blockOf(field);
    if (block === this._watchedBlock || typeof ResizeObserver === 'undefined') {
      return;
    }
    this._unwatchBlock();
    if (!this._blockObserver) {
      this._blockObserver = new ResizeObserver(() => {
        if (this.open()) {
          this._reveal(true);
        }
      });
    }
    this._blockObserver.observe(block);
    this._watchedBlock = block;
  }

  private _unwatchBlock(): void {
    if (this._blockObserver && this._watchedBlock) {
      this._blockObserver.unobserve(this._watchedBlock);
    }
    this._watchedBlock = null;
  }

  // ─── Closing it ───────────────────────────────────────────────────────

  /**
   * A tap outside a field, or a drag of the content either way, closes the
   * keyboard, as `keyboardDismissMode = .onDrag` does in an iOS form. A drag
   * that starts on a field is left alone (it may be moving the caret), and
   * our own scrolling is never a touch. Passive, so scrolling never waits on
   * these handlers, and a tapped tile still gets its click.
   */
  private _watchTouches(content: HTMLElement): void {
    let start: { x: number; y: number; moved: boolean; done: boolean; onField: boolean } | null =
      null;

    const onStart = (event: Event): void => {
      const touch = (event as TouchEvent).touches[0];
      if (!touch) {
        start = null;
        return;
      }
      start = {
        x: touch.clientX,
        y: touch.clientY,
        moved: false,
        done: false,
        onField: this._keepsKeyboard(event.target),
      };
    };

    const onMove = (event: Event): void => {
      const touch = (event as TouchEvent).touches[0];
      if (!start || !touch) {
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) {
        start.moved = true;
      }
      if (!start.done && !start.onField && Math.abs(dy) > DRAG_DISMISS_PX) {
        start.done = true;
        this.dismiss();
      }
    };

    const onEnd = (event: Event): void => {
      if (start && !start.moved && !this._keepsKeyboard(event.target)) {
        this.dismiss();
      }
      start = null;
    };

    const options: AddEventListenerOptions = { passive: true };
    this._listen(content, 'touchstart', onStart, options);
    this._listen(content, 'touchmove', onMove, options);
    this._listen(content, 'touchend', onEnd, options);
  }

  /** A field, a row holding one, or a control marked to keep the keyboard. */
  private _keepsKeyboard(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    if (isTextEntry(target) || target.closest(`${FIELD_HOSTS}, [${KEEPS_KEYBOARD_ATTR}]`)) {
      return true;
    }
    const row = target.closest('ion-item');
    if (!row) {
      return false;
    }
    return row.querySelector(FIELD_HOSTS) !== null;
  }
}
