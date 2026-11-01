import { describe, expect, it } from 'vitest';

import { HexShapes, hexSize } from '../../../_shared/config/hexagon.config';
import { ShareCardContent, WorkoutKinds } from './share-card.config';
import {
  CARD_HEIGHT,
  CellKinds,
  DROP_ORDER,
  FontSpec,
  Paint,
  STICKER_HEIGHT,
  STICKER_WIDTH,
  ShareLayout,
  TextPaint,
  badgeLayout,
  cellsLayout,
  faceForWords,
  fitInOrder,
  fitLine,
  fitName,
  flowerCells,
  fullLayout,
  statsLine,
  wrapLines,
} from './share-layout.config';

/** A stand-in for the real faces: each character 0.55 of the size wide, Poppins 0.6. */
const measure = (text: string, font: FontSpec) =>
  Array.from(text).length * font.size * (font.family === 'Poppins' ? 0.6 : 0.55);

const RO_NAME = 'Antrenament complet pentru spate și umeri';

function content(over: Partial<ShareCardContent> = {}): ShareCardContent {
  return {
    title: 'Upper body',
    date: 'Wed 28 Oct · 18:20',
    location: 'World Class Iulius',
    duration: { value: '52', label: 'min' },
    stats: [
      { value: '9', label: 'sets' },
      { value: '4,280', label: 'kg volume' },
    ],
    record: { title: 'New record', short: 'PR', exercise: 'Bench press', best: '62.5 × 7' },
    exercises: [
      { name: 'Bench press', best: '62.5 × 7' },
      { name: 'Squat', best: '100 × 5' },
      { name: 'Barbell row', best: '60 × 8' },
    ],
    number: { line: '18th workout', value: '18th', label: 'workout' },
    streak: { line: '3 weeks in a row', value: '3', label: 'wks in a row' },
    feeling: { glyph: '🤩', label: 'Great' },
    coach: 'with Bogdan Daniel',
    link: 'app.motionhive.fit/@anna',
    week: [true, false, true, false, false, false, false],
    kind: WorkoutKinds.Strength,
    ...over,
  };
}

const NOTHING_ELSE: Partial<ShareCardContent> = {
  date: null,
  location: null,
  stats: [],
  record: null,
  exercises: [],
  number: null,
  streak: null,
  feeling: null,
  coach: null,
  link: null,
  week: null,
};

const texts = (layout: ShareLayout): TextPaint[] =>
  layout.paints.filter((paint): paint is TextPaint => paint.kind === 'text');
const said = (layout: ShareLayout) => texts(layout).map((paint) => paint.text);
const ofKind = <K extends Paint['kind']>(layout: ShareLayout, kind: K) =>
  layout.paints.filter((paint): paint is Extract<Paint, { kind: K }> => paint.kind === kind);

