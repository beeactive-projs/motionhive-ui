/**
 * The arithmetic behind `mhKeyboardFooter`: how far a form's bar rises with
 * the keyboard, and how far the content scrolls so the field being typed in
 * sits above that bar. Pure, so the spec can hold it still.
 */

/** Room left between what is being typed in and the bar over the keyboard. */
export const KEYBOARD_REVEAL_GAP_PX = 12;

/**
 * The keyboard's height before the first one has been seen: Ionic's own
 * guess (its `keyboardHeight` config), an iPhone keyboard without the
 * suggestion bar. A taller real one is made up for as it rises.
 */
export const KEYBOARD_HEIGHT_GUESS_PX = 290;

/**
 * How far the bar rises: the keyboard less the clearance the bar keeps at its
 * foot, which the keyboard covers. Never below the page.
 */
export function keyboardLift(keyboardHeight: number, clearance: number): number {
  return Math.max(0, Math.round(keyboardHeight - clearance));
}

/** Where things are on screen, in viewport pixels. */
export interface RevealGeometry {
  /** The foot of what should show: the field and what belongs to it (its chips, its results). */
  blockBottom: number;
  /** The top of the field itself, which must stay in view. */
  fieldTop: number;
  /** Where the content stops being covered at the top (the header's foot). */
  visibleTop: number;
  /** Where the bar over the keyboard starts, once it has risen. */
  barTop: number;
}

/**
 * How far to scroll down so the block clears the bar, with a gap; never so
 * far that the field goes under the header. A tall block shows its field and
 * as much of the rest as fits. 0 when it already shows.
 */
export function revealDistance(geometry: RevealGeometry, gap = KEYBOARD_REVEAL_GAP_PX): number {
  const needed = geometry.blockBottom + gap - geometry.barTop;
  const room = geometry.fieldTop - (geometry.visibleTop + gap);
  const distance = Math.min(needed, room);
  if (distance < 1) {
    return 0;
  }
  return Math.round(distance);
}

/**
 * Where the scroll can stay once `room` is taken off the bottom again: the
 * same place, or the new end of the content when it was in the room.
 */
export function scrollTopWithoutRoom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  room: number,
): number {
  const end = Math.max(0, scrollHeight - room - clientHeight);
  return Math.min(scrollTop, end);
}
