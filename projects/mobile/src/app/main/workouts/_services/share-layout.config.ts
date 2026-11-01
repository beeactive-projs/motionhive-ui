import {
  HexShape,
  brandEdgeDash,
  combStep,
  hexInset,
  hexSize,
  hexWidthAt,
} from '../../../_shared/config/hexagon.config';
import { ShareCardContent, ShareStat } from './share-card.config';

/**
 * Where everything on a share image goes (design "Share v3", 3 to 7): the
 * Quick Badge, the Quick Cells and the Full card, laid out in canvas
 * pixels from what the image says (`shareCardContent`) and a `measure`
 * that reads widths in the real faces. Pure, so the drop order and the
 * fits are tested without a canvas (`share-layout.config.spec.ts`).
 *
 * A layout is a list of `Paint`s: shapes, text and marks with a role for
 * their colour, never a colour. `share-card.ts` maps the roles to a
 * theme's paint and draws them; nothing here touches a canvas. Every
 * hexagon's size comes from `hexagon.config`, in the shape the person
 * chose.
 */

// ─── Canvas sizes ──────────────────────────────────────────────────────────

/** A story is 9:16 at 1080 wide, the size Instagram and Facebook take as is. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
/**
 * The Quick sticker's own canvas (transparent around it): 840 wide, as the
 * design draws it, and tall enough for the Badge with every detail on and
 * room for its shadow.
 */
export const STICKER_WIDTH = 840;
export const STICKER_HEIGHT = 1160;
/** The Full way's sticker: the Badge with the logo above it and the link under it. */
export const BRANDED_STICKER_HEIGHT = 1400;

// ─── Type ──────────────────────────────────────────────────────────────────

/** The app ships Inter and Poppins only; the images use both and nothing else. */
export type FontFamily = 'Inter' | 'Poppins';

export interface FontSpec {
  family: FontFamily;
  weight: number;
  size: number;
}

/** How wide a string draws in a face, read off the real font after it loads. */
export type Measure = (text: string, font: FontSpec) => number;

const inter = (weight: number, size: number): FontSpec => ({ family: 'Inter', weight, size });
/** Names and big numbers: Poppins at its display weight. */
const display = (size: number): FontSpec => ({ family: 'Poppins', weight: 800, size });

/** Every face the images use, for loading them before the first draw. */
export const SHARE_FONTS: readonly FontSpec[] = [display(84), inter(500, 30), inter(600, 30)];

/**
 * Where a line's baseline sits in a box `leading` × size tall, so the
 * letters look centred in it (a cap height is about 0.72 of the size).
 */
function baseline(top: number, font: FontSpec, leading: number): number {
  return top + (font.size * leading) / 2 + font.size * 0.36;
}

// ─── What gets painted ─────────────────────────────────────────────────────

/** A colour by what it is for; `share-card.ts` gives each theme's paint. */
export type PaintRole =
  | 'surface'
  | 'detailsCard'
  | 'ink'
  | 'muted'
  | 'accent'
  | 'lines'
  | 'honey'
  | 'honeyInk'
  | 'honeyMuted'
  | 'chip'
  | 'tile'
  | 'weekEmpty'
  | 'dot'
  | 'white'
  | 'pill'
  | 'pillInk';

/** A hexagon standing on a point, by its box's top left and width. */
export interface HexBox {
  kind: 'hex';
  x: number;
  y: number;
  w: number;
}

/** A hexagon, or a rounded box. */
export type Shape = HexBox | { kind: 'box'; x: number; y: number; w: number; h: number; r: number };

export type TextAlign = 'left' | 'center' | 'right';

export interface TextPaint {
  kind: 'text';
  text: string;
  x: number;
  /** The baseline. */
  y: number;
  font: FontSpec;
  role: PaintRole;
  align: TextAlign;
}

export type Paint =
  /** One shadow under all the shapes together, as the design's drop shadow on the group. */
  | { kind: 'shadow'; shapes: Shape[] }
  /** A filled shape; `glow` adds the theme's light inside it. */
  | { kind: 'fill'; shape: Shape; role: PaintRole; glow?: boolean }
  /** A line drawn inside a shape's edge. */
  | { kind: 'ring'; shape: Shape; role: PaintRole; width: number }
  /** The medal's open hexagon edge, broken in two places like the logo. */
  | {
      kind: 'brandEdge';
      shape: HexBox;
      role: PaintRole;
      width: number;
      dash: number[];
      offset: number;
    }
  | TextPaint
  /** An emoji centred on (x, y). */
  | { kind: 'emoji'; text: string; x: number; y: number; size: number }
  | { kind: 'rule'; x: number; y: number; w: number; role: PaintRole; width: number }
  | { kind: 'dot'; x: number; y: number; r: number; role: PaintRole }
  /** The location pin, `size` square, its top left at (x, y). */
  | { kind: 'pin'; x: number; y: number; size: number; role: PaintRole }
  /** The logo mark, `h` tall, its top left at (x, y). */
  | { kind: 'mark'; x: number; y: number; h: number; role: PaintRole }
  /** The Full card's background: the theme's colour and its light. */
  | { kind: 'backdrop'; w: number; h: number }
  /** The Full card's photo, edge to edge, darkening to the theme's colour. */
  | { kind: 'photo'; w: number; h: number; fadeTop: number }
  /** The band of honeycomb at the top of a Full card without a photo. */
  | { kind: 'comb'; x: number; y: number; w: number; h: number };

export interface ShareLayout {
  width: number;
  height: number;
  paints: Paint[];
  /** Everything fits the canvas, measured, with nothing cut that may not be. */
  fits: boolean;
  /** What was left out to fit, in the order it went. */
  dropped: string[];
}

/** What every part of a layout needs: the real faces' widths and the person's hexagon. */
interface Kit {
  measure: Measure;
  shape: HexShape;
}

/** A part of a layout: its height, and its paints once it is given a top. */
interface Block {
  height: number;
  paint: (top: number) => Paint[];
}

function textPaint(
  text: string,
  x: number,
  y: number,
  font: FontSpec,
  role: PaintRole,
  align: TextAlign,
): TextPaint {
  return { kind: 'text', text, x, y, font, role, align };
}

/** A hexagon `w` wide whose centre is at (cx, cy). */
function hexAt(kit: Kit, cx: number, cy: number, w: number): HexBox {
  return { kind: 'hex', x: cx - w / 2, y: cy - hexSize(kit.shape, w).height / 2, w };
}

// ─── Text that fits ────────────────────────────────────────────────────────

