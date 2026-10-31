import { HEX_PATH } from '../../../_shared/components/hex-avatar/hex-avatar';
import {
  CardTheme,
  CardThemes,
  ShareCardContent,
  ShareStat,
  StickerCell,
  StickerCellKinds,
  StickerStyle,
  StickerStyles,
  faceForWords,
  fitLine,
  stickerCells,
  toHexColor,
  withAlpha,
  wrapLines,
} from './share-card.config';

/** A story is 9:16 at 1080 wide, the size Instagram and Facebook take as is. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
/**
 * The sticker's own canvas: the badge (or the cell cluster) with room for
 * its shadow, and for the link pill under the branded one.
 */
export const STICKER_WIDTH = 840;
export const STICKER_HEIGHT = 1080;

/**
 * Text stays inside the band a story does not cover with its own chrome
 * (profile row on top, reply bar below).
 */
const SAFE_TOP = 250;
const SAFE_BOTTOM = 1570;
const CENTER = CARD_WIDTH / 2;

// ─── Palette ───────────────────────────────────────────────────────────────

/**
 * One theme's paint, read from the app's colour ramps when drawn. The
 * ramps never flip with the app's own dark mode, so a Light card stays
 * cream on a phone in dark mode.
 */
export interface CardPalette {
  theme: CardTheme;
  /** The badge, the cells and the Full card. */
  card: string;
  /** The badge's outline and the middle cell's ring. */
  border: string;
  ink: string;
  muted: string;
  /** The volume, the link, the record kicker. */
  accent: string;
  /** An empty cell of the small hive drawn on the card. */
  cell: string;
  /** A place in the small hive with nothing in it, barely there. */
  ghost: string;
  /** A ghost cell of the cells sticker, over a photo. */
  ghostFace: string;
  streakFace: string;
  /** A filled cell: honey, or navy on the honey theme, lighter at the top. */
  fill: string;
  fillTop: string;
  fillInk: string;
  /** The faint honeycomb drawn behind the Full card. */
  pattern: string;
  /** The warm light in the middle of the navy card. */
  glow: string | null;
  /** A Story's background, top and bottom, when there is no photo. */
  storyTop: string;
  storyBottom: string;
  /** The logo mark: honey, navy on the honey theme. */
  mark: string;
  white: string;
}

/**
 * The three themes from the design: cream with honey, navy with honey,
 * honey with navy. Every colour is a ramp step, never written here.
 */
export function cardPalette(theme: CardTheme, token: (name: string) => string): CardPalette {
  const hex = (name: string) => toHexColor(token(name)) ?? token(name);
  const white = '#ffffff';
  const navy = hex('--mh-navy-900');
  const honey = hex('--mh-primary-500');
  if (theme === CardThemes.Dark) {
    return {
      theme,
      card: navy,
      border: honey,
      ink: hex('--mh-navy-50'),
      muted: hex('--mh-navy-300'),
      accent: honey,
      cell: hex('--mh-navy-600'),
      ghost: withAlpha(white, 0.06),
      ghostFace: withAlpha(navy, 0.6),
      streakFace: hex('--mh-navy-600'),
      fill: honey,
      fillTop: hex('--mh-warning-200'),
      fillInk: navy,
      pattern: withAlpha(honey, 0.08),
      glow: withAlpha(honey, 0.22),
      storyTop: hex('--mh-navy-700'),
      storyBottom: hex('--mh-navy-950'),
      mark: honey,
      white,
    };
  }
  if (theme === CardThemes.Honey) {
    return {
      theme,
      card: honey,
      border: navy,
      ink: navy,
      // The deepest honey step: 7.6:1 on the honey card, where 900 gave the
    // labels under the numbers 4.2:1.
    muted: hex('--mh-primary-950'),
      accent: navy,
      cell: withAlpha(navy, 0.16),
      ghost: withAlpha(navy, 0.07),
      ghostFace: withAlpha(honey, 0.6),
      streakFace: hex('--mh-warning-300'),
      fill: navy,
      fillTop: hex('--mh-navy-500'),
      fillInk: hex('--mh-warning-200'),
      pattern: withAlpha(navy, 0.08),
      glow: null,
      storyTop: hex('--mh-warning-300'),
      storyBottom: hex('--mh-primary-600'),
      mark: navy,
      white,
    };
  }
  const cream = hex('--mh-primary-50');
  const deep = hex('--mh-primary-700');
  return {
    theme,
    card: cream,
    border: honey,
    ink: navy,
    muted: hex('--mh-slate-600'),
    accent: deep,
    cell: withAlpha(deep, 0.16),
    ghost: withAlpha(deep, 0.07),
    ghostFace: withAlpha(cream, 0.6),
    streakFace: hex('--mh-primary-200'),
    fill: honey,
    fillTop: hex('--mh-warning-200'),
    fillInk: navy,
    pattern: withAlpha(deep, 0.09),
    glow: null,
    storyTop: cream,
    storyBottom: hex('--mh-primary-200'),
    mark: honey,
    white,
  };
}

