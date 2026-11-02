/**
 * The app's hexagon: one geometry for every place that draws one (avatars,
 * tiles, the hive and its board, the feeling scale, the share images).
 *
 * Two shapes, chosen per place in code (user, 2026-11-01):
 * - Classic: the app's own, everywhere in the app (`APP_HEX_SHAPE`). A
 *   regular hexagon with rounder corners, the shape web's `mh-hex` draws.
 * - Logo: the logo's own hexagon (168 × 190), standing on a point at
 *   8 : 9, its corners cut back 6% of the width (design "Share v3", 0).
 *   For the share images and the share sheet (`SHARE_HEX_SHAPE`), where it
 *   stands for the brand.
 *
 * A component that draws a hexagon takes a `shape` input defaulting to the
 * app's, so either shape is one attribute away.
 *
 * Every corner is the same construction: cut back along both edges and
 * joined by a quadratic curve through the vertex. Pure, so the shapes are
 * tested here and everything else only paints the string it returns: an
 * SVG `d`, a CSS `clip-path: path(...)`, or `new Path2D(d)` on a canvas.
 */

export const HexShapes = {
  Logo: 'logo',
  Classic: 'classic',
} as const;

export type HexShape = (typeof HexShapes)[keyof typeof HexShapes];

/** Standing on a point (the hive, the stickers) or lying on a side (classic avatars). */
export const HexOrientations = {
  Pointy: 'pointy',
  Flat: 'flat',
} as const;

export type HexOrientation = (typeof HexOrientations)[keyof typeof HexOrientations];

export interface HexGeometry {
  /** Width : height standing on a point. Lying on a side it is height : width. */
  ratio: number;
  /**
   * How far each corner is cut back along both of its edges, as a share of
   * the width standing on a point (the height lying on a side).
   */
  cut: number;
}

export const HEX_GEOMETRY: Readonly<Record<HexShape, HexGeometry>> = {
  // The logo: 168 wide, 190 tall, its corner arcs 14.6 on 168 (cut 6%).
  [HexShapes.Logo]: { ratio: 8 / 9, cut: 0.06 },
  // A regular hexagon (√3 : 2) with its corners cut back 11 on a 100 point
  // to point size: the `HEX_PATH` the avatars drew, exactly.
  [HexShapes.Classic]: { ratio: Math.sqrt(3) / 2, cut: 11 / (50 * Math.sqrt(3)) },
};

/**
 * The "open hexagon" edge of the share sticker's medal: two breaks, upper
 * right and lower left, like the logo, so the sticker reads as MotionHive
 * with no logo on it. Stroke the path with `pathLength="100"` (a canvas:
 * scale the pattern by the path's length / 100) and round caps.
 */
export const BRAND_EDGE = {
  pathLength: 100,
  dashArray: [14, 7, 43, 7, 29] as readonly number[],
} as const;

/** The app's hexagon, everywhere but the share images. */
export const APP_HEX_SHAPE: HexShape = HexShapes.Classic;

/** The brand's hexagon, for the share images and the share sheet. */
export const SHARE_HEX_SHAPE: HexShape = HexShapes.Logo;

/**
 * The rest timer's hexagon, which drains as the rest passes: the brand's
 * squarer shape, the one place in the app that uses it (owner's call,
 * 2026-11-02). Lists, avatars and tiles keep the app's own.
 */
export const TIMER_HEX_SHAPE: HexShape = HexShapes.Logo;

/** The size of a hexagon `width` wide, in the given shape and orientation. */
export function hexSize(
  shape: HexShape,
  width: number,
  orientation: HexOrientation = HexOrientations.Pointy,
): { width: number; height: number } {
  const { ratio } = HEX_GEOMETRY[shape];
  return { width, height: orientation === HexOrientations.Pointy ? width / ratio : width * ratio };
}

/** Two decimals, the precision `HEX_PATH` was written in; never "-0.00". */
const num = (value: number): string => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);

/**
 * The rounded hexagon filling a `w × h` box at (`x0`, `y0`), as an SVG path.
 * `cut` is the share of the side across the points' axis (the width standing
 * on a point, the height lying on a side) each corner is cut back by.
 */
