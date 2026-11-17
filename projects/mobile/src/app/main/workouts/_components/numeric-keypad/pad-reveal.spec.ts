import type { IonContent } from '@ionic/angular/standalone';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenSpan, revealAbovePad, revealDelta, visibleSpan } from './pad-reveal';

/** An element whose box on screen is `span` (jsdom lays nothing out). */
function boxed(element: HTMLElement, span: ScreenSpan): HTMLElement {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    ...span,
    height: span.bottom - span.top,
  } as DOMRect);
  return element;
}

/**
 * A page as the logger and the builder draw it on an 844px phone: a header
 * down to 100, the list's scroller over the whole height behind it, and the
 * pad from 490 when `pad` is set.
 */
function page(pad = true): { host: HTMLElement; scroller: HTMLElement } {
  const host = document.createElement('div');
  host.append(boxed(document.createElement('ion-header'), { top: 0, bottom: 100 }));
  const scroller = boxed(document.createElement('div'), { top: 0, bottom: 844 });
  host.append(scroller);
  if (pad) host.append(boxed(document.createElement('ion-footer'), { top: 490, bottom: 844 }));
  return { host, scroller };
}

afterEach(() => vi.restoreAllMocks());

describe('visibleSpan', () => {
  it('is the list between the header and the pad', () => {
    const { host, scroller } = page();

    expect(visibleSpan(host, scroller)).toEqual({ top: 100, bottom: 490 });
  });

  it('runs to the scroller’s end with no pad, and with a footer that has no height', () => {
    const { host, scroller } = page(false);
    expect(visibleSpan(host, scroller)).toEqual({ top: 100, bottom: 844 });

    host.append(boxed(document.createElement('ion-footer'), { top: 844, bottom: 844 }));
    expect(visibleSpan(host, scroller)).toEqual({ top: 100, bottom: 844 });
  });

  it('reads the page’s own bars, never a sheet’s further down', () => {
    const { host, scroller } = page(false);
    const sheet = document.createElement('div');
    sheet.append(boxed(document.createElement('ion-footer'), { top: 300, bottom: 400 }));
    host.append(sheet);

    expect(visibleSpan(host, scroller).bottom).toBe(844);
  });
});

describe('revealDelta', () => {
  const visible: ScreenSpan = { top: 100, bottom: 490 };

  it('leaves a row that already shows where it is', () => {
    expect(revealDelta({ top: 200, bottom: 244 }, visible)).toBe(0);
  });

  it('brings a row under the pad up, with air above the pad', () => {
    expect(revealDelta({ top: 675, bottom: 719 }, visible)).toBe(719 - (490 - 16));
    // Just touching the pad counts as under it.
    expect(revealDelta({ top: 440, bottom: 480 }, visible)).toBe(480 - (490 - 16));
  });

  it('brings a row under the header down, with air below it', () => {
    expect(revealDelta({ top: 60, bottom: 104 }, visible)).toBe(60 - (100 + 8));
  });

  it('keeps the top of a row taller than the room left in view', () => {
    expect(revealDelta({ top: 300, bottom: 800 }, visible)).toBe(300 - (100 + 8));
  });
});

describe('revealAbovePad', () => {
  function content(): IonContent & { scrollByPoint: ReturnType<typeof vi.fn> } {
    const { scroller } = page();
    return {
      getScrollElement: vi.fn().mockResolvedValue(scroller),
      scrollByPoint: vi.fn().mockResolvedValue(undefined),
    } as unknown as IonContent & { scrollByPoint: ReturnType<typeof vi.fn> };
  }

  it('scrolls a row the pad covers up above it, marking the scroll first', async () => {
    const list = content();
    const { host } = page();
    const row = boxed(document.createElement('div'), { top: 675, bottom: 719 });
    const marked = vi.fn();

    await revealAbovePad(list, host, row, 0, marked);

    expect(list.scrollByPoint).toHaveBeenCalledWith(0, 719 - (490 - 16), 0);
    expect(marked).toHaveBeenCalledTimes(1);
  });

  it('does not move the list, or mark a scroll, for a row that shows', async () => {
    const list = content();
    const { host } = page();
    const row = boxed(document.createElement('div'), { top: 200, bottom: 244 });
    const marked = vi.fn();

    await revealAbovePad(list, host, row, 200, marked);

    expect(list.scrollByPoint).not.toHaveBeenCalled();
    expect(marked).not.toHaveBeenCalled();
  });
});