describe('text that fits', () => {
  // Ten units a character, so widths are easy to read off.
  const ten = (text: string) => Array.from(text).length * 10;

  it('leaves a line that fits and ellipsises one that does not, never half an emoji', () => {
    expect(fitLine('Upper A', 100, ten)).toBe('Upper A');
    expect(fitLine('Antrenament', 60, ten)).toBe('Antre…');
    expect(fitLine('🏆🏆🏆🏆', 25, ten)).toBe('🏆…');
  });

  it('wraps by words, ellipsising the last line and any word wider than a line', () => {
    expect(wrapLines('Full body day', 90, 2, ten)).toEqual(['Full body', 'day']);
    expect(wrapLines(RO_NAME, 140, 2, ten)).toEqual(['Antrenament', 'complet pentr…']);
    expect(wrapLines('Antrenament complet', 80, 2, ten)).toEqual(['Antrena…', 'complet']);
    expect(wrapLines(RO_NAME, 140, 3, ten)).toEqual([
      'Antrenament',
      'complet pentru',
      'spate și umeri',
    ]);
    expect(wrapLines('', 200, 2, ten)).toEqual([]);
  });

  it('shrinks a face until the longest word fits, never under the floor', () => {
    const at = (text: string, size: number) => Array.from(text).length * size * 0.6;
    expect(faceForWords('Upper A', 200, 42, 30, at)).toBe(42);
    expect(faceForWords('Antrenament complet', 200, 42, 30, at)).toBe(30);
    expect(faceForWords('Antrenament complet', 220, 42, 30, at)).toBe(32);
  });

  it('gives a name one step smaller, then three lines and an ellipsis', () => {
    expect(fitName('Upper body', 431, 3, [50, 42], measure)).toMatchObject({
      font: { size: 50 },
      lines: ['Upper body'],
    });
    // Romanian runs long: a step down, and it fits three lines whole.
    const ro = fitName(RO_NAME, 431, 3, [50, 42], measure, true);
    expect(ro.font.size).toBe(42);
    expect(ro.lines).toHaveLength(3);
    expect(ro.lines.join(' ')).toBe(RO_NAME);
    const endless = fitName(`${RO_NAME} ${RO_NAME} ${RO_NAME}`, 431, 3, [50, 42], measure);
    expect(endless.font.size).toBe(42);
    expect(endless.lines).toHaveLength(3);
    expect(endless.lines[2].endsWith('…')).toBe(true);
  });

  it('prints the numbers on one line', () => {
    expect(statsLine(content().stats)).toBe('9 sets · 4,280 kg volume');
  });
});

describe('the drop order', () => {
  it('follows the design, and never drops the record', () => {
    expect(DROP_ORDER.badge.map((step) => step.name)).toEqual([
      'exercises:2',
      'exercises:1',
      'exercises:0',
      'location',
      'feeling',
      'coach',
      'streak',
      'stat:2',
    ]);
    expect(DROP_ORDER.cells.map((step) => step.name)).toEqual([
      'exercises:2',
      'exercises:0',
      'location',
      'feeling',
      'coach',
      'streak',
      'number',
    ]);
    expect(DROP_ORDER.full.map((step) => step.name)).toEqual([
      'exercises:2',
      'location:1',
      'feeling',
    ]);
    for (const order of Object.values(DROP_ORDER)) {
      const dropped = order.reduce<ShareCardContent>((c, step) => step.drop(c) ?? c, content());
      expect(dropped.record).not.toBeNull();
      expect(dropped.title).toBe('Upper body');
      expect(dropped.duration).not.toBeNull();
    }
  });

  it('drops in order until it fits, passing over what is not there', () => {
    // Fits once the exercises are down to one: two steps.
    const build = (c: ShareCardContent): ShareLayout => ({
      width: 1,
      height: 1,
      paints: [],
      fits: c.exercises.length <= 1,
      dropped: [],
    });
    expect(fitInOrder(content(), DROP_ORDER.badge, build).dropped).toEqual([
      'exercises:2',
      'exercises:1',
    ]);
    // No location to drop: the step is passed over, not counted.
    const never = (): ShareLayout => ({
      width: 1,
      height: 1,
      paints: [],
      fits: false,
      dropped: [],
    });
    const all = fitInOrder(content({ location: null }), DROP_ORDER.badge, never);
    expect(all.dropped).not.toContain('location');
    expect(all.dropped.at(-1)).toBe('stat:2');
    expect(all.fits).toBe(false);
  });
});

