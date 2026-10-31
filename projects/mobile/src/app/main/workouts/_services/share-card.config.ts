import { PersonalRecord, WorkoutLog } from 'core';
import {
  checkmarkOutline,
  closeOutline,
  copyOutline,
  logoInstagram,
} from 'ionicons/icons';

import { STREAK_WORTH_SAYING, durationClock, formatMeasure, workoutTiles } from '../workouts.config';

/**
 * What a shared workout says and how it is put together, kept apart from
 * the canvas so the rules are tested without one (`share-card.config.spec.ts`).
 * The drawing is `share-card.ts`; the sheet is `share-workout-sheet`.
 */

// ─── The choices ───────────────────────────────────────────────────────────

/**
 * The two ways out. Quick is a clean sticker that goes straight into an
 * Instagram Story; Full is the branded card with the person's link, saved
 * or sent anywhere.
 */
export const ShareModes = { Quick: 'quick', Full: 'full' } as const;
export type ShareMode = (typeof ShareModes)[keyof typeof ShareModes];

/** The sheet's steps: picking a way the first time, then that way's options. */
export const ShareSteps = { Choose: 'choose', ...ShareModes } as const;
export type ShareStep = (typeof ShareSteps)[keyof typeof ShareSteps];

/** The card's colours, whatever theme the app itself is in. */
export const CardThemes = { Light: 'light', Dark: 'dark', Honey: 'honey' } as const;
export type CardTheme = (typeof CardThemes)[keyof typeof CardThemes];
export const CARD_THEMES: readonly CardTheme[] = [
  CardThemes.Light,
  CardThemes.Dark,
  CardThemes.Honey,
];

/** The Quick sticker: one hexagon badge, or the stats as a cluster of cells. */
export const StickerStyles = { Badge: 'badge', Cells: 'cells' } as const;
export type StickerStyle = (typeof StickerStyles)[keyof typeof StickerStyles];
export const STICKER_STYLES: readonly StickerStyle[] = [StickerStyles.Badge, StickerStyles.Cells];

/** What the Full card sits on. */
export const FullBackgrounds = { Hive: 'hive', Photo: 'photo' } as const;
export type FullBackground = (typeof FullBackgrounds)[keyof typeof FullBackgrounds];
export const FULL_BACKGROUNDS: readonly FullBackground[] = [
  FullBackgrounds.Hive,
  FullBackgrounds.Photo,
];

/** The handle people are asked to tag; the same on every card and button. */
export const MOTIONHIVE_TAG = '@motionhive.fit';
/** Printed when there is no personal link to print. */
export const SITE_LABEL = 'motionhive.fit';

/**
 * Icon names the share sheets bind (`[icon]="icons.copy"`), and the set
 * they register. Bound, never written as a static attribute, so the
 * workouts registry's drift check leaves them to this one.
 */
export const SHARE_ICON_NAMES = {
  copy: 'copy-outline',
  instagram: 'logo-instagram',
  no: 'close-outline',
  yes: 'checkmark-outline',
} as const;

export const SHARE_ICONS = {
  checkmarkOutline,
  closeOutline,
  copyOutline,
  logoInstagram,
};

// ─── Remembered on the device ──────────────────────────────────────────────

/** localStorage key; bump the version when the shape stops being compatible. */
export const SHARE_PREFS_KEY = 'mh.sharePrefs.v1';

/**
 * What the share sheet remembers between workouts. The coach's name is
 * not here on purpose: it starts off on every share.
 */
export interface SharePrefs {
  /** Null until the person picks a way once; until then the sheet asks. */
  mode: ShareMode | null;
  theme: CardTheme;
  sticker: StickerStyle;
  quickKg: boolean;
  quickRecord: boolean;
  quickPhoto: boolean;
  fullBackground: FullBackground;
  fullKg: boolean;
  fullLink: boolean;
  /** "Don't show the steps again" after saving to Photos. */
  guideHidden: boolean;
}

export const DEFAULT_SHARE_PREFS: SharePrefs = {
  mode: null,
  theme: CardThemes.Light,
  sticker: StickerStyles.Badge,
  quickKg: true,
  quickRecord: true,
  quickPhoto: true,
  fullBackground: FullBackgrounds.Photo,
  fullKg: true,
  fullLink: true,
  guideHidden: false,
};

/**
 * The stored prefs, each field checked on its own: one unknown value (an
 * older build, a hand edit) falls back to its default without losing the
 * rest.
 */
