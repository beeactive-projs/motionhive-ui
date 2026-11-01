import {
  HexShape,
  combStep,
  hexInset,
  hexShapePath,
  hexSize,
} from '../../../_shared/config/hexagon.config';
import { CardTheme, CardThemes, toHexColor, withAlpha } from './share-card.config';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FontSpec,
  Measure,
  Paint,
  PaintRole,
  STICKER_HEIGHT,
  STICKER_WIDTH,
  Shape,
  ShareLayout,
} from './share-layout.config';

/**
 * Paints a share image: canvas calls only. What the image says is
 * `share-card.config.ts`, where it goes is `share-layout.config.ts`; this
 * file turns a layout's roles into one theme's colours and draws them.
 */

// ─── Palette ───────────────────────────────────────────────────────────────

/**
 * One theme's paint (design "Share v3", 1), read from the app's colour
 * ramps when drawn. The ramps never flip with the app's own dark mode, so
 * a Light image stays cream on a phone in dark mode. Honey is the one
 * colour every theme shares: the medal's edge, the record, the cells.
 */
export interface CardPalette {
  theme: CardTheme;
  /** The surface: one colour, or the stops of a gradient at `surfaceAngle` (CSS degrees). */
  surface: string[];
  surfaceAngle: number;
  /** The light inside a surface, centred across and `glowAt` of the way down. */
  glow: string;
  glowAt: number;
  roles: Record<Exclude<PaintRole, 'surface'>, string>;
  /** The honeycomb band at the top of a Full card without a photo. */
  band: string;
  bandCell: string;
  /** A Story's background, top and bottom, when there is no photo. */
  storyTop: string;
  storyBottom: string;
}

export function cardPalette(theme: CardTheme, token: (name: string) => string): CardPalette {
  const hex = (name: string) => toHexColor(token(name)) ?? token(name);
  const white = '#ffffff';
  const navy = hex('--mh-navy-900');
  const honey = hex('--mh-primary-500');
  const constant = {
    honey,
    honeyInk: navy,
    honeyMuted: hex('--mh-primary-900'),
    dot: hex('--mh-warning-200'),
    white,
    pill: withAlpha(navy, 0.7),
    pillInk: white,
  };
  switch (theme) {
    case CardThemes.Dark:
      return {
        theme,
        surface: [navy],
        surfaceAngle: 180,
        glow: withAlpha(honey, 0.22),
        glowAt: 0.3,
        roles: {
          ...constant,
          detailsCard: navy,
          ink: white,
          muted: hex('--mh-navy-300'),
          accent: hex('--mh-warning-300'),
          lines: withAlpha(white, 0.1),
          chip: withAlpha(honey, 0.16),
          tile: hex('--mh-navy-800'),
          weekEmpty: hex('--mh-navy-700'),
        },
        band: hex('--mh-navy-800'),
        bandCell: hex('--mh-navy-700'),
        storyTop: hex('--mh-navy-700'),
        storyBottom: hex('--mh-navy-950'),
      };
    case CardThemes.Teal: {
      const accent = hex('--mh-teal-300');
      return {
        theme,
        surface: [hex('--mh-teal-950')],
        surfaceAngle: 180,
        glow: withAlpha(accent, 0.22),
        glowAt: 0.3,
        roles: {
          ...constant,
          detailsCard: hex('--mh-teal-950'),
          ink: white,
          muted: hex('--mh-teal-200'),
          accent,
          lines: withAlpha(white, 0.12),
          chip: withAlpha(accent, 0.16),
          tile: hex('--mh-teal-900'),
          weekEmpty: withAlpha(white, 0.15),
        },
        band: hex('--mh-teal-900'),
        bandCell: hex('--mh-teal-800'),
        storyTop: hex('--mh-teal-900'),
        storyBottom: hex('--mh-teal-950'),
      };
    }
    case CardThemes.Dusk: {
      const accent = hex('--mh-primary-300');
      return {
        theme,
        surface: [hex('--mh-navy-800'), hex('--mh-violet-950'), hex('--mh-violet-900')],
        surfaceAngle: 165,
        glow: withAlpha(accent, 0.25),
        glowAt: 0.28,
        roles: {
          ...constant,
          detailsCard: hex('--mh-violet-950'),
          ink: white,
          muted: hex('--mh-violet-200'),
          accent,
          lines: withAlpha(white, 0.14),
          chip: withAlpha(accent, 0.18),
          tile: withAlpha(white, 0.08),
          weekEmpty: withAlpha(white, 0.15),
        },
        band: hex('--mh-violet-950'),
        bandCell: hex('--mh-violet-900'),
        storyTop: hex('--mh-navy-800'),
        storyBottom: hex('--mh-violet-900'),
      };
    }
    default: {
      const cream = hex('--mh-primary-50');
      const deep = hex('--mh-primary-700');
      return {
        theme,
        surface: [cream],
        surfaceAngle: 180,
        glow: withAlpha(white, 0.9),
        glowAt: 0.3,
        roles: {
          ...constant,
          detailsCard: cream,
          ink: navy,
          muted: hex('--mh-primary-900'),
          accent: deep,
          lines: withAlpha(deep, 0.16),
          chip: withAlpha(honey, 0.14),
          tile: white,
          weekEmpty: hex('--mh-primary-100'),
        },
        band: hex('--mh-primary-100'),
        bandCell: hex('--mh-primary-200'),
        storyTop: cream,
        storyBottom: hex('--mh-primary-200'),
      };
    }
  }
}