describe('Quick · Badge', () => {
  it('fits everything on, with the brand edge and no logo, handle or link', () => {
    const layout = badgeLayout(content(), measure, HexShapes.Logo);
    expect(layout.fits).toBe(true);
    expect(layout.dropped).toEqual([]);
    expect(layout.width).toBe(STICKER_WIDTH);
    expect(layout.height).toBeLessThanOrEqual(STICKER_HEIGHT);
    const edge = ofKind(layout, 'brandEdge');
    expect(edge).toHaveLength(1);
    expect(edge[0].dash).toHaveLength(5);
    expect(ofKind(layout, 'mark')).toHaveLength(0);
    const words = said(layout).join(' ');
    expect(words).not.toContain('motionhive.fit');
    expect(words).not.toContain('@');
    expect(words).toContain('Wed 28 Oct · 18:20');
    expect(words).toContain('9 sets · 4,280 kg volume');
    expect(words).toContain('18th workout · 3 weeks in a row');
    expect(words).toContain('World Class Iulius');
    expect(words).toContain('with Bogdan Daniel');
    expect(ofKind(layout, 'emoji').map((paint) => paint.text)).toEqual(['🤩']);
  });

  it('puts the medal over its card, the card overlapping it, in the chosen hexagon', () => {
    for (const shape of [HexShapes.Logo, HexShapes.Classic]) {
      const layout = badgeLayout(content(), measure, shape);
      const medal = ofKind(layout, 'fill').find(
        (paint) => paint.shape.kind === 'hex' && paint.shape.w === 577,
      );
      const card = ofKind(layout, 'fill').find((paint) => paint.role === 'detailsCard');
      expect(medal && card).toBeTruthy();
      if (!medal || !card) continue;
      expect(card.shape.y).toBeCloseTo(medal.shape.y + hexSize(shape, 577).height - 62, 5);
      expect(layout.fits).toBe(true);
    }
  });

  it('is the medal alone when the card would hold nothing', () => {
    const layout = badgeLayout(content(NOTHING_ELSE), measure, HexShapes.Logo);
    expect(ofKind(layout, 'fill').some((paint) => paint.role === 'detailsCard')).toBe(false);
    expect(ofKind(layout, 'shadow')[0].shapes).toHaveLength(1);
    expect(said(layout)).toEqual(['Upper body', '52', 'min']);
  });

  // A detail switched off takes its room with it: the sticker is only as
  // tall as what is on it, the medal alone the shortest, with room for the
  // shadow and nothing more.
  it('hugs what is on it', () => {
    const all = badgeLayout(content(), measure, HexShapes.Logo);
    const fewer = badgeLayout(content({ exercises: [] }), measure, HexShapes.Logo);
    const alone = badgeLayout(content(NOTHING_ELSE), measure, HexShapes.Logo);
    expect(fewer.height).toBeLessThan(all.height);
    expect(alone.height).toBeLessThan(fewer.height);
    expect(alone.height).toBeCloseTo(hexSize(HexShapes.Logo, 577).height + 100, 5);
  });

  it('keeps the name in the medal: a step smaller, at most three lines', () => {
    const layout = badgeLayout(content({ title: RO_NAME }), measure, HexShapes.Logo);
    const name = texts(layout).filter(
      (paint) => paint.font.family === 'Poppins' && paint.font.size === 42,
    );
    expect(name.map((paint) => paint.text).join(' ')).toBe(RO_NAME);
    expect(name).toHaveLength(3);
  });

  it('cuts a 40 character place to one line with an ellipsis', () => {
    const place = 'Bazinul Olimpic Universitatea, Cluj-Napo';
    const layout = badgeLayout(content({ location: place }), measure, HexShapes.Logo);
    const line = said(layout).find((text) => text.startsWith('Bazinul'));
    expect(line?.endsWith('…')).toBe(true);
    expect(ofKind(layout, 'pin')).toHaveLength(1);
  });

  it('drops the streak, not the number, when the footer line runs long', () => {
    const long = content({ streak: { line: 'x'.repeat(60), value: '3', label: 'wks' } });
    const layout = badgeLayout(long, measure, HexShapes.Logo);
    expect(layout.dropped).toEqual(['streak']);
    expect(said(layout)).toContain('18th workout');
  });

  it('drops the second stat, and only that, when the numbers outrun the medal', () => {
    const wide = content({
      stats: [
        { value: '9', label: 'sets' },
        { value: '41,280', label: 'kilograms of volume moved today' },
      ],
    });
    const layout = badgeLayout(wide, measure, HexShapes.Logo);
    expect(layout.dropped).toEqual(['stat:2']);
    expect(said(layout)).toContain('9 sets');
    expect(said(layout)).toContain('Bench press');
  });

  it('keeps the set numbers of the record whole and cuts the exercise name instead', () => {
    const layout = badgeLayout(
      content({
        record: {
          title: 'New record',
          short: 'PR',
          exercise: 'Single arm dumbbell bench press on an incline',
          best: '62.5 × 7',
        },
      }),
      measure,
      HexShapes.Logo,
    );
    const rest = said(layout).find((text) => text.startsWith('Single'));
    expect(rest?.endsWith('… 62.5 × 7')).toBe(true);
  });

  it('carries the logo and the link only as the Full way’s sticker', () => {
    const layout = badgeLayout(content(), measure, HexShapes.Logo, true);
    expect(ofKind(layout, 'mark')).toHaveLength(1);
    expect(said(layout)).toContain('app.motionhive.fit/@anna');
    expect(said(layout)).toContain('MotionHive');
    expect(layout.fits).toBe(true);
  });
});