// ─── Type ──────────────────────────────────────────────────────────────────

/** Emoji have no glyphs in Inter; the canvas falls through to the system's. */
const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

function font(weight: number, size: number, family = 'Inter'): string {
  return `${weight} ${size}px ${family}, ${EMOJI_FONTS}, sans-serif`;
}

/** Faces the cards use; the canvas draws a fallback if they are not loaded yet. */
export const CARD_FONTS = [font(800, 92, 'Poppins'), font(700, 60), font(600, 34), font(500, 30)];

// ─── Shapes ────────────────────────────────────────────────────────────────

/** The mark from `mh-logo` (viewBox 168 × 190). Change it there and here together. */
const LOGO_PATHS = [
  'M16.8,61.71v66.58a9.74,9.74,0,0,0,4.85,8.42l10.46,6V64.85H43.25v0l20.37,35.37L84,64.86H95.15L84,84.21l-14.8,25.7-5.57,9.68-5.57-9.68L43.26,84.22v84.45l-11.15-6.46L7.27,147.84A14.6,14.6,0,0,1,0,135.21V54.79A14.6,14.6,0,0,1,7.27,42.16L76.73,2A14.53,14.53,0,0,1,91.27,2l22.24,12.88V34.28L88.85,20a9.66,9.66,0,0,0-9.7,0L21.65,53.29A9.74,9.74,0,0,0,16.8,61.71Z',
  'M168,54.79v80.42a14.6,14.6,0,0,1-7.27,12.63L91.27,188.05a14.53,14.53,0,0,1-14.54,0L54.42,175.13V155.68L79.15,170a9.66,9.66,0,0,0,9.7,0l57.5-33.29a9.74,9.74,0,0,0,4.85-8.42V61.71a9.74,9.74,0,0,0-4.85-8.42l-10.46-6v77.91H124.74V99.84H95.15v25.31H84V94L95.15,74.58V90.16h29.59V21.33l11.15,6.46,24.84,14.37A14.6,14.6,0,0,1,168,54.79Z',
];

/** A pointy-top hexagon's height for its width (the app's hexagon stood on its point). */
const HEX_TALL = 100 / 86.6;

let hexShape: Path2D | null = null;

/**
 * The app's own hexagon (`HEX_PATH`, the avatars' shape) stood on its
 * point, as `mh-hive` draws it, `width` wide and centred on (cx, cy).
 * The path is flat-top in a 100 box; a quarter turn about its centre puts
 * it on its point, then it is scaled and moved: one matrix.
 */
function hexPath(cx: number, cy: number, width: number): Path2D {
  hexShape ??= new Path2D(HEX_PATH);
  const s = width / 86.6;
  const path = new Path2D();
  path.addPath(hexShape, new DOMMatrix([0, s, -s, 0, cx + 50 * s, cy - 50 * s]));
  return path;
}

/** A filled cell, honey (or navy) rising from the top's lighter stop like `mh-hive`. */
function fillCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  palette: CardPalette,
): void {
  const height = width * HEX_TALL;
  const gradient = ctx.createLinearGradient(0, cy - height / 2, 0, cy + height / 2);
  gradient.addColorStop(0, palette.fillTop);
  gradient.addColorStop(0.12, palette.fill);
  gradient.addColorStop(1, palette.fill);
  ctx.fillStyle = gradient;
  ctx.fill(hexPath(cx, cy, width));
}

