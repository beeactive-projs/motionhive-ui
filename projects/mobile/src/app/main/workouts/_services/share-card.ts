import { PersonalRecord, WorkoutLog } from 'core';

import { HEX_PATH } from '../../../_shared/components/hex-avatar/hex-avatar';
import { durationClock, formatMeasure, workoutTiles } from '../workouts.config';

/** A story is 9:16 at 1080 wide, the size Instagram and Facebook take as is. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
/** The longest message the card (and `share_caption`) holds. */
export const CAPTION_MAX_LENGTH = 80;
/** Shown on every card: the free traction is the point. */
const SITE = 'motionhive.fit';

/**
 * Text stays inside the band a story does not cover with its own chrome
 * (profile row on top, reply bar below).
 */
const SAFE_TOP = 250;
const SAFE_BOTTOM = 1570;

export interface ShareCardOptions {
  /** Many people do not want to show weights; off removes every kg. */
  showKg: boolean;
  showRecord: boolean;
  /** Off by default: naming a coach is their call to make, not ours. */
  showCoach: boolean;
  caption: string;
}

export interface ShareCardContent {
  kicker: string;
  title: string;
  stats: { label: string; value: string }[];
  record: string | null;
  streak: string | null;
  caption: string | null;
  coach: string | null;
  site: string;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** A streak shorter than this is just training, not yet a streak. */
const STREAK_WORTH_SAYING = 2;

/**
 * What the card says, from the workout and the person's choices. Pure, so
 * the rules (kg off means no kg anywhere, a coach only when chosen) are
 * tested without a canvas.
 */
export function shareCardContent(
  log: WorkoutLog,
  options: ShareCardOptions,
  t: Translate,
  locale: string,
): ShareCardContent {
  const date = log.completedAt
    ? new Date(log.completedAt).toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';
  const number = log.summary?.workoutNumber;
  const kicker = (number ? t('workouts.share.card.kicker', { number, date }) : date).toLocaleUpperCase(
    locale,
  );

  const volume = t('workouts.tiles.volume');
  const measures = workoutTiles(log).filter((tile) => options.showKg || tile.label !== volume);
  const stats = [
    { label: t('workouts.tiles.duration'), value: durationClock(log.durationSeconds) },
    ...measures.slice(0, 2),
  ];

  const first = log.personalRecords?.[0];
  const record =
    options.showRecord && first ? t('workouts.share.card.record', { detail: recordDetail(first, options.showKg, t) }) : null;

  const weeks = log.summary?.streakWeeks ?? 0;
  const coachName = log.summary?.coachName;
  const caption = oneLine(options.caption).slice(0, CAPTION_MAX_LENGTH);

  return {
    kicker,
    title: log.name,
    stats,
    record,
    streak: weeks >= STREAK_WORTH_SAYING ? t('workouts.share.card.streak', { count: weeks }) : null,
    caption: caption || null,
    coach: options.showCoach && coachName ? t('workouts.share.card.coach', { name: coachName }) : null,
    site: SITE,
  };
}

/** "Squat 100 kg × 5", or just "Squat" when weights stay private. */
function recordDetail(record: PersonalRecord, showKg: boolean, t: Translate): string {
  if (!showKg) return record.exerciseName;
  if (record.setWeightKg != null && record.setReps != null) {
    return t('workouts.finish.highlights.recordSet', {
      name: record.exerciseName,
      weight: formatMeasure(record.setWeightKg),
      reps: record.setReps,
    });
  }
  return t('workouts.finish.highlights.recordGain', {
    name: record.exerciseName,
    delta: formatMeasure(record.deltaKg),
  });
}

/** The message is one line on the card, whatever was pasted into it. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ─── Drawing ───────────────────────────────────────────────────────────────

/** The theme tokens the card is painted with, read from CSS when drawn. */
export interface CardPalette {
  dark: boolean;
  background: string;
  glow: string;
  comb: string;
  combAlpha: number;
  ink: string;
  muted: string;
  accent: string;
  honey: string;
  tile: string;
  tileBorder: string;
  chip: string;
  chipInk: string;
  tag: string;
  tagInk: string;
  sparks: string[];
  /** Fixed in both themes, for text on honey or on a white badge over a photo. */
  navy: string;
  slate: string;
  wash: string;
}

/**
 * The card follows the app's theme: navy at night, cream by day. Each is
 * one layout with its own set of tokens, never colours written here.
 */
export function cardPalette(dark: boolean, token: (name: string) => string): CardPalette {
  const sparks = [token('--mh-teal-400'), token('--mh-coral-400'), token('--mh-violet-400')];
  const fixed = {
    navy: token('--mh-navy-900'),
    slate: token('--mh-slate-600'),
    wash: token('--mh-primary-50'),
  };
  return dark
    ? {
        dark,
        background: token('--mh-navy-900'),
        glow: token('--mh-navy-500'),
        comb: token('--mh-primary-500'),
        combAlpha: 0.08,
        ink: token('--mh-navy-50'),
        muted: token('--mh-navy-300'),
        accent: token('--mh-warning-300'),
        honey: token('--mh-primary-500'),
        tile: 'rgba(255, 255, 255, 0.06)',
        tileBorder: 'rgba(255, 255, 255, 0.12)',
        chip: token('--mh-primary-50'),
        chipInk: token('--mh-primary-800'),
        tag: token('--mh-primary-500'),
        tagInk: token('--mh-navy-900'),
        sparks,
        ...fixed,
      }
    : {
        dark,
        background: token('--mh-primary-50'),
        glow: token('--mh-primary-100'),
        comb: token('--mh-primary-700'),
        combAlpha: 0.09,
        ink: token('--mh-navy-900'),
        muted: token('--mh-slate-600'),
        accent: token('--mh-primary-800'),
        honey: token('--mh-primary-500'),
        tile: '#ffffff',
        tileBorder: token('--mh-primary-200'),
        chip: '#ffffff',
        chipInk: token('--mh-primary-800'),
        tag: token('--mh-navy-900'),
        tagInk: '#ffffff',
        sparks,
        ...fixed,
      };
}

/** The mark from `mh-logo` (viewBox 168 × 190). Change it there and here together. */
const LOGO_PATHS = [
  'M16.8,61.71v66.58a9.74,9.74,0,0,0,4.85,8.42l10.46,6V64.85H43.25v0l20.37,35.37L84,64.86H95.15L84,84.21l-14.8,25.7-5.57,9.68-5.57-9.68L43.26,84.22v84.45l-11.15-6.46L7.27,147.84A14.6,14.6,0,0,1,0,135.21V54.79A14.6,14.6,0,0,1,7.27,42.16L76.73,2A14.53,14.53,0,0,1,91.27,2l22.24,12.88V34.28L88.85,20a9.66,9.66,0,0,0-9.7,0L21.65,53.29A9.74,9.74,0,0,0,16.8,61.71Z',
  'M168,54.79v80.42a14.6,14.6,0,0,1-7.27,12.63L91.27,188.05a14.53,14.53,0,0,1-14.54,0L54.42,175.13V155.68L79.15,170a9.66,9.66,0,0,0,9.7,0l57.5-33.29a9.74,9.74,0,0,0,4.85-8.42V61.71a9.74,9.74,0,0,0-4.85-8.42l-10.46-6v77.91H124.74V99.84H95.15v25.31H84V94L95.15,74.58V90.16h29.59V21.33l11.15,6.46,24.84,14.37A14.6,14.6,0,0,1,168,54.79Z',
];

/** Emoji have no glyphs in Inter; the canvas falls through to the system's. */
const EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

function font(weight: number, size: number, family = 'Inter'): string {
  return `${weight} ${size}px ${family}, ${EMOJI_FONTS}, sans-serif`;
}

/** Faces the card uses; the canvas draws a fallback if they are not loaded yet. */
export const CARD_FONTS = [font(800, 92, 'Poppins'), font(700, 60), font(600, 34), font(500, 30)];

const CENTER = CARD_WIDTH / 2;
const CONTENT_WIDTH = 900;

/**
 * The card's look. `comb` needs no photo; the other two are built around
 * one (designs 8d and 8g): the picture is the hero, and the brand sits in
 * a band or a badge that never covers the middle of it.
 */
export type CardTemplate = 'comb' | 'strip' | 'badge';

export const PHOTO_TEMPLATES: readonly CardTemplate[] = ['strip', 'badge'];

/** Draws the card in the chosen look; the photo ones fall back to `comb` without a photo. */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  template: CardTemplate,
  photo: CanvasImageSource | null,
): void {
  if (template === 'strip' && photo) drawPhotoStrip(ctx, content, palette, photo);
  else if (template === 'badge' && photo) drawPhotoBadge(ctx, content, palette, photo);
  else drawShareCard(ctx, content, palette);
}