describe('Quick · Cells', () => {
  it('puts the duration in the middle and the rest around it, in the design’s order', () => {
    const cells = flowerCells(content());
    expect(cells.map((cell) => [cell.value, cell.col, cell.row])).toEqual([
      ['52', 0, 1],
      ['9', -0.5, 0],
      ['4,280', 0.5, 0],
      ['PR', -1, 1],
      ['18th', 1, 1],
      ['3', -0.5, 2],
      ['🤩', 0.5, 2],
    ]);
    expect(cells[3].kind).toBe(CellKinds.Record);
    expect(cells[6].kind).toBe(CellKinds.Feeling);
  });

  it('moves a number to the middle without a duration, one cell at its least', () => {
    expect(flowerCells(content({ duration: null }))[0]).toMatchObject({
      value: '9',
      col: 0,
      row: 1,
    });
    expect(flowerCells(content(NOTHING_ELSE))).toEqual([
      { kind: CellKinds.Stat, value: '52', label: 'min', col: 0, row: 1 },
    ]);
    expect(flowerCells(content({ ...NOTHING_ELSE, duration: null }))).toEqual([]);
  });

  it('lays out the pill, the flower and the chips, with no logo, handle or link', () => {
    for (const shape of [HexShapes.Logo, HexShapes.Classic]) {
      const layout = cellsLayout(content({ title: RO_NAME }), measure, shape);
      expect(layout.fits).toBe(true);
      const hexes = ofKind(layout, 'fill').filter(
        (paint) => paint.shape.kind === 'hex' && paint.role === 'honey',
      );
      expect(hexes).toHaveLength(7);
      expect(ofKind(layout, 'mark')).toHaveLength(0);
      const words = said(layout).join(' ');
      expect(words).not.toContain('motionhive.fit');
      expect(words).toContain('Wed 28 Oct · 18:20 · World Class Iulius');
      expect(words).toContain('Squat');
    }
  });

  it('sets a long cell label a little smaller before cutting it', () => {
    const layout = cellsLayout(
      content({
        streak: { line: '20 de săptămâni la rând', value: '20', label: 'de săpt. la rând' },
      }),
      measure,
      HexShapes.Logo,
    );
    const label = texts(layout).find((paint) => paint.text.startsWith('de săpt'));
    expect(label?.text).toBe('de săpt. la rând');
    expect(label?.font.size).toBeLessThan(22);
    expect(label?.font.size).toBeGreaterThanOrEqual(18);
  });

  it('keeps the name to two lines in the pill', () => {
    const layout = cellsLayout(
      content({ title: `${RO_NAME} ${RO_NAME}` }),
      measure,
      HexShapes.Logo,
    );
    const name = texts(layout).filter(
      (paint) => paint.font.family === 'Poppins' && paint.font.size <= 39 && paint.font.size >= 33,
    );
    expect(name).toHaveLength(2);
    expect(name[1].text.endsWith('…')).toBe(true);
  });
});