/** The white dot a record wears, near the top of its cell. */
function recordDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  size: number,
  white: string,
): void {
  ctx.save();
  ctx.shadowColor = white;
  ctx.shadowBlur = size * 1.2;
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.arc(cx, top, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** How tall the small hive is for its cells' width. */
function smallHiveHeight(cellWidth: number): number {
  const height = cellWidth * HEX_TALL;
  return height + 2 * (height * 0.75 + cellWidth * 0.06 * 0.866);
}

/**
 * The small hive at the top of the badge and the Full card: 2 + 3 + 2
 * cells, some poured, the bottom two only places. Returns its height.
 */
function drawSmallHive(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  cellWidth: number,
  palette: CardPalette,
): number {
  const gap = cellWidth * 0.06;
  const stepX = cellWidth + gap;
  const height = cellWidth * HEX_TALL;
  const stepY = height * 0.75 + gap * 0.866;
  // [column, row, filled]
  const cells: [number, number, boolean][] = [
    [-0.5, 0, true],
    [0.5, 0, false],
    [-1, 1, true],
    [0, 1, true],
    [1, 1, false],
    [-0.5, 2, false],
    [0.5, 2, false],
  ];
  for (const [column, row, filled] of cells) {
    const x = cx + column * stepX;
    const y = top + height / 2 + row * stepY;
    if (filled) fillCell(ctx, x, y, cellWidth, palette);
    else {
      ctx.fillStyle = row === 2 ? palette.ghost : palette.cell;
      ctx.fill(hexPath(x, y, cellWidth));
    }
  }
  return smallHiveHeight(cellWidth);
}

/** The logo mark, `height` tall, its top left at (x, y). */
function drawMark(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  height: number,
): void {
  const scale = height / 190;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

/** Mark and wordmark side by side, starting at `x` (or centred on it). Returns the width. */
function drawBrand(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  x: number,
  top: number,
  height: number,
  centred: boolean,
): number {
  setText(ctx, font(800, Math.round(height * 0.78), 'Poppins'), 0);
  const wordWidth = ctx.measureText('MotionHive').width;
  const markWidth = (168 / 190) * height;
  const gap = height * 0.32;
  const total = markWidth + gap + wordWidth;
  const left = centred ? x - total / 2 : x;
  drawMark(ctx, palette.mark, left, top, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.ink;
  ctx.fillText('MotionHive', left + markWidth + gap, top + height / 2 + height * 0.04);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  return total;
}

/** The brand in a pill of the card's colour, so it reads on any photo. Returns its height. */
function drawBrandPill(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  x: number,
  top: number,
  centred: boolean,
): number {
  const height = 52;
  const padX = 34;
  const padY = 20;
  setText(ctx, font(800, Math.round(height * 0.78), 'Poppins'), 0);
  const wordWidth = ctx.measureText('MotionHive').width;
  const width = (168 / 190) * height + height * 0.32 + wordWidth + padX * 2;
  const left = centred ? x - width / 2 : x;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, left, top, width, height + padY * 2, (height + padY * 2) / 2);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();
  drawBrand(ctx, palette, left + padX, top + padY, height, false);
  return height + padY * 2;
}

// ─── Text ──────────────────────────────────────────────────────────────────

function setText(ctx: CanvasRenderingContext2D, value: string, letterSpacing: number): void {
  ctx.font = value;
  // Not every WebView has it yet; the card reads fine without.
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
  }
}

/** Shortens with an ellipsis until it fits, in the face set on the canvas. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  return fitLine(text, maxWidth, (value) => ctx.measureText(value).width);
}

/**
 * Sets, and returns, the largest face up to `size` that fits the text in
 * `maxWidth`, down to two thirds of it. A number is better smaller than
 * cut ("2980 kg", not "298…").
 */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
): number {
  const floor = Math.round(size * 0.66);
  let current = size;
  setText(ctx, font(weight, current), 0);
  while (current > floor && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    setText(ctx, font(weight, current), 0);
  }
  return current;
}

/** The text at the size that fits it (`fitSize`), ellipsised past the floor. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
): string {
  fitSize(ctx, text, maxWidth, weight, size);
  return fit(ctx, text, maxWidth);
}

/**
 * Word-wraps into at most `maxLines` in the face set on the canvas, every
 * line fitted (`wrapLines`): a word wider than the line is cut, never drawn
 * past the shape around it.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  return wrapLines(text, maxWidth, maxLines, (value) => ctx.measureText(value).width);
}

/**
 * The title's face: `size`, or smaller until its longest word fits the
 * line (`faceForWords`), down to `floor`. Leaves that face set.
 */
function titleFace(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  floor: number,
): number {
  const face = faceForWords(text, maxWidth, size, floor, (word, candidate) => {
    setText(ctx, font(800, candidate, 'Poppins'), 0);
    return ctx.measureText(word).width;
  });
  setText(ctx, font(800, face, 'Poppins'), 0);
  return face;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fills the box with the image, cropped to keep its proportions (CSS `cover`). */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const source = image as { width: number; height: number };
  const scale = Math.max(w / source.width, h / source.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, x, y, w, h);
}

/** A stats row's height for its value size: the value and the label under it. */
function statsRowHeight(valueSize: number): number {
  return valueSize + Math.round(valueSize * 0.42) * 1.9;
}

/**
 * Value over label, in equal columns across `width`, centred on `cx`.
 * Returns the row's height.
 */
function drawStatsRow(
  ctx: CanvasRenderingContext2D,
  stats: readonly ShareStat[],
  palette: CardPalette,
  cx: number,
  top: number,
  width: number,
  valueSize: number,
): number {
  const column = width / stats.length;
  const labelSize = Math.round(valueSize * 0.42);
  // One size for the whole row, the one the widest value allows.
  const size = Math.min(
    ...stats.map((stat) => fitSize(ctx, stat.value, column - 12, 700, valueSize)),
  );
  stats.forEach((stat, i) => {
    const x = cx - width / 2 + column * (i + 0.5);
    ctx.fillStyle = stat.accent ? palette.accent : palette.ink;
    setText(ctx, font(700, size), 0);
    ctx.fillText(fit(ctx, stat.value, column - 12), x, top + valueSize);
    ctx.fillStyle = palette.muted;
    setText(ctx, font(500, labelSize), 0);
    const label = fit(ctx, stat.label.toLocaleLowerCase(), column - 12);
    ctx.fillText(label, x, top + valueSize + labelSize * 1.5);
  });
  return statsRowHeight(valueSize);
}

// ─── The Quick sticker ─────────────────────────────────────────────────────

/**
 * The Quick sticker on its transparent canvas: the hexagon badge or the
 * cells. No logo and no coach: it is the person's, not an ad.
 */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  style: StickerStyle,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (style === StickerStyles.Cells) drawCellsSticker(ctx, content, palette);
  else drawBadgeSticker(ctx, content, palette, false);
}