/** Draws the whole card onto a 1080 × 1920 context. */
export function drawShareCard(ctx: CanvasRenderingContext2D, content: ShareCardContent, palette: CardPalette): void {
  drawBackground(ctx, palette);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let y = SAFE_TOP + 20;
  y = drawBadge(ctx, palette, y) + 70;

  ctx.fillStyle = palette.accent;
  setText(ctx, font(600, 34), 6);
  ctx.fillText(fit(ctx, content.kicker, CONTENT_WIDTH), CENTER, y);
  y += 40;

  ctx.fillStyle = palette.ink;
  setText(ctx, font(800, 92, 'Poppins'), 0);
  for (const line of wrap(ctx, content.title, CONTENT_WIDTH, 2)) {
    y += 100;
    ctx.fillText(line, CENTER, y);
  }
  y += 56;

  y = drawStats(ctx, content.stats, palette, y) + 44;

  if (content.record) {
    y = drawChip(ctx, `🏆 ${content.record}`, palette, y) + 28;
  }
  if (content.streak) {
    ctx.fillStyle = palette.accent;
    setText(ctx, font(600, 34), 0);
    y += 40;
    ctx.fillText(fit(ctx, `🔥 ${content.streak}`, CONTENT_WIDTH), CENTER, y);
    y += 32;
  }
  if (content.caption) {
    y = drawTag(ctx, content.caption, palette, y + 16) + 24;
  }
  if (content.coach) {
    ctx.fillStyle = palette.muted;
    setText(ctx, font(500, 30), 0);
    y += 38;
    ctx.fillText(fit(ctx, content.coach, CONTENT_WIDTH), CENTER, y);
  }

  drawSite(ctx, content.site, palette, Math.max(y + 90, SAFE_BOTTOM - 30));
}

