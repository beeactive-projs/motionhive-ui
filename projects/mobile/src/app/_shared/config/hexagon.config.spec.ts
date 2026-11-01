import { describe, expect, it } from 'vitest';

import {
  BRAND_EDGE,
  HEX_GEOMETRY,
  HexOrientations,
  HexShapes,
  TILE_FRAME,
  TILE_ORIENTATION,
  brandEdgeDash,
  combFigure,
  combLayout,
  combStep,
  hexFigure,
  hexInset,
  hexOutline,
  hexPath,
  hexShapePath,
  hexSize,
  hexWidthAt,
} from './hexagon.config';

/**
 * The hexagon every avatar, tile and comb drew until November 2026 (the
 * flat-top `HEX_PATH` and its tight `HEX_VIEW_BOX`, ported from web's
 * `mh-hex`), kept here as the fixture Classic must keep matching.
 */
const LEGACY_HEX_PATH =
  'M 94.50 40.47 Q 100.00 50.00 94.50 59.53 L 80.50 83.77 Q 75.00 93.30 64.00 93.30 ' +
  'L 36.00 93.30 Q 25.00 93.30 19.50 83.77 L 5.50 59.53 Q 0.00 50.00 5.50 40.47 ' +
  'L 19.50 16.23 Q 25.00 6.70 36.00 6.70 L 64.00 6.70 Q 75.00 6.70 80.50 16.23 ' +
  'L 94.50 40.47 Z';
const LEGACY_VIEW_BOX = '0 6.7 100 86.6';
/** The comb cells' box: the legacy hexagon turned a quarter round. */
const LEGACY_CELL_VIEW_BOX = '6.7 0 86.6 100';