export function hexPath(
  w: number,
  h: number,
  cut: number,
  orientation: HexOrientation = HexOrientations.Pointy,
  x0 = 0,
  y0 = 0,
): string {
  // Clockwise from the vertex the path starts at, as `HEX_PATH` did.
  const vertices: [number, number][] =
    orientation === HexOrientations.Pointy
      ? [[w / 2, 0], [w, h / 4], [w, (3 * h) / 4], [w / 2, h], [0, (3 * h) / 4], [0, h / 4]]
      : [[w, h / 2], [(3 * w) / 4, h], [w / 4, h], [0, h / 2], [w / 4, 0], [(3 * w) / 4, 0]];
  const length = cut * (orientation === HexOrientations.Pointy ? w : h);
  const toward = (from: [number, number], to: [number, number]): string => {
    const t = length / Math.hypot(to[0] - from[0], to[1] - from[1]);
    return `${num(from[0] + (to[0] - from[0]) * t + x0)} ${num(from[1] + (to[1] - from[1]) * t + y0)}`;
  };
  const corner = (i: number) => {
    const vertex = vertices[i];
    const before = vertices[(i + 5) % 6];
    const after = vertices[(i + 1) % 6];
    return {
      in: toward(vertex, before),
      through: `${num(vertex[0] + x0)} ${num(vertex[1] + y0)}`,
      out: toward(vertex, after),
    };
  };
  const corners = vertices.map((_, i) => corner(i));
  const drawn = corners.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.in} Q ${c.through} ${c.out}`);
  return `${drawn.join(' ')} L ${corners[0].in} Z`;
}

/** The hexagon of a shape, `width` wide, its box's top left at (`x0`, `y0`). */
export function hexShapePath(
  shape: HexShape,
  width: number,
  orientation: HexOrientation = HexOrientations.Pointy,
  x0 = 0,
  y0 = 0,
): string {
  const { height } = hexSize(shape, width, orientation);
  return hexPath(width, height, HEX_GEOMETRY[shape].cut, orientation, x0, y0);
}

/**
 * Where the next cell of a comb sits, standing on a point: `gap` apart side
 * by side, and rows tucked into each other (they overlap by a quarter of
 * the height, less the gap along the slanted edge).
 */
export function combStep(shape: HexShape, width: number, gap: number): { dx: number; dy: number } {
  const { height } = hexSize(shape, width);
  return { dx: width + gap, dy: height * 0.75 + gap * 0.87 };
}

// ─── Painting it ─────────────────────────────────────────────────

/**
 * Which way a shape's tiles stand: avatars, icon tiles, the feeling scale,
 * the finish badge. The logo stands on a point, as the logo does; the
 * classic shape lies on a side, as the avatars always did. A comb's cells
 * stand on a point in both shapes.
 */
export const TILE_ORIENTATION: Readonly<Record<HexShape, HexOrientation>> = {
  [HexShapes.Logo]: HexOrientations.Pointy,
  [HexShapes.Classic]: HexOrientations.Flat,
};

/** A box in an SVG's user units. */
export interface HexBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A hexagon ready to paint, in the app's one convention: drawn in the
 * 100 × 100 square around (50, 50), 100 from point to point. Every shape and
 * orientation shares that centre and that size, so a transform about
 * (50, 50) (a cell's inset, a ring) or a picture filling the square fits
 * them all. The box is where the hexagon lies in the square.
 */
export interface HexFigure extends HexBox {
  /** An SVG `d`, a CSS `clip-path: path(...)` or `new Path2D(d)`. */
  d: string;
  /** The box, as an SVG `viewBox`. */
  viewBox: string;
  /** The box's width / height, as a CSS `aspect-ratio`. */
  aspect: string;
}

/** Two decimals without the trailing zeros: "6.7", "86.6", "100". */
const short = (value: number): string => String(Number(value.toFixed(2)));

/** A shape in an orientation, in the 100 square (see `HexFigure`). */
export function hexFigure(shape: HexShape, orientation: HexOrientation): HexFigure {
  const pointy = orientation === HexOrientations.Pointy;
  const { ratio } = HEX_GEOMETRY[shape];
  const width = pointy ? 100 * ratio : 100;
  const height = pointy ? 100 : 100 * ratio;
  const x = (100 - width) / 2;
  const y = (100 - height) / 2;
  return {
    d: hexShapePath(shape, width, orientation, x, y),
    x,
    y,
    width,
    height,
    viewBox: [x, y, width, height].map(short).join(' '),
    aspect: `${short(width)} / ${short(height)}`,
  };
}

/** A tile's hexagon in a shape: avatars, icon tiles, the feeling scale, the finish badge. */
export function tileFigure(shape: HexShape): HexFigure {
  return hexFigure(shape, TILE_ORIENTATION[shape]);
}

/** A comb cell's hexagon in a shape, on its point in both: the hive, its board, their key. */
export function cellFigure(shape: HexShape): HexFigure {
  return hexFigure(shape, HexOrientations.Pointy);
}

const CLASSIC_TILE = hexFigure(HexShapes.Classic, HexOrientations.Flat);

/**
 * The frame a tile is laid out in, in either shape: the classic tile's box
 * (1 : cos 30°). A tile's size is its point to point length in both shapes,
 * so the logo's points reach past this frame above and below, by 6.7% of
 * the width, into the room a row already keeps around it: no row, list or
 * hero changes height when the shape changes. Paint the tile with
 * `overflow: visible`.
 */
export const TILE_FRAME = { viewBox: CLASSIC_TILE.viewBox, aspect: CLASSIC_TILE.aspect } as const;

/**
 * What a comb needs to lay its cells out, in cell widths, for places given
 * as `x` in cell widths (gaps included) and `y` in rows: the step from one
 * row to the next, a cell's height, and the size of the whole comb.
 */
export interface CombLayout {
  rowStep: number;
  cellHeight: number;
  width: number;
  height: number;
}

/** Four decimals: enough for a CSS length, short in the DOM. */
const fine = (value: number): number => Math.round(value * 10_000) / 10_000;

/** The layout of a comb of `places`, its cells one unit wide and `gap` apart. */
export function combLayout(
  shape: HexShape,
  places: readonly { x: number; y: number }[],
  gap: number,
): CombLayout {
  const rowStep = combStep(shape, 1, gap).dy;
  const cellHeight = hexSize(shape, 1).height;
  if (!places.length) {
    return { rowStep: fine(rowStep), cellHeight: fine(cellHeight), width: 0, height: 0 };
  }
  return {
    rowStep: fine(rowStep),
    cellHeight: fine(cellHeight),
    width: fine(Math.max(...places.map((place) => place.x)) + 1),
    height: fine(Math.max(...places.map((place) => place.y)) * rowStep + cellHeight),
  };
}

/**
 * A small comb drawn as one path, for a decoration: the shape's pointy
 * figure (100 from point to point) at each `[column, row]`, a half column
 * shifting a row, `gap` apart in the same units. Its box starts at 0, 0.
 */
export function combFigure(
  shape: HexShape,
  places: readonly (readonly [number, number])[],
  gap: number,
): { d: string; viewBox: string; width: number; height: number } {
  const cell = hexFigure(shape, HexOrientations.Pointy);
  const { dx, dy } = combStep(shape, cell.width, gap);
  const at = ([col, row]: readonly [number, number]) =>
    hexShapePath(shape, cell.width, HexOrientations.Pointy, col * dx, row * dy);
  const d = places.map(at).join(' ');
  const width = Math.max(0, ...places.map(([col]) => col)) * dx + cell.width;
  const height = Math.max(0, ...places.map(([, row]) => row)) * dy + cell.height;
  return { d, viewBox: `0 0 ${short(width)} ${short(height)}`, width, height };
}

// ─── Measures for drawing on a canvas (the share images) ──────────────────

/**
 * How wide a hexagon `width` wide, standing on a point, is `y` from the
 * top of its box: full along its upright sides, narrowing to nothing at
 * the points. The corner cuts are left out (6% at most); text kept inside
 * this width stays inside the shape.
 */
export function hexWidthAt(shape: HexShape, width: number, y: number): number {
  const { height } = hexSize(shape, width);
  const quarter = height / 4;
  return width * Math.max(0, Math.min(1, y / quarter, (height - y) / quarter));
}

/**
 * The same hexagon `inset` in from every side, standing on a point: its
 * box, for a ring's inner face or the centre line of an edge stroke.
 */
export function hexInset(
  shape: HexShape,
  x: number,
  y: number,
  width: number,
  inset: number,
): { x: number; y: number; width: number } {
  const inner = width - inset * 2;
  const drop = (hexSize(shape, width).height - hexSize(shape, inner).height) / 2;
  return { x: x + inset, y: y + drop, width: inner };
}

/**
 * The length of the outline `hexShapePath` draws, standing on a point,
 * and of its first corner (the curve through the top point). Read off the
 * path itself, so it always matches what is drawn.
 */
export function hexOutline(
  shape: HexShape,
  width: number,
): { length: number; firstCorner: number } {
  const tokens = hexShapePath(shape, width).match(/[MLQZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const point = (from: number): [number, number] => [
    Number(tokens[from]),
    Number(tokens[from + 1]),
  ];
  let at: [number, number] = [0, 0];
  let length = 0;
  let firstCorner = -1;
  for (let i = 0; i < tokens.length; i++) {
    const command = tokens[i];
    if (command === 'M') {
      at = point(i + 1);
      i += 2;
    } else if (command === 'L') {
      const to = point(i + 1);
      length += Math.hypot(to[0] - at[0], to[1] - at[1]);
      at = to;
      i += 2;
    } else if (command === 'Q') {
      const control = point(i + 1);
      const to = point(i + 3);
      const curve = quadraticLength(at, control, to);
      if (firstCorner < 0) firstCorner = curve;
      length += curve;
      at = to;
      i += 4;
    }
  }
  return { length, firstCorner: Math.max(0, firstCorner) };
}

function quadraticLength(
  from: [number, number],
  control: [number, number],
  to: [number, number],
): number {
  const steps = 24;
  let length = 0;
  let previous = from;
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;
    const next: [number, number] = [
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ];
    length += Math.hypot(next[0] - previous[0], next[1] - previous[1]);
    previous = next;
  }
  return length;
}

/**
 * `BRAND_EDGE` for a canvas: the dash pattern in pixels for an outline
 * `width` wide, and the offset that starts it where the design does, just
 * past the top point (the path itself starts just before it). Set it as
 * `setLineDash(dash)` and `lineDashOffset = offset`.
 */
export function brandEdgeDash(shape: HexShape, width: number): { dash: number[]; offset: number } {
  const { length, firstCorner } = hexOutline(shape, width);
  const unit = length / BRAND_EDGE.pathLength;
  return { dash: BRAND_EDGE.dashArray.map((part) => part * unit), offset: -firstCorner };
}