// ─── Type ──────────────────────────────────────────────────────────────────

/** Emoji have no glyphs in Inter; the canvas falls through to the system's. */
const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

export function fontString(font: FontSpec): string {
  return `${font.weight} ${font.size}px ${font.family}, ${EMOJI_FONTS}, sans-serif`;
}

/** Widths in the real faces, read off the canvas (the transform does not change them). */
export function canvasMeasure(ctx: CanvasRenderingContext2D): Measure {
  const known = new Map<string, number>();
  return (text, font) => {
    const face = fontString(font);
    const key = `${face}|${text}`;
    let width = known.get(key);
    if (width === undefined) {
      ctx.font = face;
      width = ctx.measureText(text).width;
      known.set(key, width);
    }
    return width;
  };
}

// ─── Shapes ────────────────────────────────────────────────────────────────

/** The mark from `mh-logo` (viewBox 168 × 190). Change it there and here together. */
const LOGO_PATHS = [
  'M16.8,61.71v66.58a9.74,9.74,0,0,0,4.85,8.42l10.46,6V64.85H43.25v0l20.37,35.37L84,64.86H95.15L84,84.21l-14.8,25.7-5.57,9.68-5.57-9.68L43.26,84.22v84.45l-11.15-6.46L7.27,147.84A14.6,14.6,0,0,1,0,135.21V54.79A14.6,14.6,0,0,1,7.27,42.16L76.73,2A14.53,14.53,0,0,1,91.27,2l22.24,12.88V34.28L88.85,20a9.66,9.66,0,0,0-9.7,0L21.65,53.29A9.74,9.74,0,0,0,16.8,61.71Z',
  'M168,54.79v80.42a14.6,14.6,0,0,1-7.27,12.63L91.27,188.05a14.53,14.53,0,0,1-14.54,0L54.42,175.13V155.68L79.15,170a9.66,9.66,0,0,0,9.7,0l57.5-33.29a9.74,9.74,0,0,0,4.85-8.42V61.71a9.74,9.74,0,0,0-4.85-8.42l-10.46-6v77.91H124.74V99.84H95.15v25.31H84V94L95.15,74.58V90.16h29.59V21.33l11.15,6.46,24.84,14.37A14.6,14.6,0,0,1,168,54.79Z',
];

/** The location pin (`location-outline`'s shape, viewBox 24). */
const PIN_PATH = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z';

function shapePath(shape: Shape, hex: HexShape): Path2D {
  if (shape.kind === 'hex')
    return new Path2D(hexShapePath(hex, shape.w, 'pointy', shape.x, shape.y));
  return roundedBox(shape.x, shape.y, shape.w, shape.h, shape.r);
}

function roundedBox(x: number, y: number, w: number, h: number, r: number): Path2D {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  const path = new Path2D();
  path.moveTo(x + radius, y);
  path.arcTo(x + w, y, x + w, y + h, radius);
  path.arcTo(x + w, y + h, x, y + h, radius);
  path.arcTo(x, y + h, x, y, radius);
  path.arcTo(x, y, x + w, y, radius);
  path.closePath();
  return path;
}