/** Every corner of a path: the point each `Q` curves through. */
function corners(d: string): [number, number][] {
  return [...d.matchAll(/Q (-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe('hexagon', () => {
  // The classic shape is the one the app has always drawn: the generator
  // gives back the old path to the character, so choosing Classic changes
  // nothing on screen.
  it('draws the classic shape exactly as before', () => {
    const height = 50 * Math.sqrt(3);
    expect(
      hexPath(100, height, HEX_GEOMETRY.classic.cut, HexOrientations.Flat, 0, 50 - height / 2),
    ).toBe(LEGACY_HEX_PATH);
  });

  // 8 : 9 standing on a point (the logo is 168 × 190), corners cut back 6%.
  it('sizes the logo shape like the logo', () => {
    expect(hexSize(HexShapes.Logo, 168)).toEqual({ width: 168, height: 189 });
    expect(hexSize(HexShapes.Classic, 100, HexOrientations.Flat).height).toBeCloseTo(86.6, 1);
    expect(hexSize(HexShapes.Classic, 86.6).height).toBeCloseTo(100, 1);
  });

  it('starts at the top point and cuts each corner back 6% of the width', () => {
    const d = hexShapePath(HexShapes.Logo, 100);
    // Into the top vertex from the upper left edge, through it, out along the upper right.
    expect(d).toMatch(/^M \d+\.\d{2} \d+\.\d{2} Q 50\.00 0\.00 /);
    expect(d.endsWith(' Z')).toBe(true);
    // Six corners: one move, five lines between them, and the closing line.
    expect(d.match(/Q /g)).toHaveLength(6);
    expect(d.match(/L /g)).toHaveLength(6);
  });

  it('offsets the box', () => {
    expect(hexShapePath(HexShapes.Logo, 100, HexOrientations.Pointy, 10, 20)).toContain('Q 60.00 20.00');
  });

  it('spaces a comb by the gap and tucks the rows', () => {
    expect(combStep(HexShapes.Logo, 80, 4)).toEqual({ dx: 84, dy: 80 * (9 / 8) * 0.75 + 4 * 0.87 });
  });

  // A cell's upper right edge and the lower left edge of the cell above and
  // to its right run side by side; the gap between them is the gap across.
  it('keeps the gap even along the slanted edges', () => {
    const gap = 0.08;
    for (const shape of Object.values(HexShapes)) {
      const { height } = hexSize(shape, 1);
      const { dx, dy } = combStep(shape, 1, gap);
      const edge = [0.5, height / 4];
      const length = Math.hypot(edge[0]!, edge[1]!);
      const normal = [edge[1]! / length, -edge[0]! / length];
      // Ours starts at the top point; theirs at their lower left corner.
      const ours = [0.5, 0];
      const theirs = [dx / 2, -dy + (3 * height) / 4];
      const apart = (theirs[0]! - ours[0]!) * normal[0]! + (theirs[1]! - ours[1]!) * normal[1]!;
      expect(Math.abs(apart), shape).toBeCloseTo(gap, 2);
    }
  });

  it('breaks the brand edge in two places', () => {
    expect(BRAND_EDGE.dashArray.reduce((sum, part) => sum + part, 0)).toBe(BRAND_EDGE.pathLength);
  });

  it('stands the logo tiles on a point and keeps the classic ones on a side', () => {
    expect(TILE_ORIENTATION).toEqual({ logo: 'pointy', classic: 'flat' });
  });
});

describe('hexFigure', () => {
  it('is the old tile, path and box, in the classic shape', () => {
    const tile = hexFigure(HexShapes.Classic, HexOrientations.Flat);
    expect(tile.d).toBe(LEGACY_HEX_PATH);
    expect(tile.viewBox).toBe(LEGACY_VIEW_BOX);
    expect(tile.aspect).toBe('100 / 86.6');
    expect(TILE_FRAME).toEqual({ viewBox: LEGACY_VIEW_BOX, aspect: '100 / 86.6' });
  });

  // The comb drew the tile turned a quarter round about (50, 50); the pointy
  // figure is that same hexagon, drawn upright instead of rotated.
  it('is the old comb cell in the classic shape on its point', () => {
    const cell = hexFigure(HexShapes.Classic, HexOrientations.Pointy);
    expect(cell.viewBox).toBe(LEGACY_CELL_VIEW_BOX);
    const turned = corners(LEGACY_HEX_PATH).map(([x, y]) => [100 - y, x]);
    corners(cell.d).forEach(([x, y], i) => {
      const match = turned.find(([tx, ty]) => Math.abs(tx - x) < 0.01 && Math.abs(ty - y) < 0.01);
      expect(match, `corner ${i} at ${x}, ${y}`).toBeDefined();
    });
  });

  it('draws every shape 100 from point to point around the centre of the square', () => {
    for (const shape of Object.values(HexShapes)) {
      for (const orientation of Object.values(HexOrientations)) {
        const figure = hexFigure(shape, orientation);
        const xs = corners(figure.d).map(([x]) => x);
        const ys = corners(figure.d).map(([, y]) => y);
        const across = orientation === HexOrientations.Pointy ? ys : xs;
        expect(Math.max(...across) - Math.min(...across)).toBeCloseTo(100, 1);
        expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(50, 1);
        expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(50, 1);
        expect(figure.x + figure.width / 2).toBeCloseTo(50, 6);
        expect(figure.y + figure.height / 2).toBeCloseTo(50, 6);
      }
    }
  });

  it('gives the logo its 8 : 9 box on a point', () => {
    const cell = hexFigure(HexShapes.Logo, HexOrientations.Pointy);
    expect(cell.viewBox).toBe('5.56 0 88.89 100');
    expect(cell.aspect).toBe('88.89 / 100');
    expect(cell.d).toBe(
      hexShapePath(HexShapes.Logo, cell.width, HexOrientations.Pointy, cell.x, 0),
    );
  });
});

describe('combLayout', () => {
  const places = [
    { x: 0, y: 0 },
    { x: 1.08, y: 0 },
    { x: 0.54, y: 1 },
    { x: 1.62, y: 2 },
  ];

  it('steps the rows and sizes the comb in cell widths', () => {
    const logo = combLayout(HexShapes.Logo, places, 0.08);
    expect(logo.cellHeight).toBe(1.125);
    expect(logo.rowStep).toBeCloseTo(1.125 * 0.75 + 0.08 * 0.87, 4);
    expect(logo.width).toBe(2.62);
    expect(logo.height).toBeCloseTo(2 * logo.rowStep + 1.125, 3);
  });

  // The classic comb kept a 1 / cos 30° cell and tucked rows three quarters
  // of a cell down (plus the gap along the slant).
  it('keeps the classic comb where it was', () => {
    const classic = combLayout(HexShapes.Classic, places, 0);
    expect(classic.cellHeight).toBeCloseTo(1.155, 3);
    expect(classic.rowStep).toBeCloseTo(0.866, 3);
    expect(combLayout(HexShapes.Classic, places, 0.08).rowStep).toBeCloseTo(0.866 * 1.08, 3);
  });

  it('is empty with no places', () => {
    expect(combLayout(HexShapes.Logo, [], 0)).toMatchObject({ width: 0, height: 0 });
  });
});

describe('combFigure', () => {
  const twoThreeTwo: [number, number][] = [
    [0.5, 0],
    [1.5, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0.5, 2],
    [1.5, 2],
  ];

  it('draws one hexagon per place in a single path', () => {
    const comb = combFigure(HexShapes.Logo, twoThreeTwo, 8);
    expect(comb.d.match(/M /g)).toHaveLength(7);
    const short = (value: number) => Number(value.toFixed(2));
    expect(comb.viewBox).toBe(`0 0 ${short(comb.width)} ${short(comb.height)}`);
  });

  // Discover's band drew this comb by hand: cells 86.6 wide, 94.6 across
  // and 82 down, in a 276 × 264 box.
  it('lays the classic comb out as the band drew it', () => {
    const comb = combFigure(HexShapes.Classic, twoThreeTwo, 8);
    expect(comb.width).toBeCloseTo(275.8, 1);
    expect(comb.height).toBeCloseTo(264, 0);
    // The second row's first cell: its top point, one row (81.96) down.
    expect(comb.d).toContain('Q 43.30 81.96 ');
  });
});

describe('hexagon measures for a canvas', () => {
  it('is full width along its upright sides and narrows to the points', () => {
    const { height } = hexSize(HexShapes.Logo, 160);
    expect(hexWidthAt(HexShapes.Logo, 160, height / 2)).toBe(160);
    expect(hexWidthAt(HexShapes.Logo, 160, height / 4)).toBe(160);
    expect(hexWidthAt(HexShapes.Logo, 160, height / 8)).toBeCloseTo(80, 5);
    expect(hexWidthAt(HexShapes.Logo, 160, 0)).toBe(0);
    expect(hexWidthAt(HexShapes.Logo, 160, height + 5)).toBe(0);
  });

  it('insets a hexagon evenly, a little more at the points', () => {
    const inner = hexInset(HexShapes.Logo, 10, 20, 74, 2);
    expect(inner.x).toBe(12);
    expect(inner.width).toBe(70);
    // The design's honey ring: 74 × 83 outside, 70 × 78.6 inside at (2, 2.2).
    expect(inner.y - 20).toBeCloseTo(2.25, 2);
  });

  it('measures the outline it draws', () => {
    const { length, firstCorner } = hexOutline(HexShapes.Logo, 201);
    // Six sides less the corner cuts, plus six short curves: a little under
    // the sharp hexagon's 2 × 113 + 4 × 115.
    const sharp = 2 * (226.125 / 2) + 4 * Math.hypot(100.5, 226.125 / 4);
    expect(length).toBeLessThan(sharp);
    expect(length).toBeGreaterThan(sharp * 0.97);
    expect(firstCorner).toBeGreaterThan(20);
    expect(firstCorner).toBeLessThan(25);
  });

  it('scales the brand edge to the outline and starts it past the top point', () => {
    const { dash, offset } = brandEdgeDash(HexShapes.Logo, 201);
    const { length, firstCorner } = hexOutline(HexShapes.Logo, 201);
    expect(dash.reduce((sum, part) => sum + part, 0)).toBeCloseTo(length, 5);
    expect(dash).toHaveLength(BRAND_EDGE.dashArray.length);
    expect(offset).toBe(-firstCorner);
  });
});