/** Shortens with an ellipsis until it fits; a line that fits is left alone. */
export function fitLine(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  // By character, not code unit: an emoji is two units and half of one
  // draws as a box.
  const chars = Array.from(text);
  while (chars.length > 1 && measure(`${chars.join('')}…`) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/**
 * Word-wraps into at most `maxLines` and fits every line to `maxWidth`:
 * the last one ellipsised when words are left over, and any line holding
 * a word wider than the line ellipsised too, so nothing runs past the
 * shape it is drawn in.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (text: string) => number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let next = 0;
  while (next < words.length && lines.length < maxLines - 1) {
    let line = words[next++];
    while (next < words.length && measure(`${line} ${words[next]}`) <= maxWidth) {
      line = `${line} ${words[next++]}`;
    }
    lines.push(line);
  }
  if (next < words.length) lines.push(words.slice(next).join(' '));
  return lines.map((line) => fitLine(line, maxWidth, measure));
}

/**
 * A name in the first face of `sizes` (largest first) in which it wraps
 * into `maxLines` without a cut; else the smallest, clamped with an
 * ellipsis ("shrink one step, then the clamp"). `startSmall` skips the
 * first step: the Badge starts names over 30 characters a step down.
 */
export function fitName(
  text: string,
  maxWidth: number,
  maxLines: number,
  sizes: readonly number[],
  measure: Measure,
  startSmall = false,
): { font: FontSpec; lines: string[] } {
  const faces = startSmall && sizes.length > 1 ? sizes.slice(1) : sizes;
  let fitted = { font: display(faces[0]), lines: [] as string[] };
  for (const size of faces) {
    const font = display(size);
    const lines = wrapLines(text, maxWidth, maxLines, (value) => measure(value, font));
    fitted = { font, lines };
    if (!lines.some((line) => line.endsWith('…'))) break;
  }
  return fitted;
}

/**
 * The largest face, from `size` down to `floor` in steps of 2, at which the
 * text's longest word fits `maxWidth` ("Antrenament" in a cell): a title
 * gets smaller before a word gets cut. The floor when nothing fits; the
 * ellipsis takes it from there.
 */
export function faceForWords(
  text: string,
  maxWidth: number,
  size: number,
  floor: number,
  measureAt: (text: string, size: number) => number,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let current = size;
  while (current > floor && words.some((word) => measureAt(word, current) > maxWidth)) {
    current = Math.max(floor, current - 2);
  }
  return current;
}

/** The largest face up to `font` in which the text fits, down to `floor`. */
function fitFace(
  text: string,
  maxWidth: number,
  font: FontSpec,
  floor: number,
  measure: Measure,
): FontSpec {
  let size = font.size;
  while (size > floor && measure(text, { ...font, size }) > maxWidth) size -= 2;
  return { ...font, size };
}

/** A number is better smaller than cut: down to two thirds of its face. */
function fitNumber(text: string, maxWidth: number, font: FontSpec, measure: Measure): FontSpec {
  return fitFace(text, maxWidth, font, Math.round(font.size * 0.66), measure);
}

/** "9 sets · 4,280 kg volume": a line of numbers. */
export function statsLine(stats: readonly ShareStat[]): string {
  return stats.map((stat) => `${stat.value} ${stat.label}`).join(' · ');
}

// ─── The drop order ────────────────────────────────────────────────────────

/**
 * One step of a drop order: the content with one thing less, or null when
 * there is nothing to drop. A step that changes how a thing is laid out
 * rather than what is said (the Full card's location down to one line)
 * hands the content back unchanged; the layout reads it from `dropped`.
 */
export interface DropStep {
  name: string;
  drop: (content: ShareCardContent) => ShareCardContent | null;
}

const fewerExercises = (to: number): DropStep => ({
  name: `exercises:${to}`,
  drop: (c) => (c.exercises.length > to ? { ...c, exercises: c.exercises.slice(0, to) } : null),
});

const without = (key: 'location' | 'feeling' | 'coach' | 'streak' | 'number'): DropStep => ({
  name: key,
  drop: (c) => (c[key] ? { ...c, [key]: null } : null),
});

const SECOND_STAT: DropStep = {
  name: 'stat:2',
  drop: (c) => (c.stats.length > 1 ? { ...c, stats: c.stats.slice(0, 1) } : null),
};

const LOCATION_ONE_LINE: DropStep = {
  name: 'location:1',
  drop: (c) => (c.location ? c : null),
};

/**
 * What goes first when a sticker or card runs out of room (design "Share
 * v3", 6). The name, the duration, the record and the link never do.
 */
export const DROP_ORDER: Readonly<Record<'badge' | 'cells' | 'full', readonly DropStep[]>> = {
  badge: [
    fewerExercises(2),
    fewerExercises(1),
    fewerExercises(0),
    without('location'),
    without('feeling'),
    without('coach'),
    without('streak'),
    SECOND_STAT,
  ],
  cells: [
    fewerExercises(2),
    fewerExercises(0),
    without('location'),
    without('feeling'),
    without('coach'),
    without('streak'),
    without('number'),
  ],
  // Exercises 3 → 2, never none; the place down to one line; the feeling.
  full: [fewerExercises(2), LOCATION_ONE_LINE, without('feeling')],
};

/**
 * Lays out, and drops in order until it fits. A step with nothing to drop
 * is passed over; when the order runs out the last try stands, with
 * `fits` false.
 */
export function fitInOrder(
  content: ShareCardContent,
  order: readonly DropStep[],
  build: (content: ShareCardContent, dropped: readonly string[]) => ShareLayout,
  dropped: string[] = [],
): ShareLayout {
  let current = content;
  let layout = build(current, dropped);
  for (const step of order) {
    if (layout.fits) break;
    const next = step.drop(current);
    if (!next) continue;
    current = next;
    dropped.push(step.name);
    layout = build(current, dropped);
  }
  return { ...layout, dropped };
}

// ─── Quick · Badge ─────────────────────────────────────────────────────────

const BADGE = {
  medal: 577,
  edge: 14,
  /** Text never runs closer than this to the medal's sides. */
  padX: 73,
  card: 739,
  overlap: 62,
  radius: 50,
  padTop: 73,
  padSide: 39,
  padBottom: 34,
  gap: 22,
  ring: 2.8,
  feeling: 62,
  /** Room kept above and below for the shadow. */
  margin: 50,
} as const;

const BADGE_INNER = BADGE.card - BADGE.padSide * 2;
const BADGE_LEFT = (STICKER_WIDTH - BADGE_INNER) / 2;

const KICKER = inter(600, 22);
const STATS = inter(600, 28);
const DURATION = display(84);
const UNIT = inter(600, 34);
const CHIP_TEXT = inter(600, 28);
const ROW = inter(500, 28);
const ROW_BEST = inter(600, 28);
const FOOT = inter(500, 22);

/**
 * The medal with its details card under it (design "Share v3", 3): the
 * date, the name, the duration and the numbers in the medal; the record,
 * the exercises and the footer in the card. The medal alone when the card
 * would be empty. `branded` adds the logo above and the link under it,
 * for the Full way's sticker; the Quick sticker never carries either.
 */
export function badgeLayout(
  content: ShareCardContent,
  measure: Measure,
  shape: HexShape,
  branded = false,
): ShareLayout {
  const kit: Kit = { measure, shape };
  // A line that may not be cut is made to fit first, by the one thing
  // that shortens it: the streak (the number stays), the second stat.
  const dropped: string[] = [];
  let fitted = content;
  if (fitted.streak && !footerNumberFits(fitted, measure)) {
    fitted = { ...fitted, streak: null };
    dropped.push('streak');
  }
  if (fitted.stats.length > 1 && medalBlock(fitted, kit, 0).overflow) {
    fitted = { ...fitted, stats: fitted.stats.slice(0, 1) };
    dropped.push('stat:2');
  }
  return fitInOrder(fitted, DROP_ORDER.badge, (c) => buildBadge(c, kit, branded), dropped);
}

function footerNumberLine(c: ShareCardContent): string {
  return [c.number?.line, c.streak?.line].filter(Boolean).join(' · ');
}

function footerWidth(c: ShareCardContent): number {
  return c.feeling ? BADGE_INNER - BADGE.feeling - 22 : BADGE_INNER;
}

function footerNumberFits(c: ShareCardContent, measure: Measure): boolean {
  const line = footerNumberLine(c);
  return !line || measure(line, FOOT) <= footerWidth(c);
}

function buildBadge(c: ShareCardContent, kit: Kit, branded: boolean): ShareLayout {
  const canvasHeight = branded ? BRANDED_STICKER_HEIGHT : STICKER_HEIGHT;
  const cx = STICKER_WIDTH / 2;
  const medalHeight = hexSize(kit.shape, BADGE.medal).height;
  const card = badgeCard(c, kit);
  const brand = branded ? brandPill(kit, STICKER_WIDTH / 2, 88, 36, 48, true) : null;
  const link = branded && c.link ? linkPill(c.link, kit) : null;

  const total =
    (brand ? brand.height + 24 : 0) +
    medalHeight +
    (card ? card.height - BADGE.overlap : 0) +
    (link ? 24 + link.height : 0);
  // The canvas hugs what is on it, so a detail switched off takes its room
  // with it; the tallest is the canvas with everything on. A little above
  // the middle: the shadow falls below.
  const height = Math.min(canvasHeight, total + BADGE.margin * 2);
  const top = Math.max(0, (height - total) / 2 - 10);
  const medalTop = top + (brand ? brand.height + 24 : 0);
  const medal: HexBox = { kind: 'hex', x: cx - BADGE.medal / 2, y: medalTop, w: BADGE.medal };
  const cardTop = medalTop + medalHeight - BADGE.overlap;
  const cardShape: Shape | null = card
    ? {
        kind: 'box',
        x: cx - BADGE.card / 2,
        y: cardTop,
        w: BADGE.card,
        h: card.height,
        r: BADGE.radius,
      }
    : null;

  const paints: Paint[] = [{ kind: 'shadow', shapes: cardShape ? [medal, cardShape] : [medal] }];
  if (card && cardShape) {
    paints.push({ kind: 'fill', shape: cardShape, role: 'detailsCard' });
    paints.push({ kind: 'ring', shape: cardShape, role: 'lines', width: BADGE.ring });
    paints.push(...card.paint(cardTop));
  }
  // The medal over the card, so its lower point sits on it.
  const inMedal = medalBlock(c, kit, medalTop);
  paints.push({ kind: 'fill', shape: medal, role: 'surface', glow: true });
  const edge = hexInset(kit.shape, medal.x, medal.y, medal.w, BADGE.edge / 2);
  paints.push({
    kind: 'brandEdge',
    shape: { kind: 'hex', x: edge.x, y: edge.y, w: edge.width },
    role: 'honey',
    width: BADGE.edge,
    ...brandEdgeDash(kit.shape, edge.width),
  });
  paints.push(...inMedal.paints);
  if (brand) paints.push(...brand.paint(top));
  const bottom = card ? cardTop + card.height : medalTop + medalHeight;
  if (link) paints.push(...link.paint(bottom + 24));

  return {
    width: STICKER_WIDTH,
    height,
    paints,
    fits: total <= canvasHeight - BADGE.margin * 2 && !inMedal.overflow,
    dropped: [],
  };
}

/**
 * What is in the medal, centred on it: date, name, duration, numbers.
 * Every line is kept to the medal's width where it sits, which narrows
 * toward the points; `overflow` says the numbers' line could not be.
 */
function medalBlock(
  c: ShareCardContent,
  kit: Kit,
  medalTop: number,
): { paints: Paint[]; overflow: boolean } {
  const { measure, shape } = kit;
  const medalHeight = hexSize(shape, BADGE.medal).height;
  const room = (from: number, to: number) =>
    Math.min(hexWidthAt(shape, BADGE.medal, from), hexWidthAt(shape, BADGE.medal, to)) -
    BADGE.padX * 2;
  const full = BADGE.medal - BADGE.padX * 2;
  const long = Array.from(c.title).length > 30;
  const kicker = c.date ? KICKER.size * 1.3 + 14 : 0;
  const after =
    (c.duration ? 22 + DURATION.size : 0) + (c.stats.length ? 8 + STATS.size * 1.25 : 0);
  const startOf = (lines: number, size: number) =>
    (medalHeight - (kicker + lines * size * 1.18 + after)) / 2;

  // Wrapped at the full width, placed, then wrapped again at the narrowest
  // width its lines actually sit at.
  let name = fitName(c.title, full, 3, [50, 42], measure, long);
  let start = startOf(name.lines.length, name.font.size);
  const nameTop = start + kicker;
  const narrowest = room(nameTop, nameTop + name.lines.length * name.font.size * 1.18);
  if (narrowest < full) {
    name = fitName(c.title, narrowest, 3, [50, 42], measure, long);
    start = startOf(name.lines.length, name.font.size);
  }

  const cx = STICKER_WIDTH / 2;
  const paints: Paint[] = [];
  let y = start;
  let overflow = false;
  if (c.date) {
    const text = fitLine(c.date, room(y, y + KICKER.size * 1.3), (v) => measure(v, KICKER));
    paints.push(
      textPaint(text, cx, medalTop + baseline(y, KICKER, 1.3), KICKER, 'muted', 'center'),
    );
    y += kicker;
  }
  const lead = name.font.size * 1.18;
  name.lines.forEach((line, i) => {
    const at = medalTop + baseline(y + i * lead, name.font, 1.18);
    paints.push(textPaint(line, cx, at, name.font, 'ink', 'center'));
  });
  y += name.lines.length * lead;
  if (c.duration) {
    y += 22;
    const valueWidth = measure(c.duration.value, DURATION);
    const left = cx - (valueWidth + 8 + measure(c.duration.label, UNIT)) / 2;
    const at = medalTop + baseline(y, DURATION, 1);
    paints.push(textPaint(c.duration.value, left, at, DURATION, 'honey', 'left'));
    paints.push(textPaint(c.duration.label, left + valueWidth + 8, at, UNIT, 'muted', 'left'));
    y += DURATION.size;
  }
  if (c.stats.length) {
    y += 8;
    const line = statsLine(c.stats);
    overflow = measure(line, STATS) > room(y, y + STATS.size * 1.25);
    paints.push(textPaint(line, cx, medalTop + baseline(y, STATS, 1.25), STATS, 'muted', 'center'));
  }
  return { paints, overflow };
}

/** The details card under the medal, or null when it has nothing to hold. */
function badgeCard(c: ShareCardContent, kit: Kit): Block | null {
  const blocks: Block[] = [];
  if (c.record) blocks.push(recordChip(c.record, kit));
  if (c.exercises.length) {
    blocks.push(exerciseRows(c.exercises, kit, BADGE_LEFT, BADGE_INNER, ROW, ROW_BEST, 22, 11));
  }
  const footer = badgeFooter(c, kit);
  if (footer) blocks.push(footer);
  if (blocks.length === 0) return null;
  return {
    height: BADGE.padTop + stack(blocks, BADGE.gap) + BADGE.padBottom,
    paint: (top) => paintStack(blocks, top + BADGE.padTop, BADGE.gap),
  };
}

function stack(blocks: readonly Block[], gap: number): number {
  return (
    blocks.reduce((sum, block) => sum + block.height, 0) + gap * Math.max(0, blocks.length - 1)
  );
}

function paintStack(blocks: readonly Block[], top: number, gap: number): Paint[] {
  const paints: Paint[] = [];
  let y = top;
  for (const block of blocks) {
    paints.push(...block.paint(y));
    y += block.height + gap;
  }
  return paints;
}

/**
 * "Bench press 62.5 × 7" in `room`: the exercise's name is cut before the
 * set's numbers ever are.
 */
function recordText(
  record: NonNullable<ShareCardContent['record']>,
  room: number,
  measure: (text: string) => number,
): string {
  const best = record.best ? ` ${record.best}` : '';
  return `${fitLine(record.exercise, room - measure(best), measure)}${best}`;
}

/** A honey cell `w` wide centred on (cx, cy), with the record's dot when given one. */
function cell(
  kit: Kit,
  cx: number,
  cy: number,
  w: number,
  dot: PaintRole | null,
  role: PaintRole = 'honey',
): Paint[] {
  const paints: Paint[] = [{ kind: 'fill', shape: hexAt(kit, cx, cy, w), role }];
  if (dot) paints.push({ kind: 'dot', x: cx, y: cy, r: w * 0.125, role: dot });
  return paints;
}

/** "New record · Bench press 62.5 × 7" on a soft honey chip, a honey cell before it. */
function recordChip(record: NonNullable<ShareCardContent['record']>, kit: Kit): Block {
  const height = 90;
  const hexW = 45;
  return {
    height,
    paint: (top) => {
      const x = BADGE_LEFT;
      const title = `${record.title} · `;
      const titleWidth = kit.measure(title, CHIP_TEXT);
      const textX = x + 25 + hexW + 20;
      const room = BADGE_INNER - (textX - x) - 25 - titleWidth;
      const rest = recordText(record, room, (v) => kit.measure(v, CHIP_TEXT));
      const at = baseline(top + (height - CHIP_TEXT.size * 1.2) / 2, CHIP_TEXT, 1.2);
      return [
        {
          kind: 'fill',
          shape: { kind: 'box', x, y: top, w: BADGE_INNER, h: height, r: 28 },
          role: 'chip',
        },
        ...cell(kit, x + 25 + hexW / 2, top + height / 2, hexW, 'white'),
        textPaint(title, textX, at, CHIP_TEXT, 'accent', 'left'),
        textPaint(rest, textX + titleWidth, at, CHIP_TEXT, 'ink', 'left'),
      ];
    },
  };
}

/** Exercise rows: a honey cell, the name (cut if it must be), the best set on the right. */
function exerciseRows(
  exercises: ShareCardContent['exercises'],
  kit: Kit,
  x0: number,
  inner: number,
  font: FontSpec,
  bestFont: FontSpec,
  bullet: number,
  gap: number,
): Block {
  const row = font.size * 1.2;
  return {
    height: exercises.length * row + (exercises.length - 1) * gap,
    paint: (top) =>
      exercises.flatMap((exercise, i) => {
        const y = top + i * (row + gap);
        const best = exercise.best ?? '';
        const nameX = x0 + bullet + 20;
        const room = inner - (nameX - x0) - (best ? kit.measure(best, bestFont) + 20 : 0);
        const name = fitLine(exercise.name, room, (v) => kit.measure(v, font));
        const at = baseline(y, font, 1.2);
        const paints: Paint[] = [
          ...cell(kit, x0 + bullet / 2, y + row / 2, bullet, null),
          textPaint(name, nameX, at, font, 'ink', 'left'),
        ];
        if (best) paints.push(textPaint(best, x0 + inner, at, bestFont, 'muted', 'right'));
        return paints;
      }),
  };
}

/** The footer: number · streak, then the place and the coach; the feeling on the right. */
function badgeFooter(c: ShareCardContent, kit: Kit): Block | null {
  const numberLine = footerNumberLine(c);
  const second = !!(c.location || c.coach);
  if (!numberLine && !second && !c.feeling) return null;
  const lead = FOOT.size * 1.3;
  const lines = (numberLine ? 1 : 0) + (second ? 1 : 0);
  const column = lines * lead + (lines === 2 ? 6 : 0);
  const feelingHeight = c.feeling ? hexSize(kit.shape, BADGE.feeling).height : 0;
  const body = Math.max(column, feelingHeight);
  return {
    height: BADGE.ring + 20 + body,
    paint: (top) => {
      const x = BADGE_LEFT;
      const paints: Paint[] = [
        { kind: 'rule', x, y: top, w: BADGE_INNER, role: 'lines', width: BADGE.ring },
      ];
      const bodyTop = top + BADGE.ring + 20;
      let y = bodyTop + (body - column) / 2;
      if (numberLine) {
        paints.push(textPaint(numberLine, x, baseline(y, FOOT, 1.3), FOOT, 'muted', 'left'));
        y += lead + 6;
      }
      if (second) paints.push(...placeAndCoach(c, kit, x, y, footerWidth(c)));
      if (c.feeling) {
        const fx = x + BADGE_INNER - BADGE.feeling / 2;
        const cy = bodyTop + body / 2;
        paints.push(...cell(kit, fx, cy, BADGE.feeling, null));
        paints.push({ kind: 'emoji', text: c.feeling.glyph, x: fx, y: cy, size: 31 });
      }
      return paints;
    },
  };
}

/** The pin and the place (cut to one line), then the coach in full. */
function placeAndCoach(
  c: ShareCardContent,
  kit: Kit,
  x: number,
  top: number,
  room: number,
): Paint[] {
  const paints: Paint[] = [];
  const at = baseline(top, FOOT, 1.3);
  const coachWidth = c.coach ? kit.measure(c.coach, FOOT) : 0;
  let cursor = x;
  if (c.location) {
    const pin = 28;
    const space = room - pin - 8 - (c.coach ? coachWidth + 22 : 0);
    if (space > 60) {
      paints.push({
        kind: 'pin',
        x,
        y: top + (FOOT.size * 1.3 - pin) / 2,
        size: pin,
        role: 'muted',
      });
      const place = fitLine(c.location, space, (v) => kit.measure(v, FOOT));
      paints.push(textPaint(place, x + pin + 8, at, FOOT, 'muted', 'left'));
      cursor = x + pin + 8 + kit.measure(place, FOOT) + 22;
    }
  }
  if (c.coach) paints.push(textPaint(c.coach, cursor, at, FOOT, 'muted', 'left'));
  return paints;
}

/** The logo and the wordmark in a navy pill, at `x` (or centred on it). */
function brandPill(
  kit: Kit,
  x: number,
  height: number,
  wordSize: number,
  markHeight: number,
  centred: boolean,
): Block & { width: number } {
  const word = display(wordSize);
  const markWidth = (168 / 190) * markHeight;
  const padStart = height * 0.32;
  const width = padStart + markWidth + 20 + kit.measure('MotionHive', word) + height * 0.45;
  const left = centred ? x - width / 2 : x;
  return {
    width,
    height,
    paint: (top) => [
      {
        kind: 'fill',
        shape: { kind: 'box', x: left, y: top, w: width, h: height, r: height / 2 },
        role: 'pill',
      },
      {
        kind: 'mark',
        x: left + padStart,
        y: top + (height - markHeight) / 2,
        h: markHeight,
        role: 'honey',
      },
      textPaint(
        'MotionHive',
        left + padStart + markWidth + 20,
        baseline(top + (height - word.size * 1.2) / 2, word, 1.2),
        word,
        'pillInk',
        'left',
      ),
    ],
  };
}

/** The person's link in a pill of the card's colour, under the branded sticker. */
function linkPill(link: string, kit: Kit): Block {
  const font = inter(600, 34);
  const height = 80;
  const text = fitLine(link, STICKER_WIDTH - 160, (v) => kit.measure(v, font));
  const width = kit.measure(text, font) + 72;
  return {
    height,
    paint: (top) => {
      const shape: Shape = {
        kind: 'box',
        x: (STICKER_WIDTH - width) / 2,
        y: top,
        w: width,
        h: height,
        r: height / 2,
      };
      const at = baseline(top + (height - font.size * 1.2) / 2, font, 1.2);
      return [
        { kind: 'shadow', shapes: [shape] },
        { kind: 'fill', shape, role: 'detailsCard' },
        textPaint(text, STICKER_WIDTH / 2, at, font, 'accent', 'center'),
      ];
    },
  };
}

// ─── Quick · Cells ─────────────────────────────────────────────────────────

const CELLS = {
  pillMax: 756,
  pillPadY: 25,
  pillPadX: 39,
  pillRadius: 39,
  cell: 207,
  gap: 11,
  ring: 5.6,
  chipMax: 756,
  chipGap: 11,
  chipPadX: 22,
  chipPadY: 8,
  stack: 22,
  margin: 50,
} as const;

/** What a cell of the flower holds. */
export const CellKinds = { Stat: 'stat', Record: 'record', Feeling: 'feeling' } as const;
export type CellKind = (typeof CellKinds)[keyof typeof CellKinds];

export interface FlowerCell {
  kind: CellKind;
  value: string;
  label: string;
  /** Column in cell widths from the centre (-1 to 1), and row (0 to 2). */
  col: number;
  row: number;
}

/** The places around the middle, filled in this order (design "Share v3", 4). */
const AROUND: readonly (readonly [number, number])[] = [
  [-0.5, 0],
  [0.5, 0],
  [-1, 1],
  [1, 1],
  [-0.5, 2],
  [0.5, 2],
];

/**
 * The flower of the Cells sticker: the duration in the middle, then, in
 * order around it, stat 1, stat 2, the record (honey), the workout's
 * number, the streak and the feeling (honey, with its face). Without a
 * duration the first of them takes the middle.
 */
export function flowerCells(c: ShareCardContent): FlowerCell[] {
  const around: Omit<FlowerCell, 'col' | 'row'>[] = [
    ...c.stats.map((stat) => ({ kind: CellKinds.Stat, value: stat.value, label: stat.label })),
    ...(c.record
      ? [{ kind: CellKinds.Record, value: c.record.short, label: c.record.exercise }]
      : []),
    ...(c.number ? [{ kind: CellKinds.Stat, value: c.number.value, label: c.number.label }] : []),
    ...(c.streak ? [{ kind: CellKinds.Stat, value: c.streak.value, label: c.streak.label }] : []),
    ...(c.feeling
      ? [{ kind: CellKinds.Feeling, value: c.feeling.glyph, label: c.feeling.label }]
      : []),
  ];
  const middle = c.duration
    ? { kind: CellKinds.Stat, value: c.duration.value, label: c.duration.label }
    : around.shift();
  if (!middle) return [];
  return [
    { ...middle, col: 0, row: 1 },
    ...around
      .slice(0, AROUND.length)
      .map((entry, i) => ({ ...entry, col: AROUND[i][0], row: AROUND[i][1] })),
  ];
}

/** The Cells sticker: the name in a pill, the flower, the exercises as chips. */
export function cellsLayout(
  content: ShareCardContent,
  measure: Measure,
  shape: HexShape,
): ShareLayout {
  const kit: Kit = { measure, shape };
  return fitInOrder(content, DROP_ORDER.cells, (c) => buildCells(c, kit));
}

function buildCells(c: ShareCardContent, kit: Kit): ShareLayout {
  const cx = STICKER_WIDTH / 2;
  const pill = cellsPill(c, kit);
  const cells = flowerCells(c);
  const cellHeight = hexSize(kit.shape, CELLS.cell).height;
  const step = combStep(kit.shape, CELLS.cell, CELLS.gap);
  const rows = cells.map((entry) => entry.row);
  const minRow = rows.length ? Math.min(...rows) : 0;
  const maxRow = rows.length ? Math.max(...rows) : 0;
  const flowerHeight = cells.length ? cellHeight + (maxRow - minRow) * step.dy : 0;
  const chips = exerciseChips(c.exercises, kit);

  const total =
    pill.height +
    (cells.length ? CELLS.stack + flowerHeight : 0) +
    (chips.rows.length ? CELLS.stack + chips.height : 0);
  // Hugs what is on it, as the Badge does.
  const height = Math.min(STICKER_HEIGHT, total + CELLS.margin * 2);
  const top = Math.max(0, (height - total) / 2 - 10);
  const pillShape: Shape = {
    kind: 'box',
    x: cx - pill.width / 2,
    y: top,
    w: pill.width,
    h: pill.height,
    r: CELLS.pillRadius,
  };
  const flowerTop = top + pill.height + CELLS.stack;
  const hexes: HexBox[] = cells.map((entry) => ({
    kind: 'hex',
    x: cx + entry.col * step.dx - CELLS.cell / 2,
    y: flowerTop + (entry.row - minRow) * step.dy,
    w: CELLS.cell,
  }));
  const chipsTop = cells.length ? flowerTop + flowerHeight + CELLS.stack : flowerTop;
  const placed = chips.place(chipsTop);

  const paints: Paint[] = [
    { kind: 'shadow', shapes: [pillShape, ...hexes, ...placed.map((chip) => chip.shape)] },
    { kind: 'fill', shape: pillShape, role: 'surface' },
    { kind: 'ring', shape: pillShape, role: 'lines', width: BADGE.ring },
    ...pill.paint(top),
  ];
  cells.forEach((entry, i) => paints.push(...flowerCell(entry, hexes[i], kit)));
  for (const chip of placed) paints.push(...chip.paints);

  return {
    width: STICKER_WIDTH,
    height,
    paints,
    fits: total <= STICKER_HEIGHT - CELLS.margin * 2,
    dropped: [],
  };
}

const PILL_KICKER = inter(600, 22);
const PILL_COACH = inter(500, 22);

/** Date · place, the name (two lines at most), the coach: the pill hugs them. */
function cellsPill(c: ShareCardContent, kit: Kit): Block & { width: number } {
  const { measure } = kit;
  const room = CELLS.pillMax - CELLS.pillPadX * 2;
  const kicker = [c.date, c.location].filter(Boolean).join(' · ');
  const kickerText = kicker ? fitLine(kicker, room, (v) => measure(v, PILL_KICKER)) : '';
  const name = fitName(c.title, room, 2, [39, 33], measure);
  const coach = c.coach ? fitLine(c.coach, room, (v) => measure(v, PILL_COACH)) : '';
  const widest = Math.max(
    kickerText ? measure(kickerText, PILL_KICKER) : 0,
    ...name.lines.map((line) => measure(line, name.font)),
    coach ? measure(coach, PILL_COACH) : 0,
  );
  const lead = name.font.size * 1.2;
  const kickerLead = PILL_KICKER.size * 1.3;
  return {
    width: Math.min(CELLS.pillMax, widest + CELLS.pillPadX * 2),
    height:
      CELLS.pillPadY * 2 +
      (kickerText ? kickerLead + 6 : 0) +
      name.lines.length * lead +
      (coach ? kickerLead : 0),
    paint: (top) => {
      const cx = STICKER_WIDTH / 2;
      const paints: Paint[] = [];
      let y = top + CELLS.pillPadY;
      if (kickerText) {
        paints.push(
          textPaint(kickerText, cx, baseline(y, PILL_KICKER, 1.3), PILL_KICKER, 'muted', 'center'),
        );
        y += kickerLead + 6;
      }
      name.lines.forEach((line, i) => {
        paints.push(
          textPaint(line, cx, baseline(y + i * lead, name.font, 1.2), name.font, 'ink', 'center'),
        );
      });
      y += name.lines.length * lead;
      if (coach) {
        paints.push(
          textPaint(coach, cx, baseline(y, PILL_COACH, 1.3), PILL_COACH, 'muted', 'center'),
        );
      }
      return paints;
    },
  };
}

const CELL_VALUE = display(42);
const CELL_LABEL = inter(600, 22);

/** One cell: honey-ringed with a number, honey for the record, honey with the feeling's face. */
function flowerCell(entry: FlowerCell, hex: HexBox, kit: Kit): Paint[] {
  const { measure, shape } = kit;
  const cx = hex.x + hex.w / 2;
  const cy = hex.y + hexSize(shape, hex.w).height / 2;
  const paints: Paint[] = [{ kind: 'fill', shape: hex, role: 'honey' }];
  if (entry.kind === CellKinds.Feeling) {
    paints.push({ kind: 'emoji', text: entry.value, x: cx, y: cy, size: 73 });
    return paints;
  }
  const onHoney = entry.kind === CellKinds.Record;
  if (!onHoney) {
    const inner = hexInset(shape, hex.x, hex.y, hex.w, CELLS.ring);
    paints.push({
      kind: 'fill',
      shape: { kind: 'hex', x: inner.x, y: inner.y, w: inner.width },
      role: 'surface',
    });
  }
  const room = hex.w - 48;
  const value = fitNumber(entry.value, room, CELL_VALUE, measure);
  // A label a little smaller before it is cut ("de săpt. la rând").
  const labelFont = fitFace(entry.label, room, CELL_LABEL, 18, measure);
  const label = fitLine(entry.label, room, (v) => measure(v, labelFont));
  const top = cy - (value.size + 6 + CELL_LABEL.size * 1.2) / 2;
  paints.push(
    textPaint(
      entry.value,
      cx,
      baseline(top, value, 1),
      value,
      onHoney ? 'honeyInk' : 'ink',
      'center',
    ),
    textPaint(
      label,
      cx,
      baseline(top + value.size + 6, CELL_LABEL, 1.2),
      labelFont,
      onHoney ? 'honeyMuted' : 'muted',
      'center',
    ),
  );
  return paints;
}

const CHIP_NAME = inter(500, 24);
const CHIP_BEST = inter(600, 24);

interface PlacedChip {
  shape: Shape;
  paints: Paint[];
}

/** The exercises as chips under the flower, wrapped and centred, three at most. */
function exerciseChips(
  exercises: ShareCardContent['exercises'],
  kit: Kit,
): { rows: number[][]; height: number; place: (top: number) => PlacedChip[] } {
  const { measure } = kit;
  const chipHeight = CHIP_NAME.size * 1.3 + CELLS.chipPadY * 2;
  const chips = exercises.slice(0, 3).map((exercise) => {
    const bestWidth = exercise.best ? measure(exercise.best, CHIP_BEST) + 10 : 0;
    const room = CELLS.chipMax - CELLS.chipPadX * 2 - bestWidth;
    const name = fitLine(exercise.name, room, (v) => measure(v, CHIP_NAME));
    return {
      name,
      best: exercise.best,
      width: CELLS.chipPadX * 2 + measure(name, CHIP_NAME) + bestWidth,
    };
  });
  const rows: number[][] = [];
  let used = 0;
  chips.forEach((chip, i) => {
    const row = rows[rows.length - 1];
    if (row && used + CELLS.chipGap + chip.width <= CELLS.chipMax) {
      row.push(i);
      used += CELLS.chipGap + chip.width;
    } else {
      rows.push([i]);
      used = chip.width;
    }
  });
  const place = (top: number): PlacedChip[] =>
    rows.flatMap((row, r) => {
      const rowWidth =
        row.reduce((sum, i) => sum + chips[i].width, 0) + (row.length - 1) * CELLS.chipGap;
      let x = (STICKER_WIDTH - rowWidth) / 2;
      const y = top + r * (chipHeight + CELLS.chipGap);
      return row.map((i) => {
        const chip = chips[i];
        const shape: Shape = { kind: 'box', x, y, w: chip.width, h: chipHeight, r: chipHeight / 2 };
        const at = baseline(y + CELLS.chipPadY, CHIP_NAME, 1.3);
        const paints: Paint[] = [
          { kind: 'fill', shape, role: 'detailsCard' },
          { kind: 'ring', shape, role: 'lines', width: BADGE.ring },
          textPaint(chip.name, x + CELLS.chipPadX, at, CHIP_NAME, 'ink', 'left'),
        ];
        if (chip.best) {
          paints.push(
            textPaint(chip.best, x + chip.width - CELLS.chipPadX, at, CHIP_BEST, 'accent', 'right'),
          );
        }
        x += chip.width + CELLS.chipGap;
        return { shape, paints };
      });
    });
  return {
    rows,
    height: rows.length * chipHeight + Math.max(0, rows.length - 1) * CELLS.chipGap,
    place,
  };
}

// ─── Full card ─────────────────────────────────────────────────────────────

const FULL = {
  padX: 64,
  /** Instagram's own controls cover the bottom of a Story. */
  bottom: 176,
  gap: 28,
  bandMin: 420,
  /** Between the band and the first line. */
  air: 72,
  pillTop: 160,
  pillLeft: 56,
  hex: 216,
  hexRing: 12,
  hexRight: 56,
  /** How far the duration's hexagon hangs below the band. */
  hexHang: 104,
  /** Over a photo the block only has to stay under the logo. */
  photoTop: 320,
} as const;

const FULL_INNER = CARD_WIDTH - FULL.padX * 2;
// A step smaller than the design (user, 2026-11-01): the block in the
// theme's colour stays short and the band, or the photo, keeps the room.
const FULL_KICKER = inter(600, 28);
const TILE_VALUE = display(52);
const TILE_LABEL = inter(500, 28);
const BAR = inter(600, 32);
const FULL_ROW = inter(500, 32);
const FULL_ROW_BEST = inter(600, 32);
const WEEK_LINE = inter(600, 28);
const WEEK_SUB = inter(500, 28);
const FOOTER = inter(600, 28);
const HEX_UNIT = inter(600, 26);

/**
 * The Full card (design "Share v3", 5): a band at the top (a band of
 * honeycomb in the theme's colours, or the photo edge to edge) with the
 * logo, the duration's honey hexagon on the band's edge, and the content
 * block at the bottom, clear of Instagram's controls. The band gives way
 * to the block, never the other way round, so the lower half is never
 * empty.
 */
export function fullLayout(
  content: ShareCardContent,
  measure: Measure,
  shape: HexShape,
  photo: boolean,
): ShareLayout {
  const kit: Kit = { measure, shape };
  return fitInOrder(content, DROP_ORDER.full, (c, dropped) =>
    buildFull(c, kit, photo, dropped.includes(LOCATION_ONE_LINE.name) ? 1 : 2),
  );
}

function buildFull(
  c: ShareCardContent,
  kit: Kit,
  photo: boolean,
  kickerLines: number,
): ShareLayout {
  const durationHex = !photo && !!c.duration;
  const hexHeight = hexSize(kit.shape, FULL.hex).height;
  const place = (narrow: number) => {
    const blocks = fullBlocks(c, kit, narrow, kickerLines);
    const top = CARD_HEIGHT - FULL.bottom - stack(blocks, FULL.gap);
    // The band reaches down to the block, so the plain colour is only ever
    // the block's own.
    const band = photo ? 0 : Math.max(FULL.bandMin, top - FULL.air);
    return { blocks, top, band };
  };
  // At the full width first; the lines beside the duration's hexagon are
  // then narrowed to clear it.
  let laid = place(FULL_INNER);
  if (durationHex && laid.top < laid.band + FULL.hexHang + 16) {
    laid = place(CARD_WIDTH - FULL.hexRight - FULL.hex - 24 - FULL.padX);
  }
  const { blocks, top, band } = laid;

  const paints: Paint[] = [{ kind: 'backdrop', w: CARD_WIDTH, h: CARD_HEIGHT }];
  paints.push(
    photo
      ? { kind: 'photo', w: CARD_WIDTH, h: CARD_HEIGHT, fadeTop: top }
      : { kind: 'comb', x: 0, y: 0, w: CARD_WIDTH, h: band },
  );
  paints.push(...brandPill(kit, FULL.pillLeft, 76, 32, 44, false).paint(FULL.pillTop));
  if (durationHex && c.duration) {
    const hex: HexBox = {
      kind: 'hex',
      x: CARD_WIDTH - FULL.hexRight - FULL.hex,
      y: band + FULL.hexHang - hexHeight,
      w: FULL.hex,
    };
    paints.push(...durationCell(c.duration, hex, kit));
  }
  paints.push(...paintStack(blocks, top, FULL.gap));
  const floor = photo ? FULL.photoTop : FULL.bandMin + FULL.air;
  return { width: CARD_WIDTH, height: CARD_HEIGHT, paints, fits: top >= floor, dropped: [] };
}

/** The content block's parts, top to bottom; `narrow` is the width beside the duration hexagon. */
function fullBlocks(c: ShareCardContent, kit: Kit, narrow: number, kickerLines: number): Block[] {
  const { measure } = kit;
  const x0 = FULL.padX;
  const blocks: Block[] = [];
  const kicker = [c.date, c.location].filter(Boolean).join(' · ');
  if (kicker) {
    const lines = wrapLines(kicker, narrow, kickerLines, (v) => measure(v, FULL_KICKER));
    const lead = FULL_KICKER.size * 1.3;
    blocks.push({
      height: lines.length * lead,
      paint: (top) =>
        lines.map((line, i) =>
          textPaint(
            line,
            x0,
            baseline(top + i * lead, FULL_KICKER, 1.3),
            FULL_KICKER,
            'muted',
            'left',
          ),
        ),
    });
  }
  const name = fitName(c.title, narrow, 2, [60, 52], measure);
  const lead = name.font.size * 1.15;
  blocks.push({
    height: name.lines.length * lead,
    paint: (top) =>
      name.lines.map((line, i) =>
        textPaint(line, x0, baseline(top + i * lead, name.font, 1.15), name.font, 'ink', 'left'),
      ),
  });
  const tiles = [...(c.duration ? [c.duration] : []), ...c.stats];
  if (tiles.length) blocks.push(statTiles(tiles, kit));
  if (c.record) blocks.push(recordBar(c.record, kit));
  if (c.exercises.length) {
    blocks.push(exerciseRows(c.exercises, kit, x0, FULL_INNER, FULL_ROW, FULL_ROW_BEST, 36, 20));
  }
  const week = weekRow(c, kit);
  if (week) blocks.push(week);
  const footer = fullFooter(c, kit);
  if (footer) blocks.push(footer);
  return blocks;
}

/** The duration and the numbers as tiles side by side. */
function statTiles(tiles: readonly ShareStat[], kit: Kit): Block {
  const gap = 24;
  const width = (FULL_INNER - gap * (tiles.length - 1)) / tiles.length;
  const height = 22 + TILE_VALUE.size + 10 + TILE_LABEL.size * 1.2 + 22;
  return {
    height,
    paint: (top) =>
      tiles.flatMap((tile, i): Paint[] => {
        const x = FULL.padX + i * (width + gap);
        const room = width - 48;
        const value = fitNumber(tile.value, room, TILE_VALUE, kit.measure);
        const label = fitLine(tile.label, room, (v) => kit.measure(v, TILE_LABEL));
        return [
          {
            kind: 'fill',
            shape: { kind: 'box', x, y: top, w: width, h: height, r: 40 },
            role: 'tile',
          },
          textPaint(tile.value, x + 24, baseline(top + 22, value, 1), value, 'ink', 'left'),
          textPaint(
            label,
            x + 24,
            baseline(top + 22 + TILE_VALUE.size + 10, TILE_LABEL, 1.2),
            TILE_LABEL,
            'muted',
            'left',
          ),
        ];
      }),
  };
}

/** The record: the only honey surface, navy on it. */
function recordBar(record: NonNullable<ShareCardContent['record']>, kit: Kit): Block {
  const height = 108;
  const hexW = 56;
  return {
    height,
    paint: (top) => {
      const x = FULL.padX;
      const textX = x + 36 + hexW + 28;
      const title = `${record.title} · `;
      const room = FULL_INNER - (textX - x) - 36 - kit.measure(title, BAR);
      const text = `${title}${recordText(record, room, (v) => kit.measure(v, BAR))}`;
      return [
        {
          kind: 'fill',
          shape: { kind: 'box', x, y: top, w: FULL_INNER, h: height, r: 40 },
          role: 'honey',
        },
        ...cell(kit, x + 36 + hexW / 2, top + height / 2, hexW, 'dot', 'honeyInk'),
        textPaint(
          text,
          textX,
          baseline(top + (height - BAR.size * 1.2) / 2, BAR, 1.2),
          BAR,
          'honeyInk',
          'left',
        ),
      ];
    },
  };
}

/** Where the week's seven days sit in its little comb: 2, 3 and 2, Monday first. */
const WEEK_PLACES: readonly (readonly [number, number])[] = [
  [-0.5, 0],
  [0.5, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [-0.5, 2],
  [0.5, 2],
];

/** The week's honeycomb, the number and the streak beside it, the feeling on the right. */
function weekRow(c: ShareCardContent, kit: Kit): Block | null {
  if (!c.number && !c.streak && !c.feeling) return null;
  const { measure, shape } = kit;
  const cellW = 44;
  const step = combStep(shape, cellW, 8);
  const cellHeight = hexSize(shape, cellW).height;
  const comb = c.week ? cellHeight + 2 * step.dy : 0;
  const combWidth = c.week ? cellW + 2 * step.dx : 0;
  const lead = WEEK_LINE.size * 1.4;
  const text = (c.number ? lead : 0) + (c.streak ? lead : 0);
  const feelingW = 96;
  const height = Math.max(comb, text, c.feeling ? hexSize(shape, feelingW).height : 0);
  return {
    height,
    paint: (top) => {
      const x = FULL.padX;
      const paints: Paint[] = [];
      const week = c.week;
      if (week) {
        const combTop = top + (height - comb) / 2;
        const mid = x + combWidth / 2;
        WEEK_PLACES.forEach(([col, row], day) => {
          const cy = combTop + cellHeight / 2 + row * step.dy;
          paints.push({
            kind: 'fill',
            shape: hexAt(kit, mid + col * step.dx, cy, cellW),
            role: week[day] ? 'honey' : 'weekEmpty',
          });
        });
      }
      const tx = x + (week ? combWidth + 36 : 0);
      const room = FULL_INNER - (tx - x) - (c.feeling ? feelingW + 24 : 0);
      let y = top + (height - text) / 2;
      if (c.number) {
        const line = fitLine(c.number.line, room, (v) => measure(v, WEEK_LINE));
        paints.push(textPaint(line, tx, baseline(y, WEEK_LINE, 1.4), WEEK_LINE, 'ink', 'left'));
        y += lead;
      }
      if (c.streak) {
        const line = fitLine(c.streak.line, room, (v) => measure(v, WEEK_SUB));
        paints.push(textPaint(line, tx, baseline(y, WEEK_SUB, 1.4), WEEK_SUB, 'muted', 'left'));
      }
      if (c.feeling) {
        const fx = x + FULL_INNER - feelingW / 2;
        const cy = top + height / 2;
        paints.push(...cell(kit, fx, cy, feelingW, null));
        paints.push({ kind: 'emoji', text: c.feeling.glyph, x: fx, y: cy, size: 48 });
      }
      return paints;
    },
  };
}

/** A line, then the link on the left and the coach on the right. */
function fullFooter(c: ShareCardContent, kit: Kit): Block | null {
  if (!c.link && !c.coach) return null;
  const lead = FOOTER.size * 1.3;
  return {
    height: 4 + 32 + lead,
    paint: (top) => {
      const x = FULL.padX;
      const at = baseline(top + 4 + 32, FOOTER, 1.3);
      const coachWidth = c.coach ? kit.measure(c.coach, FOOTER) : 0;
      const paints: Paint[] = [{ kind: 'rule', x, y: top, w: FULL_INNER, role: 'lines', width: 4 }];
      if (c.link) {
        const room = FULL_INNER - (c.coach ? coachWidth + 32 : 0);
        const link = fitLine(c.link, room, (v) => kit.measure(v, FOOTER));
        paints.push(textPaint(link, x, at, FOOTER, 'accent', 'left'));
      }
      if (c.coach) paints.push(textPaint(c.coach, x + FULL_INNER, at, FOOTER, 'muted', 'right'));
      return paints;
    },
  };
}

/** The duration's honey hexagon on the band's edge, ringed in the card's colour. */
function durationCell(duration: ShareStat, hex: HexBox, kit: Kit): Paint[] {
  const { measure, shape } = kit;
  const inner = hexInset(shape, hex.x, hex.y, hex.w, FULL.hexRing);
  const cx = hex.x + hex.w / 2;
  const cy = hex.y + hexSize(shape, hex.w).height / 2;
  const value = fitNumber(duration.value, inner.width - 40, TILE_VALUE, measure);
  const top = cy - (value.size + 4 + HEX_UNIT.size * 1.2) / 2;
  return [
    { kind: 'fill', shape: hex, role: 'surface' },
    { kind: 'fill', shape: { kind: 'hex', x: inner.x, y: inner.y, w: inner.width }, role: 'honey' },
    textPaint(duration.value, cx, baseline(top, value, 1), value, 'honeyInk', 'center'),
    textPaint(
      duration.label,
      cx,
      baseline(top + value.size + 4, HEX_UNIT, 1.2),
      HEX_UNIT,
      'honeyMuted',
      'center',
    ),
  ];
}
