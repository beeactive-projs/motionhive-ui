import { describe, expect, it } from 'vitest';

import {
  KEYBOARD_REVEAL_GAP_PX,
  keyboardLift,
  revealDistance,
  scrollTopWithoutRoom,
} from './keyboard.config';

describe('keyboardLift', () => {
  it('raises the bar by the keyboard less the clearance it covers', () => {
    expect(keyboardLift(336, 34)).toBe(302);
    expect(keyboardLift(336, 0)).toBe(336);
    expect(keyboardLift(290.6, 0)).toBe(291);
  });

  it('never goes below the page', () => {
    expect(keyboardLift(0, 34)).toBe(0);
  });
});

describe('revealDistance', () => {
  const geometry = { blockBottom: 650, fieldTop: 600, visibleTop: 100, barTop: 450 };

  it('scrolls the block clear of the bar, with the gap', () => {
    expect(revealDistance(geometry)).toBe(650 + KEYBOARD_REVEAL_GAP_PX - 450);
  });

  it('does nothing when the block already shows', () => {
    expect(revealDistance({ ...geometry, blockBottom: 400, fieldTop: 350 })).toBe(0);
    // Right on the gap counts as showing.
    expect(revealDistance({ ...geometry, blockBottom: 438, fieldTop: 380 })).toBe(0);
  });

  it('keeps a tall block’s field under the header, never behind it', () => {
    // The chips run far below; the field may only go up to the header's foot.
    const tall = { blockBottom: 900, fieldTop: 300, visibleTop: 100, barTop: 450 };
    expect(revealDistance(tall)).toBe(300 - (100 + KEYBOARD_REVEAL_GAP_PX));
  });

  it('never scrolls the other way', () => {
    expect(revealDistance({ blockBottom: 200, fieldTop: 50, visibleTop: 100, barTop: 450 })).toBe(0);
  });
});

describe('scrollTopWithoutRoom', () => {
  it('keeps the place when the room was not in view', () => {
    expect(scrollTopWithoutRoom(100, 2000, 800, 300)).toBe(100);
  });

  it('comes back to the content’s end when the view was in the room', () => {
    expect(scrollTopWithoutRoom(1150, 2000, 800, 300)).toBe(900);
    expect(scrollTopWithoutRoom(50, 900, 800, 300)).toBe(0);
  });
});