export function parseSharePrefs(raw: string | null): SharePrefs {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      stored = parsed as Record<string, unknown>;
    }
  } catch {
    // Unreadable: start from the defaults.
  }
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.find((option) => option === value) ?? fallback;
  const flag = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;
  const d = DEFAULT_SHARE_PREFS;
  const modes: readonly ShareMode[] = [ShareModes.Quick, ShareModes.Full];
  return {
    mode: modes.find((mode) => mode === stored['mode']) ?? null,
    theme: pick(stored['theme'], CARD_THEMES, d.theme),
    sticker: pick(stored['sticker'], STICKER_STYLES, d.sticker),
    quickKg: flag(stored['quickKg'], d.quickKg),
    quickRecord: flag(stored['quickRecord'], d.quickRecord),
    quickPhoto: flag(stored['quickPhoto'], d.quickPhoto),
    fullBackground: pick(stored['fullBackground'], FULL_BACKGROUNDS, d.fullBackground),
    fullKg: flag(stored['fullKg'], d.fullKg),
    fullLink: flag(stored['fullLink'], d.fullLink),
    guideHidden: flag(stored['guideHidden'], d.guideHidden),
  };
}

/** Where the sheet opens: the remembered way, or the choice the first time. */
export function openingStep(prefs: SharePrefs): ShareStep {
  return prefs.mode ?? ShareSteps.Choose;
}

/** Which way the chooser shows as picked: the remembered one, else Quick. */
export function suggestedMode(prefs: SharePrefs): ShareMode {
  return prefs.mode ?? ShareModes.Quick;
}

/** The lines that say where a saved card goes. */
export interface SaveCopyKeys {
  action: string;
  done: string;
  denied: string;
}

/**
 * Named the way the phone names it: Photos on iOS (and the browser build),
 * the gallery on Android, which has no app called Photos. `platform` is
 * Capacitor's.
 */
export function saveCopyKeys(platform: string): SaveCopyKeys {
  const base = platform === 'android' ? 'workouts.share.save.gallery' : 'workouts.share.save';
  return { action: `${base}.action`, done: `${base}.done`, denied: `${base}.denied` };
}

// ─── What the card says ────────────────────────────────────────────────────

export interface ShareCardOptions {
  /** Many people do not want to show weights; off removes every kg. */
  showKg: boolean;
  showRecord: boolean;
  /** Off by default, and only ever on for a coach who allows it. */
  showCoach: boolean;
  /** The person's own profile link instead of the bare site. */
  showLink: boolean;
}

export interface ShareStat {
  label: string;
  value: string;
  /** The volume, picked out in the theme's accent. */
  accent: boolean;
}

export interface ShareRecord {
  /** "New record": the one record the card shows. */
  title: string;
  /** "Back squat". */
  exercise: string;
  /** "100 kg", "+5 kg", or null when weights stay private. */
  value: string | null;
  /** "× 5", the set that earned it, when it is known and weights show. */
  reps: string | null;
}

export interface ShareCardContent {
  title: string;
  /** "your 18th workout · 2 records"; empty when there is nothing to say. */
  subtitle: string;
  /** Duration first, then at most two of the session's own measures. */
  stats: ShareStat[];
  record: ShareRecord | null;
  /** Weeks in a row, said only from two. */
  streak: { value: string; label: string } | null;
  coach: string | null;
  /** "app.motionhive.fit/@anna", or the bare site. */
  link: string;
}

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * What the card says, from the workout and the person's choices. Pure, so
 * the rules (weights off means no kg anywhere, a coach only when allowed
 * and chosen, the link only when there is one) hold without a canvas.
 */