/** Height of the honey band under the photo on the strip card. */
const BAND_TOP = 1100;

/**
 * 8d: the photo above, a honey band below like a signature colour, the
 * logo's hex breaking out of the band's top edge.
 */
function drawPhotoStrip(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  photo: CanvasImageSource,
): void {
  drawCover(ctx, photo, 0, 0, CARD_WIDTH, BAND_TOP);
  ctx.fillStyle = palette.honey;
  ctx.fillRect(0, BAND_TOP, CARD_WIDTH, CARD_HEIGHT - BAND_TOP);

  // The logo in a navy hex, half out of the band.
  const hexWidth = 150;
  const scale = hexWidth / 100;
  ctx.save();
  ctx.translate(CARD_WIDTH - 80 - hexWidth, BAND_TOP - 70 - 6.7 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.navy;
  ctx.fill(new Path2D(HEX_PATH));
  ctx.restore();
  drawMark(ctx, palette.honey, CARD_WIDTH - 80 - hexWidth / 2, BAND_TOP - 70 + 66, 66);

  const ink = stripInk(palette);
  ctx.textAlign = 'left';
  let y = BAND_TOP + 130;
  ctx.fillStyle = ink;
  setText(ctx, font(800, 84, 'Poppins'), 0);
  for (const line of wrap(ctx, content.title, 760, 2)) {
    ctx.fillText(line, 80, y);
    y += 92;
  }
  setText(ctx, font(700, 40), 2);
  ctx.fillText(fit(ctx, statsLine(content), 920), 80, y + 4);
  y += 70;
  if (content.record) {
    setText(ctx, font(600, 34), 0);
    ctx.fillText(fit(ctx, `🏆 ${content.record}`, 920), 80, y);
    y += 56;
  }
  if (content.caption) {
    setText(ctx, font(600, 36), 0);
    ctx.fillText(fit(ctx, `“${content.caption}”`, 920), 80, y);
    y += 56;
  }
  setText(ctx, font(600, 28), 6);
  ctx.globalAlpha = 0.8;
  ctx.fillText(content.site.toUpperCase(), 80, Math.min(Math.max(y + 30, 1500), SAFE_BOTTOM));
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
}

/**
 * 8g: the photo untouched, full bleed, with a small stats badge in the
 * corner, for people who care about the picture more than the numbers.
 */
function drawPhotoBadge(
  ctx: CanvasRenderingContext2D,
  content: ShareCardContent,
  palette: CardPalette,
  photo: CanvasImageSource,
): void {
  drawCover(ctx, photo, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  const width = 360;
  const left = CARD_WIDTH - 60 - width;
  const top = SAFE_TOP + 40;
  const rows = content.stats.slice(0, 2);
  const height = 150 + rows.length * 120 + (content.record ? 80 : 0);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, left, top, width, height, 44);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fill();
  ctx.restore();

  const ink = stripInk(palette);
  ctx.textAlign = 'left';
  drawMark(ctx, palette.honey, left + 62, top + 66, 44);
  ctx.fillStyle = ink;
  setText(ctx, font(700, 30, 'Poppins'), 0);
  ctx.fillText('MotionHive', left + 96, top + 77);

  let y = top + 160;
  for (const stat of rows) {
    ctx.fillStyle = ink;
    setText(ctx, font(800, 64), 0);
    ctx.fillText(fit(ctx, stat.value, width - 80), left + 40, y);
    ctx.fillStyle = palette.slate;
    setText(ctx, font(500, 28), 0);
    ctx.fillText(fit(ctx, stat.label, width - 80), left + 40, y + 40);
    y += 120;
  }
  if (content.record) {
    setText(ctx, font(600, 28), 0);
    const label = fit(ctx, `🏆 ${content.record}`, width - 100);
    const chipWidth = ctx.measureText(label).width + 40;
    roundRect(ctx, left + 36, y - 30, chipWidth, 52, 26);
    ctx.fillStyle = palette.wash;
    ctx.fill();
    ctx.fillStyle = palette.chipInk;
    ctx.fillText(label, left + 56, y + 5);
  }

  if (content.caption) {
    ctx.save();
    ctx.textAlign = 'center';
    drawTag(ctx, content.caption, { ...palette, tag: palette.navy, tagInk: '#ffffff' }, 1300);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  setText(ctx, font(600, 30), 6);
  ctx.fillText(content.site.toUpperCase(), CENTER, SAFE_BOTTOM - 25);
  ctx.shadowBlur = 0;
}

/** Ink for text on honey or white: navy in either theme. */
function stripInk(palette: CardPalette): string {
  return palette.navy;
}

/** "52:14 · 18 sets · 6240 kg": the stats on one line, for the band. */
function statsLine(content: ShareCardContent): string {
  return content.stats
    .map((stat, i) => (i === 0 ? stat.value : `${stat.value} ${stat.label.toLocaleLowerCase()}`))
    .join(' · ');
}

/** The logo mark, centred on (cx, cy), `height` tall. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  height: number,
): void {
  const scale = height / 190;
  ctx.save();
  ctx.translate(cx - (168 * scale) / 2, cy - height / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

/** Fills the box with the image, cropped to keep its proportions (CSS `cover`). */
function drawCover(
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

function drawBackground(ctx: CanvasRenderingContext2D, palette: CardPalette): void {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(CENTER, 700, 0, CENTER, 700, 1100);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, palette.background);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // A faint honeycomb of the brand's flat-top hexagons.
  const r = 56;
  const w = r * 1.5;
  const h = Math.sqrt(3) * r;
  ctx.save();
  ctx.globalAlpha = palette.combAlpha;
  ctx.strokeStyle = palette.comb;
  ctx.lineWidth = 2.5;
  for (let col = -1; col * w < CARD_WIDTH + w; col++) {
    for (let row = -1; row * h < CARD_HEIGHT + h; row++) {
      const cx = col * w;
      const cy = row * h + (col % 2 === 0 ? 0 : h / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The brand cell with 💪 in it and three small hexes thrown around. Returns its bottom. */
function drawBadge(ctx: CanvasRenderingContext2D, palette: CardPalette, top: number): number {
  const width = 280;
  const scale = width / 100;
  const height = 86.6 * scale;
  const hex = new Path2D(HEX_PATH);

  const spark = (x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.translate(0, -6.7);
    ctx.fillStyle = color;
    ctx.fill(hex);
    ctx.restore();
  };
  spark(CENTER - width / 2 - 70, top + 40, 50, palette.honey);
  spark(CENTER + width / 2 + 30, top + 10, 36, palette.sparks[0]);
  spark(CENTER + width / 2 + 10, top + height - 50, 54, palette.sparks[1]);
  spark(CENTER - width / 2 - 20, top + height - 10, 30, palette.sparks[2]);

  ctx.save();
  ctx.translate(CENTER - width / 2, top - 6.7 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.honey;
  ctx.fill(hex);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setText(ctx, font(400, 120), 0);
  ctx.fillText('💪', CENTER, top + height / 2 + 6);
  ctx.textBaseline = 'alphabetic';
  return top + height;
}

function drawStats(
  ctx: CanvasRenderingContext2D,
  stats: ShareCardContent['stats'],
  palette: CardPalette,
  top: number,
): number {
  const gap = 24;
  const height = 176;
  const width = (CONTENT_WIDTH - gap * (stats.length - 1)) / stats.length;
  let x = CENTER - CONTENT_WIDTH / 2;
  for (const stat of stats) {
    roundRect(ctx, x, top, width, height, 32);
    ctx.fillStyle = palette.tile;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = palette.tileBorder;
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    setText(ctx, font(700, 60), 0);
    ctx.fillText(fit(ctx, stat.value, width - 24), x + width / 2, top + 92);
    ctx.fillStyle = palette.muted;
    setText(ctx, font(500, 30), 0);
    ctx.fillText(fit(ctx, stat.label, width - 24), x + width / 2, top + 140);
    x += width + gap;
  }
  return top + height;
}

/** A pill, centred. Returns its bottom. */
function drawChip(ctx: CanvasRenderingContext2D, text: string, palette: CardPalette, top: number): number {
  setText(ctx, font(600, 34), 0);
  const label = fit(ctx, text, CONTENT_WIDTH - 80);
  const width = ctx.measureText(label).width + 72;
  const height = 76;
  roundRect(ctx, CENTER - width / 2, top, width, height, height / 2);
  ctx.fillStyle = palette.chip;
  ctx.fill();
  ctx.fillStyle = palette.chipInk;
  ctx.fillText(label, CENTER, top + 50);
  return top + height;
}

/** The person's message as a slightly tilted speech tag. Returns its bottom. */
function drawTag(ctx: CanvasRenderingContext2D, text: string, palette: CardPalette, top: number): number {
  setText(ctx, font(600, 40), 0);
  const lines = wrap(ctx, text, 760, 2);
  const lineHeight = 54;
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 80;
  const height = lines.length * lineHeight + 48;

  ctx.save();
  ctx.translate(CENTER, top + height / 2);
  ctx.rotate((-2 * Math.PI) / 180);
  roundRect(ctx, -width / 2, -height / 2, width, height, 28);
  ctx.fillStyle = palette.tag;
  ctx.fill();
  ctx.fillStyle = palette.tagInk;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, -height / 2 + 24 + lineHeight * (i + 1) - 14);
  });
  ctx.restore();
  return top + height;
}

function drawSite(ctx: CanvasRenderingContext2D, site: string, palette: CardPalette, baseline: number): void {
  setText(ctx, font(600, 30), 5);
  const label = site.toUpperCase();
  const logoHeight = 44;
  const logoWidth = (168 / 190) * logoHeight;
  const gap = 16;
  const total = logoWidth + gap + ctx.measureText(label).width;
  const left = CENTER - total / 2;

  ctx.save();
  ctx.translate(left, baseline - logoHeight + 6);
  ctx.scale(logoHeight / 190, logoHeight / 190);
  ctx.fillStyle = palette.honey;
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = palette.muted;
  ctx.fillText(label, left + logoWidth + gap, baseline);
  ctx.textAlign = 'center';
}

function setText(ctx: CanvasRenderingContext2D, value: string, letterSpacing: number): void {
  ctx.font = value;
  // Not every WebView has it yet; the card reads fine without.
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
  }
}

/** Shortens with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Word-wraps into at most `maxLines`, the last one ellipsised if it overflows. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((l, i, all) => (i === all.length - 1 ? fit(ctx, l, maxWidth) : l));
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