/**
 * The Full way's sticker, copied on its own to paste over a Story of the
 * person's own: the badge with the logo in it and the link under it.
 */
export function drawBrandedSticker(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  drawBadgeSticker(ctx, content, palette, true);
}

const BADGE_WIDTH = 760;
const BADGE_BORDER = 12;
/** Text never runs closer than this to the badge's edge. */
const BADGE_PADDING = 56;

/**
 * How wide the badge's face is `offset` above or below its centre: full
 * width along its upright sides, narrowing to the points.
 */
function badgeWidthAt(offset: number): number {
  const inner = BADGE_WIDTH - BADGE_BORDER * 2;
  const half = (inner * HEX_TALL) / 2;
  const d = Math.min(Math.abs(offset), half);
  const width = d <= half / 2 ? inner : (inner * (half - d)) / (half / 2);
  return Math.max(0, width - BADGE_PADDING * 2);
}

function drawBadgeSticker(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  branded: boolean,
): void {
  const cx = STICKER_WIDTH / 2;
  const height = BADGE_WIDTH * HEX_TALL;
  const cy = branded ? 50 + height / 2 : STICKER_HEIGHT / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = palette.border;
  ctx.fill(hexPath(cx, cy, BADGE_WIDTH));
  ctx.restore();

  const face = hexPath(cx, cy, BADGE_WIDTH - BADGE_BORDER * 2);
  ctx.fillStyle = palette.card;
  ctx.fill(face);
  if (palette.glow) {
    ctx.save();
    ctx.clip(face);
    const glow = ctx.createRadialGradient(cx, cy - 60, 0, cx, cy - 60, BADGE_WIDTH * 0.6);
    glow.addColorStop(0, palette.glow);
    glow.addColorStop(1, withAlpha(palette.card, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(cx - BADGE_WIDTH / 2, cy - height / 2, BADGE_WIDTH, height);
    ctx.restore();
  }

  // The stack, measured first and centred on the badge: a little high,
  // where the face is still wide for the numbers at the bottom. A record
  // leads with its big poured cell; otherwise the small hive does.
  const record = content.record;
  const brandHeight = 48;
  const cellWidth = branded ? 196 : 236;
  const hiveCell = 54;
  const lead = record ? cellWidth * HEX_TALL + 12 + 38 : smallHiveHeight(hiveCell);
  const titleSize = titleFace(ctx, content.title, badgeWidthAt(0), record ? 60 : 72, 44);
  const lineHeight = Math.round(titleSize * 1.12);
  const titleLines = wrap(ctx, content.title, badgeWidthAt(0), 2);
  const titleHeight = titleLines.length * lineHeight;
  const statsSize = record ? 50 : 58;
  const total =
    (branded ? brandHeight + 26 : 0) + lead + 24 + titleHeight + 16 + statsRowHeight(statsSize);
  let y = cy - total / 2 - (record ? 26 : 10);

  if (branded) {
    drawBrand(ctx, palette, cx, y, brandHeight, true);
    y += brandHeight + 26;
  }

  if (record) {
    const cellHeight = cellWidth * HEX_TALL;
    fillCell(ctx, cx, y + cellHeight / 2, cellWidth, palette);
    recordDot(ctx, cx, y + cellHeight * 0.2, 14, palette.white);
    ctx.fillStyle = palette.fillInk;
    const valueSize = Math.round(cellWidth * (record.reps ? 0.25 : 0.28));
    if (record.value) {
      const value = fitText(ctx, record.value, cellWidth - 40, 700, valueSize);
      const lift = record.reps ? valueSize * 0.18 : valueSize * 0.36;
      ctx.fillText(value, cx, y + cellHeight / 2 + lift);
      if (record.reps) {
        setText(ctx, font(600, Math.round(valueSize * 0.62)), 0);
        ctx.fillText(record.reps, cx, y + cellHeight / 2 + valueSize * 1.02);
      }
    } else {
      setText(ctx, font(400, Math.round(cellWidth * 0.4)), 0);
      ctx.fillText('🏆', cx, y + cellHeight / 2 + cellWidth * 0.14);
    }
    y += cellHeight + 12;
    ctx.fillStyle = palette.accent;
    setText(ctx, font(600, 30), 0);
    ctx.fillText(fit(ctx, record.exercise, badgeWidthAt(y + 28 - cy)), cx, y + 28);
    y += 38;
  } else {
    y += drawSmallHive(ctx, cx, y, hiveCell, palette);
  }

  y += 24;
  ctx.fillStyle = palette.ink;
  setText(ctx, font(800, titleSize, 'Poppins'), 0);
  titleLines.forEach((line, i) => ctx.fillText(line, cx, y + titleSize * 0.88 + i * lineHeight));
  y += titleHeight + 16;

  const statsBottom = y + statsRowHeight(statsSize) - cy;
  drawStatsRow(ctx, content.stats, palette, cx, y, badgeWidthAt(statsBottom) + 40, statsSize);

  if (branded) drawLinkPill(ctx, content.link, palette, cx, cy + height / 2 + 36);
}

/** The person's link in a pill under the branded sticker. */
function drawLinkPill(
  ctx: CanvasRenderingContext2D,
  link: string,
  palette: CardPalette,
  cx: number,
  top: number,
): void {
  setText(ctx, font(600, 36), 0);
  const label = fit(ctx, link, STICKER_WIDTH - 140);
  const width = ctx.measureText(label).width + 72;
  const height = 76;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, cx - width / 2, top, width, height, height / 2);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = palette.accent;
  ctx.fillText(label, cx, top + 50);
}

const CELL_WIDTH = 250;
const CELL_GAP = 12;
/** The middle cell's name: this face, down to the floor for a long word. */
const TITLE_CELL_FACE = 42;
const TITLE_CELL_FLOOR = 30;
/** Between the middle cell's ring and its words. */
const TITLE_CELL_AIR = 12;

function drawCellsSticker(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
): void {
  const cx = STICKER_WIDTH / 2;
  const height = CELL_WIDTH * HEX_TALL;
  const stepX = CELL_WIDTH + CELL_GAP;
  const stepY = height * 0.75 + CELL_GAP * 0.866;
  const top = (STICKER_HEIGHT - (height + stepY * 2)) / 2;
  for (const cell of stickerCells(content)) {
    drawStickerCell(ctx, cell, palette, cx + cell.x * stepX, top + height / 2 + cell.y * stepY);
  }
}

/**
 * A soft edge in the theme's border colour: a cell on a Story of the same
 * colour (navy on navy) would otherwise lose its shape.
 */
function ringCell(ctx: CanvasRenderingContext2D, x: number, y: number, palette: CardPalette): void {
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = withAlpha(palette.border, 0.45);
  ctx.lineWidth = 4;
  ctx.stroke(hexPath(x, y, CELL_WIDTH - 4));
}

function drawStickerCell(
  ctx: CanvasRenderingContext2D,
  cell: StickerCell,
  palette: CardPalette,
  x: number,
  y: number,
): void {
  const height = CELL_WIDTH * HEX_TALL;
  const inner = CELL_WIDTH - 44;
  ctx.save();
  if (cell.kind !== StickerCellKinds.Ghost) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
  }
  switch (cell.kind) {
    case StickerCellKinds.Record:
      fillCell(ctx, x, y, CELL_WIDTH, palette);
      break;
    case StickerCellKinds.Title:
      ctx.fillStyle = palette.border;
      ctx.fill(hexPath(x, y, CELL_WIDTH));
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = palette.card;
      ctx.fill(hexPath(x, y, CELL_WIDTH - 12));
      break;
    case StickerCellKinds.Streak:
      ctx.fillStyle = palette.streakFace;
      ctx.fill(hexPath(x, y, CELL_WIDTH));
      ringCell(ctx, x, y, palette);
      break;
    case StickerCellKinds.Ghost:
      ctx.fillStyle = palette.ghostFace;
      ctx.fill(hexPath(x, y, CELL_WIDTH));
      break;
    default:
      ctx.fillStyle = palette.card;
      ctx.fill(hexPath(x, y, CELL_WIDTH));
      ringCell(ctx, x, y, palette);
  }
  ctx.restore();
  if (cell.kind === StickerCellKinds.Ghost) return;

  const onFill = cell.kind === StickerCellKinds.Record;
  const ink = onFill ? palette.fillInk : palette.ink;
  if (cell.kind === StickerCellKinds.Title) {
    // A word wider than the cell ("Antrenament") shrinks the face until it
    // fits, and a smaller face has room for a third line inside the cell's
    // upright sides. The lines sit where the ringed face is at its full
    // width, so they may use it, less a little air inside the ring. The
    // step follows the face.
    ctx.fillStyle = ink;
    const width = CELL_WIDTH - 12 - TITLE_CELL_AIR * 2;
    const size = titleFace(ctx, cell.value, width, TITLE_CELL_FACE, TITLE_CELL_FLOOR);
    const step = Math.round(size * 1.14);
    const lines = wrap(ctx, cell.value, width, size < TITLE_CELL_FACE ? 3 : 2);
    const first = y + size * 0.36 - ((lines.length - 1) * step) / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, first + i * step));
    return;
  }
  if (onFill) recordDot(ctx, x, y - height * 0.3, 14, palette.white);
  ctx.fillStyle = ink;
  ctx.fillText(fitText(ctx, cell.value, inner, 700, 50), x, y + 8);
  ctx.fillStyle = onFill ? palette.fillInk : palette.muted;
  setText(ctx, font(600, 26), 0);
  // A stat's label reads as running text; a record's is an exercise's name.
  const text = onFill ? cell.label : cell.label.toLocaleLowerCase();
  const label = wrap(ctx, text, inner, 2);
  label.forEach((line, i) => ctx.fillText(line, x, y + 46 + i * 30));
}