describe('Full card', () => {
  const bottomLine = (layout: ShareLayout) => Math.max(...texts(layout).map((paint) => paint.y));

  it('opens with a band of honeycomb, the logo, and the duration on the band’s edge', () => {
    const layout = fullLayout(content(), measure, HexShapes.Logo, false);
    expect(layout.fits).toBe(true);
    const band = ofKind(layout, 'comb')[0];
    expect(band.h).toBeGreaterThanOrEqual(420);
    // The band reaches down to the block: the plain colour is the block's own.
    // The block's lines start at the left margin (the duration's unit sits in its hexagon).
    const firstLine = Math.min(
      ...texts(layout).filter((paint) => paint.y > band.h && paint.x === 64).map((p) => p.y),
    );
    expect(firstLine - band.h).toBeGreaterThan(72);
    expect(firstLine - band.h).toBeLessThan(72 + 40);
    expect(ofKind(layout, 'mark')).toHaveLength(1);
    expect(said(layout)).toContain('MotionHive');
    const hex = ofKind(layout, 'fill').find(
      (paint) => paint.shape.kind === 'hex' && paint.shape.w === 216,
    );
    expect(hex?.shape.y).toBeCloseTo(band.h + 104 - hexSize(HexShapes.Logo, 216).height, 5);
    expect(said(layout)).toContain('app.motionhive.fit/@anna');
    expect(ofKind(layout, 'photo')).toHaveLength(0);
  });

  it('keeps the content block at the bottom, clear of Instagram’s controls', () => {
    const full = fullLayout(content(), measure, HexShapes.Logo, false);
    const short = fullLayout(
      content({ ...NOTHING_ELSE, link: 'app.motionhive.fit/@anna' }),
      measure,
      HexShapes.Logo,
      false,
    );
    expect(bottomLine(full)).toBeLessThanOrEqual(CARD_HEIGHT - 176);
    expect(bottomLine(short)).toBeLessThanOrEqual(CARD_HEIGHT - 176);
    expect(bottomLine(short)).toBeGreaterThan(CARD_HEIGHT - 176 - 60);
    // A short block leaves the band more room; a long one shrinks it.
    expect(ofKind(full, 'comb')[0].h).toBeLessThan(ofKind(short, 'comb')[0].h);
  });

  it('goes edge to edge over the photo, with no band and the duration in the tiles', () => {
    const layout = fullLayout(content(), measure, HexShapes.Logo, true);
    expect(ofKind(layout, 'photo')).toHaveLength(1);
    // The photo fades into the theme just above the block, wherever it starts.
    const short = fullLayout(content(NOTHING_ELSE), measure, HexShapes.Logo, true);
    expect(ofKind(short, 'photo')[0].fadeTop).toBeGreaterThan(ofKind(layout, 'photo')[0].fadeTop);
    expect(ofKind(layout, 'comb')).toHaveLength(0);
    expect(
      ofKind(layout, 'fill').some((paint) => paint.shape.kind === 'hex' && paint.shape.w === 216),
    ).toBe(false);
    expect(said(layout)).toContain('52');
  });

  it('lets a long place take a second line, then cuts it', () => {
    const place = 'Bazinul Olimpic Universitatea, Cluj-Napo';
    const layout = fullLayout(content({ location: place }), measure, HexShapes.Logo, false);
    // The kicker: the muted lines above the name.
    const nameTop = Math.min(
      ...texts(layout).filter((paint) => paint.role === 'ink' && paint.font.size >= 52).map((p) => p.y),
    );
    const kicker = texts(layout).filter(
      (paint) => paint.role === 'muted' && paint.font.size === 28 && paint.y < nameTop,
    );
    expect(kicker.length).toBeLessThanOrEqual(2);
    expect(kicker.map((paint) => paint.text).join(' ')).toContain('Bazinul');
  });

  it('shows the week’s honeycomb beside the number, and the feeling', () => {
    const layout = fullLayout(content(), measure, HexShapes.Logo, false);
    const week = ofKind(layout, 'fill').filter(
      (paint) => paint.shape.kind === 'hex' && paint.shape.w === 44,
    );
    expect(week).toHaveLength(7);
    expect(week.filter((paint) => paint.role === 'honey')).toHaveLength(2);
    expect(said(layout)).toContain('18th workout');
    expect(said(layout)).toContain('3 weeks in a row');
    expect(ofKind(layout, 'emoji')).toHaveLength(1);
  });
});