/** A shape's box, for gradients across it. */
function bounds(shape: Shape, hex: HexShape): { x: number; y: number; w: number; h: number } {
  return shape.kind === 'hex'
    ? { x: shape.x, y: shape.y, w: shape.w, h: hexSize(hex, shape.w).height }
    : { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
}

/** The theme's surface across a box: its colour, or its gradient at the CSS angle. */
function surfaceStyle(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  box: { x: number; y: number; w: number; h: number },
): string | CanvasGradient {
  if (palette.surface.length === 1) return palette.surface[0];
  const angle = (palette.surfaceAngle * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const gradient = ctx.createLinearGradient(
    cx - dx * half,
    cy - dy * half,
    cx + dx * half,
    cy + dy * half,
  );
  palette.surface.forEach((stop, i) =>
    gradient.addColorStop(i / (palette.surface.length - 1), stop),
  );
  return gradient;
}

/** The theme's light inside a box: a soft circle, as the design's radial gradient. */
function glowStyle(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  box: { x: number; y: number; w: number; h: number },
): CanvasGradient {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * palette.glowAt;
  const reach = Math.hypot(box.w / 2, box.h * (1 - palette.glowAt)) * 0.6;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  gradient.addColorStop(0, palette.glow);
  gradient.addColorStop(1, withAlpha(toHexColor(palette.glow) ?? '#ffffff', 0));
  return gradient;
}

/** Shadows ignore the canvas's scale, so a preview's are scaled by hand. */
function scaleOf(ctx: CanvasRenderingContext2D): number {
  return ctx.getTransform().a || 1;
}

// ─── Painting a layout ─────────────────────────────────────────────────────

/**
 * Paints a layout from `share-layout.config.ts` in a theme, with the
 * person's hexagon. `photo` is the Full card's background when it has one.
 */
export function paintLayout(
  ctx: CanvasRenderingContext2D,
  layout: ShareLayout,
  palette: CardPalette,
  hex: HexShape,
  photo: CanvasImageSource | null = null,
): void {
  ctx.textBaseline = 'alphabetic';
  for (const paint of layout.paints) paintOne(ctx, paint, palette, hex, photo);
}

function paintOne(
  ctx: CanvasRenderingContext2D,
  paint: Paint,
  palette: CardPalette,
  hex: HexShape,
  photo: CanvasImageSource | null,
): void {
  const colour = (role: PaintRole) =>
    role === 'surface' ? palette.surface[0] : palette.roles[role];
  switch (paint.kind) {
    case 'shadow': {
      const union = new Path2D();
      for (const shape of paint.shapes) union.addPath(shapePath(shape, hex));
      const scale = scaleOf(ctx);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 48 * scale;
      ctx.shadowOffsetY = 24 * scale;
      ctx.fillStyle = palette.surface[0];
      ctx.fill(union);
      ctx.restore();
      return;
    }
    case 'fill': {
      const path = shapePath(paint.shape, hex);
      const box = bounds(paint.shape, hex);
      ctx.fillStyle =
        paint.role === 'surface' ? surfaceStyle(ctx, palette, box) : colour(paint.role);
      ctx.fill(path);
      if (paint.glow) {
        ctx.save();
        ctx.clip(path);
        ctx.fillStyle = glowStyle(ctx, palette, box);
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.restore();
      }
      return;
    }
    case 'ring': {
      const half = paint.width / 2;
      const shape = paint.shape;
      const path =
        shape.kind === 'hex'
          ? (() => {
              const inner = hexInset(hex, shape.x, shape.y, shape.w, half);
              return new Path2D(hexShapePath(hex, inner.width, 'pointy', inner.x, inner.y));
            })()
          : roundedBox(
              shape.x + half,
              shape.y + half,
              shape.w - paint.width,
              shape.h - paint.width,
              shape.r - half,
            );
      ctx.strokeStyle = colour(paint.role);
      ctx.lineWidth = paint.width;
      ctx.stroke(path);
      return;
    }
    case 'brandEdge': {
      ctx.save();
      ctx.strokeStyle = colour(paint.role);
      ctx.lineWidth = paint.width;
      ctx.lineCap = 'round';
      ctx.setLineDash(paint.dash);
      ctx.lineDashOffset = paint.offset;
      ctx.stroke(shapePath(paint.shape, hex));
      ctx.restore();
      return;
    }
    case 'text':
      ctx.font = fontString(paint.font);
      ctx.fillStyle = colour(paint.role);
      ctx.textAlign = paint.align;
      ctx.fillText(paint.text, paint.x, paint.y);
      return;
    case 'emoji':
      ctx.save();
      ctx.font = `${paint.size}px ${EMOJI_FONTS}, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.roles.honeyInk;
      ctx.fillText(paint.text, paint.x, paint.y + paint.size * 0.06);
      ctx.restore();
      return;
    case 'rule':
      ctx.fillStyle = colour(paint.role);
      ctx.fillRect(paint.x, paint.y, paint.w, paint.width);
      return;
    case 'dot':
      ctx.fillStyle = colour(paint.role);
      ctx.beginPath();
      ctx.arc(paint.x, paint.y, paint.r, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'pin': {
      const scale = paint.size / 24;
      ctx.save();
      ctx.translate(paint.x, paint.y);
      ctx.scale(scale, scale);
      ctx.strokeStyle = colour(paint.role);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(PIN_PATH));
      ctx.beginPath();
      ctx.arc(12, 10, 2.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'mark': {
      const scale = paint.h / 190;
      ctx.save();
      ctx.translate(paint.x, paint.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = colour(paint.role);
      for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
      ctx.restore();
      return;
    }
    case 'backdrop': {
      const box = { x: 0, y: 0, w: paint.w, h: paint.h };
      ctx.fillStyle = surfaceStyle(ctx, palette, box);
      ctx.fillRect(0, 0, paint.w, paint.h);
      ctx.fillStyle = glowStyle(ctx, palette, {
        x: 0,
        y: paint.h * 0.3,
        w: paint.w,
        h: paint.h * 0.7,
      });
      ctx.fillRect(0, 0, paint.w, paint.h);
      return;
    }
    case 'photo':
      if (photo) paintPhoto(ctx, photo, palette, paint.w, paint.h);
      return;
    case 'comb':
      paintComb(ctx, palette, hex, paint);
      return;
  }
}

/**
 * The photo edge to edge, darkening to the theme's colour from a quarter
 * of the way down, so the content block reads over any picture.
 */
function paintPhoto(
  ctx: CanvasRenderingContext2D,
  photo: CanvasImageSource,
  palette: CardPalette,
  w: number,
  h: number,
): void {
  drawCover(ctx, photo, 0, 0, w, h);
  const base = palette.surface[palette.surface.length - 1];
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0.25, withAlpha(base, 0));
  gradient.addColorStop(0.5, withAlpha(base, 0.75));
  gradient.addColorStop(0.72, withAlpha(base, 0.96));
  gradient.addColorStop(1, withAlpha(base, 0.98));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** Which cells of the band are honey: a scatter that reads as a hive, the same every time. */
const BAND_HONEY = new Set(['1:2', '2:5', '3:1', '3:6', '4:3', '5:6', '6:2', '7:4']);

/**
 * The band of honeycomb a Full card without a photo opens with, in the
 * theme's colours (the user's decision for where the design put a photo).
 */
function paintComb(
  ctx: CanvasRenderingContext2D,
  palette: CardPalette,
  hex: HexShape,
  band: { x: number; y: number; w: number; h: number },
): void {
  if (band.h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();
  ctx.fillStyle = palette.band;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  const width = 150;
  const step = combStep(hex, width, 14);
  const height = hexSize(hex, width).height;
  for (let row = 0; row * step.dy - height < band.h; row++) {
    const shift = row % 2 === 0 ? -width / 2 : 0;
    for (let col = 0; shift + col * step.dx < band.w + width; col++) {
      const x = band.x + shift + col * step.dx;
      const y = band.y - height / 3 + row * step.dy;
      ctx.fillStyle = BAND_HONEY.has(`${row}:${col}`) ? palette.roles.honey : palette.bandCell;
      ctx.fill(new Path2D(hexShapePath(hex, width, 'pointy', x, y)));
    }
  }
  // The band settles into the card below it.
  const fade = ctx.createLinearGradient(0, band.y + band.h * 0.55, 0, band.y + band.h);
  fade.addColorStop(0, withAlpha(palette.band, 0));
  fade.addColorStop(1, withAlpha(palette.band, 0.85));
  ctx.fillStyle = fade;
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.restore();
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

// ─── The Quick Story, as it will look ─────────────────────────────────────

/** The sticker's width on the Story: about where Instagram first places it. */
const STORY_STICKER_WIDTH = 760;

/**
 * The Story the Quick way makes: the photo, or the theme's two colours,
 * with the sticker in the middle, inside the band Instagram's own chrome
 * leaves free. The same picture goes to the share sheet when Instagram is
 * not there.
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
    (CARD_WIDTH - STORY_STICKER_WIDTH) / 2,
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