export function shareCardContent(
  log: WorkoutLog,
  options: ShareCardOptions,
  t: Translate,
  profileUrl: string | null,
): ShareCardContent {
  const volume = t('workouts.tiles.volume');
  const measures = workoutTiles(log)
    .filter((tile) => options.showKg || tile.label !== volume)
    .slice(0, 2)
    .map((tile) => ({ ...tile, accent: tile.label === volume }));
  const stats: ShareStat[] = [
    {
      label: t('workouts.tiles.duration'),
      value: durationClock(log.durationSeconds),
      accent: false,
    },
    ...measures,
  ];

  const records = log.personalRecords ?? [];
  const showRecords = options.showRecord && records.length > 0;
  const subtitle = [
    log.summary?.workoutNumber
      ? t('workouts.finish.workoutNumber', { count: log.summary.workoutNumber })
      : '',
    showRecords ? t('workouts.share.card.records', { count: records.length }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const weeks = log.summary?.streakWeeks ?? 0;
  const coach = log.summary?.mentionableCoach;

  return {
    title: log.name,
    subtitle,
    stats,
    record: showRecords
      ? {
          // The one record the card shows; the subtitle counts them all.
          title: t('workouts.finish.highlights.record', { count: 1 }),
          ...shareRecord(records[0], options.showKg),
        }
      : null,
    streak:
      weeks >= STREAK_WORTH_SAYING
        ? { value: String(weeks), label: t('workouts.share.card.streak', { count: weeks }) }
        : null,
    coach: options.showCoach && coach ? t('workouts.share.card.coach', { name: coach.name }) : null,
    link: options.showLink && profileUrl ? linkLabel(profileUrl) : SITE_LABEL,
  };
}

/** "100 kg × 5" when the set is known, "+5 kg" when only the gain is, nothing without weights. */
function shareRecord(record: PersonalRecord, showKg: boolean): Omit<ShareRecord, 'title'> {
  if (!showKg) return { exercise: record.exerciseName, value: null, reps: null };
  if (record.setWeightKg != null && record.setReps != null) {
    return {
      exercise: record.exerciseName,
      value: `${formatMeasure(record.setWeightKg)} kg`,
      reps: `× ${record.setReps}`,
    };
  }
  return {
    exercise: record.exerciseName,
    value: `+${formatMeasure(record.deltaKg)} kg`,
    reps: null,
  };
}

/** A URL as printed on a card: no scheme, no `www.`, no trailing slash. */
export function linkLabel(url: string): string {
  return url
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/**
 * A printed link split where it may break: the host, then the handle
 * ("app.motionhive.fit" and "@anna"), so a narrow line wraps at the slash
 * instead of inside the name. A link with no path is all host.
 */
export function linkParts(label: string): { host: string; path: string } {
  const slash = label.indexOf('/');
  return slash < 0
    ? { host: label, path: '' }
    : { host: label.slice(0, slash), path: label.slice(slash + 1) };
}

// ─── Text on a card ────────────────────────────────────────────────────────

/** How wide a string draws in the face currently set on the canvas. */
export type MeasureText = (text: string) => number;

/** Shortens with an ellipsis until it fits; a line that fits is left alone. */
export function fitLine(text: string, maxWidth: number, measure: MeasureText): string {
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
  measure: MeasureText,
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

// ─── The cells sticker ─────────────────────────────────────────────────────

export const StickerCellKinds = {
  /** A number with its label, on the card colour. */
  Stat: 'stat',
  /** The workout's name in the middle, ringed. */
  Title: 'title',
  /** The record, filled honey with the white dot. */
  Record: 'record',
  Streak: 'streak',
  /** An empty place that keeps the cluster a honeycomb. */
  Ghost: 'ghost',
} as const;
export type StickerCellKind = (typeof StickerCellKinds)[keyof typeof StickerCellKinds];

export interface StickerCell {
  /** Column in cell widths from the centre: -1, -0.5, 0, 0.5 or 1. */
  x: number;
  /** Row from the top: 0, 1 or 2. */
  y: number;
  kind: StickerCellKind;
  value: string;
  label: string;
}

/**
 * The seven cells of the cells sticker, a honeycomb flower of 2 + 3 + 2:
 * the name in the middle, the numbers around it, the record (when there
 * is one) top right where it is seen first, the streak under it. A place
 * with nothing true to say stays a faint ghost cell.
 */
export function stickerCells(content: ShareCardContent): StickerCell[] {
  const ghost = (x: number, y: number): StickerCell => ({
    x,
    y,
    kind: StickerCellKinds.Ghost,
    value: '',
    label: '',
  });
  const stat = (x: number, y: number, index: number): StickerCell => {
    const found = content.stats[index];
    return found
      ? { x, y, kind: StickerCellKinds.Stat, value: found.value, label: found.label }
      : ghost(x, y);
  };
  const record = content.record;
  return [
    stat(-0.5, 0, 0),
    record
      ? {
          x: 0.5,
          y: 0,
          kind: StickerCellKinds.Record,
          value: record.value ?? '🏆',
          label: record.exercise,
        }
      : ghost(0.5, 0),
    stat(-1, 1, 1),
    { x: 0, y: 1, kind: StickerCellKinds.Title, value: content.title, label: '' },
    stat(1, 1, 2),
    ghost(-0.5, 2),
    content.streak
      ? {
          x: 0.5,
          y: 2,
          kind: StickerCellKinds.Streak,
          value: content.streak.value,
          label: content.streak.label,
        }
      : ghost(0.5, 2),
  ];
}

// ─── Colours ───────────────────────────────────────────────────────────────

/**
 * A CSS colour as `#rrggbb`, the form Instagram takes for a Story's
 * background colours. Reads `#rgb`, `#rrggbb` and `rgb(r, g, b)`; anything
 * else is null.
 */
export function toHexColor(value: string): string | null {
  const text = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(text);
  if (!rgb) return null;
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** `#rrggbb` at an opacity, for the faint fills drawn over a card. */
export function withAlpha(hex: string, alpha: number): string {
  const full = toHexColor(hex);
  if (!full) return hex;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
