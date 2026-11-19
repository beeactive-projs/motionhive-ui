import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

/**
 * iOS: a bar rides up with the keyboard instead of after it.
 *
 * The keyboard plugin resizes the page only once the keyboard has finished
 * rising, plus 0.2s (its `Keyboard.m`), so a bar landed on the keys about
 * half a second late. A screen that minds holds the plugin's resizing off
 * while it is shown (`holdKeyboardResize`) and lifts its bar on
 * `keyboardWillShow`, which arrives with the keyboard's height as it starts to
 * move. Android resizes the window itself, which the plugin cannot change,
 * and keeps the default behaviour. Used by the chat and `mhKeyboardFooter`.
 */
export const FOLLOWS_KEYBOARD = Capacitor.getPlatform() === 'ios';

/**
 * The iOS keyboard's animation: its duration, and a curve close to its
 * spring (Ionic's own iOS easing). Whatever moves with the keyboard moves on it.
 */
export const KEYBOARD_ANIMATION_MS = 250;
export const KEYBOARD_TRANSITION = `transform ${KEYBOARD_ANIMATION_MS}ms cubic-bezier(0.36, 0.66, 0.04, 1)`;

/**
 * Screens holding the plugin's resizing off. A count, not a flag: when one
 * screen replaces another (a notification opening a different chat), Ionic
 * tells the new screen it is entering before it tells the old one it is
 * leaving, so the old one must not turn resizing back on under the new one.
 */
let resizeHolds = 0;
let resizeBefore: KeyboardResize = KeyboardResize.Body;

export async function holdKeyboardResize(): Promise<void> {
  resizeHolds += 1;
  if (resizeHolds > 1) {
    return;
  }
  try {
    resizeBefore = (await Keyboard.getResizeMode()).mode;
    await Keyboard.setResizeMode({ mode: KeyboardResize.None });
  } catch {
    // No plugin, nothing to hold.
  }
  clearResizedBody();
}

export async function releaseKeyboardResize(): Promise<void> {
  if (resizeHolds === 0) {
    return;
  }
  resizeHolds -= 1;
  if (resizeHolds > 0) {
    return;
  }
  await Keyboard.setResizeMode({ mode: resizeBefore }).catch(() => undefined);
  clearResizedBody();
}

/**
 * Give the page back the height the plugin took for the keyboard.
 *
 * `resize: 'body'` sets `document.body`'s height to the room above the
 * keyboard and takes it off only on a keyboard hide that arrives in that
 * mode. A screen opened with the keyboard still up (a chat picked from the
 * inbox search) switches to `none` first, the hide that follows is ignored,
 * and the body stayed cut short: the composer, then the tab bar back on the
 * inbox, halfway up the screen. The plugin also believes the keyboard is
 * down by then, so no later hide in `body` mode undid it either.
 */
export function clearResizedBody(): void {
  document.body.style.removeProperty('height');
}

/** The native fields that raise a keyboard (a checkbox or a range does not). */
const TEXT_ENTRY =
  'textarea, [contenteditable="true"], input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="color"])';

/** Whether `element` is a field that raises a keyboard. */
export function isTextEntry(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return element.matches(TEXT_ENTRY);
}

/** The field holding focus, which on a phone means the keyboard is up; null when none does. */
export function focusedTextEntry(): HTMLElement | null {
  const active = document.activeElement;
  if (isTextEntry(active)) {
    return active;
  }
  return null;
}

/**
 * Close the keyboard: blur the field, and ask the native side too. There is
 * no Keyboard plugin on the web build, where the blur is enough.
 */
export async function dismissKeyboard(field: HTMLElement | null | undefined): Promise<void> {
  if (field) {
    field.blur();
  }
  await Keyboard.hide().catch(() => undefined);
}