// ─── The Quick Story, as it will look ─────────────────────────────────────

/** The sticker's width on the Story preview: about where Instagram first places it. */
const STORY_STICKER_WIDTH = 760;

/**
 * The Story the Quick way makes: the photo, or the theme's two colours,
 * with the sticker in the middle. The same picture goes to the share
 * sheet when Instagram is not there.
 */
export function drawQuickStory(
  ctx: CanvasRenderingContext2D,
  sticker: CanvasImageSource,
  palette: CardPalette,
  photo: CanvasImageSource | null,
): void {
  drawStoryBackground(ctx, palette, photo);
  const height = STORY_STICKER_WIDTH * (STICKER_HEIGHT / STICKER_WIDTH);
  ctx.drawImage(
    sticker,
    CENTER - STORY_STICKER_WIDTH / 2,
    CARD_HEIGHT * 0.47 - height / 2,
    STORY_STICKER_WIDTH,
    height,
  );
}

/** A Story's background: the photo, cropped to fill, or the theme's gradient. */
export function drawStoryBackground(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  photo: CanvasImageSource | null,
): void {
  if (photo) {
    drawCover(ctx, photo, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  gradient.addColorStop(0, palette.storyTop);
  gradient.addColorStop(1, palette.storyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

// ─── The Full card ─────────────────────────────────────────────────────────

/**
 * The branded card: the logo, the workout, the numbers and the person's
 * link. On the hive (the theme's colour with a faint honeycomb) or with
 * the photo on top and the theme's colour under it.
 */
export function drawFullCard(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  photo: CanvasImageSource | null,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (photo) drawPhotoCard(ctx, content, palette, photo);
  else drawHiveCard(ctx, content, palette);
}

const FULL_TEXT_WIDTH = 900;
/** Where the link sits, on the last line the Story's own chrome leaves free. */
const LINK_BASELINE = SAFE_BOTTOM - 10;

/** The text under the lead: title, subtitle, numbers and the coach. */
interface FullText {
  lines: string[];
  lineHeight: number;
  titleSize: number;
  statsSize: number;
  height: number;
}

function measureFullText(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  size: number,
  statsSize: number,
): FullText {
  const titleSize = titleFace(ctx, content.title, FULL_TEXT_WIDTH, size, Math.round(size * 0.66));
  const lines = wrap(ctx, content.title, FULL_TEXT_WIDTH, 2);
  const lineHeight = Math.round(titleSize * 1.12);
  const height =
    lines.length * lineHeight +
    (content.subtitle ? 62 : 0) +
    48 +
    statsRowHeight(statsSize) +
    (content.coach ? 62 : 0);
  return { lines, lineHeight, titleSize, statsSize, height };
}

function drawFullText(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  text: FullText,
  top: number,
): void {
  let y = top;
  ctx.fillStyle = palette.ink;
  setText(ctx, font(800, text.titleSize, 'Poppins'), 0);
  text.lines.forEach((line, i) =>
    ctx.fillText(line, CENTER, y + text.titleSize * 0.92 + i * text.lineHeight),
  );
  y += text.lines.length * text.lineHeight;
  if (content.subtitle) {
    ctx.fillStyle = palette.muted;
    setText(ctx, font(500, 38), 0);
    ctx.fillText(fit(ctx, content.subtitle, FULL_TEXT_WIDTH), CENTER, y + 50);
    y += 62;
  }
  y += 48;
  y += drawStatsRow(ctx, content.stats, palette, CENTER, y, FULL_TEXT_WIDTH, text.statsSize);
  if (content.coach) {
    ctx.fillStyle = palette.muted;
    setText(ctx, font(500, 36), 0);
    ctx.fillText(fit(ctx, content.coach, FULL_TEXT_WIDTH), CENTER, y + 52);
  }
}

function drawLink(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
): void {
  ctx.fillStyle = palette.accent;
  setText(ctx, font(600, 42), 0);
  ctx.fillText(fit(ctx, content.link, FULL_TEXT_WIDTH), CENTER, LINK_BASELINE);
}

/** "New record" over the exercise, then the big poured cell with the kilograms. */
const RECORD_CELL = 270;

function recordBlockHeight(): number {
  return 56 + RECORD_CELL * HEX_TALL;
}

function drawRecordBlock(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  top: number,
): void {
  const record = content.record;
  if (!record) return;
  ctx.fillStyle = palette.accent;
  setText(ctx, font(600, 36), 0);
  ctx.fillText(fit(ctx, `${record.title} · ${record.exercise}`, FULL_TEXT_WIDTH), CENTER, top + 30);
  const cellHeight = RECORD_CELL * HEX_TALL;
  const cy = top + 56 + cellHeight / 2;
  fillCell(ctx, CENTER, cy, RECORD_CELL, palette);
  recordDot(ctx, CENTER, cy - cellHeight * 0.3, 20, palette.white);
  ctx.fillStyle = palette.fillInk;
  if (record.value) {
    const value = fitText(ctx, record.value, RECORD_CELL - 50, 700, record.reps ? 64 : 72);
    ctx.fillText(value, CENTER, cy + (record.reps ? 10 : 26));
    if (record.reps) {
      setText(ctx, font(600, 42), 0);
      ctx.fillText(record.reps, CENTER, cy + 66);
    }
  } else {
    setText(ctx, font(400, 110), 0);
    ctx.fillText('🏆', CENTER, cy + 40);
  }
}

function drawHiveCard(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
): void {
  ctx.fillStyle = palette.card;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (palette.glow) {
    const glow = ctx.createRadialGradient(CENTER, 760, 0, CENTER, 760, 1000);
    glow.addColorStop(0, palette.glow);
    glow.addColorStop(1, withAlpha(palette.card, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }
  drawHoneycomb(ctx, palette.pattern);
  drawBrand(ctx, palette, 80, SAFE_TOP + 10, 64, false);

  // Between the logo and the link, centred; a long name gives up size first.
  const areaTop = SAFE_TOP + 140;
  const areaBottom = LINK_BASELINE - 110;
  const lead = content.record ? recordBlockHeight() : smallHiveHeight(96);
  let text = measureFullText(ctx, content, 104, 84);
  if (lead + 60 + text.height > areaBottom - areaTop) text = measureFullText(ctx, content, 88, 72);
  const block = lead + 60 + text.height;
  const top = Math.max(areaTop, (areaTop + areaBottom) / 2 - block / 2);

  if (content.record) drawRecordBlock(ctx, content, palette, top);
  else drawSmallHive(ctx, CENTER, top, 96, palette);
  drawFullText(ctx, content, palette, text, top + lead + 60);
  drawLink(ctx, content, palette);
}

/** A faint honeycomb of the app's hexagon over the whole card. */
function drawHoneycomb(ctx: CanvasRenderingContext2D, color: string): void {
  const width = 120;
  const height = width * HEX_TALL;
  const stepY = height * 0.75;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let row = -1; row * stepY < CARD_HEIGHT + height; row++) {
    const offset = row % 2 === 0 ? 0 : width / 2;
    for (let x = -width + offset; x < CARD_WIDTH + width; x += width) {
      ctx.stroke(hexPath(x, row * stepY, width - 6));
    }
  }
  ctx.restore();
}

/**
 * The photo above, the theme's colour below it: the panel is as tall as
 * what it holds, so the photo keeps as much of the card as it can.
 */
function drawPhotoCard(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  photo: CanvasImageSource,
): void {
  const chip = content.record ? 100 : 0;
  let text = measureFullText(ctx, content, 88, 76);
  if (chip + text.height > 640) text = measureFullText(ctx, content, 76, 66);
  const panelTop = Math.min(1100, LINK_BASELINE - 100 - text.height - chip - 70);

  drawCover(ctx, photo, 0, 0, CARD_WIDTH, panelTop + 80);
  drawBrandPill(ctx, palette, 64, SAFE_TOP - 10, false);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 40;
  roundRect(ctx, 0, panelTop, CARD_WIDTH, CARD_HEIGHT - panelTop + 80, 64);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();

  let y = panelTop + 70;
  const record = content.record;
  if (record) {
    const text = `🏆 ${[record.exercise, record.value, record.reps].filter(Boolean).join(' ')}`;
    setText(ctx, font(600, 34), 0);
    const label = fit(ctx, text, FULL_TEXT_WIDTH - 80);
    const chipWidth = ctx.measureText(label).width + 64;
    roundRect(ctx, CENTER - chipWidth / 2, y, chipWidth, 68, 34);
    ctx.fillStyle = palette.fill;
    ctx.fill();
    ctx.fillStyle = palette.fillInk;
    ctx.fillText(label, CENTER, y + 46);
    y += chip;
  }
  drawFullText(ctx, content, palette, text, y);
  drawLink(ctx, content, palette);
}
