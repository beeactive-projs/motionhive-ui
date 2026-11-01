import { LoggedExercise, LoggedSet, WorkoutLog } from 'core';
import {
  checkmarkOutline,
  copyOutline,
  informationCircleOutline,
  logoInstagram,
} from 'ionicons/icons';

import { FEELINGS, STREAK_WORTH_SAYING, secondsToClock } from '../workouts.config';

/**
 * What a shared workout says (design "Share v3"), kept apart from where it
 * goes (`share-layout.config.ts`) and from the canvas that paints it
 * (`share-card.ts`), so the rules are tested without one
 * (`share-card.config.spec.ts`). The sheet is `share-workout-sheet`.
 */

// ─── The choices ───────────────────────────────────────────────────────────

/**
 * The two ways out. Quick is a clean sticker that goes straight into an
 * Instagram Story; Full is the branded card with the person's link, saved
 * or sent anywhere.
 */
export const ShareModes = { Quick: 'quick', Full: 'full' } as const;
export type ShareMode = (typeof ShareModes)[keyof typeof ShareModes];
export const SHARE_MODES: readonly ShareMode[] = [ShareModes.Quick, ShareModes.Full];

/**
 * The images' colours, whatever theme the app itself is in. Honey was a
 * theme until November 2026 ("honey everywhere was a strong colour"); it
 * stays the accent of all four.
 */
export const CardThemes = { Light: 'light', Dark: 'dark', Teal: 'teal', Dusk: 'dusk' } as const;
export type CardTheme = (typeof CardThemes)[keyof typeof CardThemes];
export const CARD_THEMES: readonly CardTheme[] = [
  CardThemes.Light,
  CardThemes.Dark,
  CardThemes.Teal,
  CardThemes.Dusk,
];

/** The Quick sticker: a medal with its details card, or the numbers as a flower of cells. */
export const StickerStyles = { Badge: 'badge', Cells: 'cells' } as const;
export type StickerStyle = (typeof StickerStyles)[keyof typeof StickerStyles];
export const STICKER_STYLES: readonly StickerStyle[] = [StickerStyles.Badge, StickerStyles.Cells];

/** The switches under "What to show", one per thing an image may say. */
export const ShareDetails = {
  Date: 'date',
  Duration: 'duration',
  Stats: 'stats',
  Exercises: 'exercises',
  Record: 'record',
  Number: 'number',
  Feeling: 'feeling',
  Location: 'location',
  Coach: 'coach',
  Photo: 'photo',
  Weights: 'weights',
  Link: 'link',
} as const;
export type ShareDetail = (typeof ShareDetails)[keyof typeof ShareDetails];

/** Every switch, on or off, for one image. */
export type ShareShow = Record<ShareDetail, boolean>;

/**
 * The switches the phone remembers. The coach is not one: naming a coach
 * is chosen on every share. The photo is remembered per way.
 */
export type RememberedDetail = Exclude<ShareDetail, 'coach' | 'photo'>;

/** The handle people are asked to tag; the same on every button. Never on an image. */
export const MOTIONHIVE_TAG = '@motionhive.fit';

/** The longest place a person can type (design "Share v3", 2). */
export const LOCATION_MAX = 40;
/** How many places the chips under the field offer. */
const PLACE_CHIPS = 5;

/**
 * Icon names the share sheets bind (`[icon]="icons.copy"`), and the set
 * they register. Bound, never written as a static attribute, so the
 * workouts registry's drift check leaves them to this one.
 */
export const SHARE_ICON_NAMES = {
  copy: 'copy-outline',
  info: 'information-circle-outline',
  instagram: 'logo-instagram',
  yes: 'checkmark-outline',
} as const;

export const SHARE_ICONS = {
  checkmarkOutline,
  copyOutline,
  informationCircleOutline,
  logoInstagram,
};

// ─── Remembered on the device ──────────────────────────────────────────────

/** The choices before Share v3, kept for everyone on the phone at once. */
export const LEGACY_SHARE_PREFS_KEY = 'mh.sharePrefs.v1';

/** One person's choices on this phone. */
export function sharePrefsKey(userId: string | null | undefined): string {
  return `mh.sharePrefs.v2.${userId ?? 'anon'}`;
}

/** The places one person typed on this phone, most recent first. */
export function sharePlacesKey(userId: string | null | undefined): string {
  return `mh.sharePlaces.v1.${userId ?? 'anon'}`;
}

/** What the share sheet remembers between workouts, per person. */
export interface SharePrefs {
  mode: ShareMode;
  theme: CardTheme;
  sticker: StickerStyle;
  show: Record<RememberedDetail, boolean>;
  /** The workout's photo behind the Quick sticker. */
  quickPhoto: boolean;
  /** The workout's photo as the Full card's background. */
  fullPhoto: boolean;
  /** The place last put on an image. */
  location: string;
  /** "Don't show the steps again" after saving to Photos. */
  guideHidden: boolean;
}

/**
 * The first share: everything about the workout on, the feeling off (the
 * design's), the location switch on but empty, so nothing is said about
 * where until the person types or picks a place.
 */
export const DEFAULT_SHARE_PREFS: SharePrefs = {
  mode: ShareModes.Quick,
  theme: CardThemes.Light,
  sticker: StickerStyles.Badge,
  show: {
    date: true,
    duration: true,
    stats: true,
    exercises: true,
    record: true,
    number: true,
    feeling: false,
    location: true,
    weights: true,
    link: true,
  },
  quickPhoto: true,
  fullPhoto: true,
  location: '',
  guideHidden: false,
};

const REMEMBERED = Object.keys(DEFAULT_SHARE_PREFS.show) as RememberedDetail[];

/**
 * The stored choices, each field checked on its own: one unknown value (an
 * older build, a hand edit) falls back to its default without losing the
 * rest. Nothing stored yet reads the choices from before Share v3
 * (`legacy`), so nobody loses theirs: a Honey theme becomes Light, and
 * weights stay hidden if either way had hidden them.
 */
export function parseSharePrefs(raw: string | null, legacy: string | null = null): SharePrefs {
  const stored = readObject(raw);
  if (stored) return fromStored(stored);
  const old = readObject(legacy);
  return old ? fromLegacy(old) : cloneDefaults();
}

function readObject(raw: string | null): Record<string, unknown> | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.find((option) => option === value) ?? fallback;

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

function cloneDefaults(): SharePrefs {
  return { ...DEFAULT_SHARE_PREFS, show: { ...DEFAULT_SHARE_PREFS.show } };
}

function fromStored(stored: Record<string, unknown>): SharePrefs {
  const d = DEFAULT_SHARE_PREFS;
  const show = readObject(JSON.stringify(stored['show'] ?? null)) ?? {};
  return {
    mode: pick(stored['mode'], SHARE_MODES, d.mode),
    theme: pick(stored['theme'], CARD_THEMES, d.theme),
    sticker: pick(stored['sticker'], STICKER_STYLES, d.sticker),
    show: Object.fromEntries(
      REMEMBERED.map((key) => [key, flag(show[key], d.show[key])]),
    ) as Record<RememberedDetail, boolean>,
    quickPhoto: flag(stored['quickPhoto'], d.quickPhoto),
    fullPhoto: flag(stored['fullPhoto'], d.fullPhoto),
    location: typeof stored['location'] === 'string' ? cleanPlace(stored['location']) : d.location,
    guideHidden: flag(stored['guideHidden'], d.guideHidden),
  };
}

function fromLegacy(old: Record<string, unknown>): SharePrefs {
  const prefs = cloneDefaults();
  prefs.mode = pick(old['mode'], SHARE_MODES, prefs.mode);
  prefs.theme = pick(old['theme'], CARD_THEMES, prefs.theme);
  prefs.sticker = pick(old['sticker'], STICKER_STYLES, prefs.sticker);
  prefs.show.weights = flag(old['quickKg'], true) && flag(old['fullKg'], true);
  prefs.show.record = flag(old['quickRecord'], true);
  prefs.show.link = flag(old['fullLink'], true);
  prefs.quickPhoto = flag(old['quickPhoto'], true);
  prefs.fullPhoto = old['fullBackground'] !== 'hive';
  prefs.guideHidden = flag(old['guideHidden'], false);
  return prefs;
}

/**
 * The switches for one image from the remembered ones: the way's own
 * photo switch, the link on the Full card only, and the coach as chosen
 * this time.
 */
export function showFor(prefs: SharePrefs, mode: ShareMode, coach: boolean): ShareShow {
  const full = mode === ShareModes.Full;
  return {
    ...prefs.show,
    link: full && prefs.show.link,
    photo: full ? prefs.fullPhoto : prefs.quickPhoto,
    coach,
  };
}

/** A typed place as kept and printed: one line, single spaces, 40 characters at most. */
export function cleanPlace(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, LOCATION_MAX).join('').trim();
}

/** The places kept on the phone; anything unreadable is none. */
export function parsePlaces(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((value): value is string => typeof value === 'string')
          .map(cleanPlace)
          .filter(Boolean)
          .slice(0, PLACE_CHIPS)
      : [];
  } catch {
    return [];
  }
}

/** A place put on an image goes first; the same place typed differently is not kept twice. */
export function rememberPlace(places: readonly string[], place: string): string[] {
  const clean = cleanPlace(place);
  if (!clean) return [...places];
  const key = placeKey(clean);
  return [clean, ...places.filter((known) => placeKey(known) !== key)].slice(0, PLACE_CHIPS);
}

/**
 * The chips under the location field: the places typed before, most
 * recent first, then the city on the profile when it is not one of them.
 * A handful at most. No map, no GPS: only what the person wrote.
 */
export function locationChips(
  city: string | null | undefined,
  places: readonly string[],
): string[] {
  const chips = [...places];
  const home = cleanPlace(city ?? '');
  if (home && !chips.some((place) => placeKey(place) === placeKey(home))) chips.push(home);
  return chips.slice(0, PLACE_CHIPS);
}

/** Case and accents aside, so "Iasi" and "Iași" are one place. */
function placeKey(place: string): string {
  return place
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
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

// ─── What the workout was ──────────────────────────────────────────────────

/**
 * What kind of workout it was, for what its numbers are: weights moved,
 * a bodyweight session (sets and reps, no kilograms anywhere), or cardio
 * (distance and pace, no exercise list).
 */
export const WorkoutKinds = {
  Strength: 'strength',
  Bodyweight: 'bodyweight',
  Cardio: 'cardio',
} as const;
export type WorkoutKind = (typeof WorkoutKinds)[keyof typeof WorkoutKinds];

function doneSets(log: WorkoutLog): LoggedSet[] {
  return (log.exercises ?? [])
    .filter((exercise) => !exercise.isSkipped)
    .flatMap((exercise) => exercise.sets ?? [])
    .filter((set) => set.isCompleted);
}

const loaded = (set: LoggedSet): boolean => (set.weightKg ?? 0) > 0;

export function workoutKind(log: WorkoutLog): WorkoutKind {
  const sets = doneSets(log);
  if (sets.some(loaded)) return WorkoutKinds.Strength;
  const covered = sets.some((set) => (set.distanceMeters ?? 0) > 0);
  const repped = sets.some((set) => (set.reps ?? 0) > 0);
  return covered && !repped ? WorkoutKinds.Cardio : WorkoutKinds.Bodyweight;
}

/** Whether there is any kilogram to hide: the weights switch shows only then. */
export function hasWeights(log: WorkoutLog): boolean {
  return doneSets(log).some(loaded);
}

// ─── What the image says ───────────────────────────────────────────────────

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** A number with what it counts: "9" and "sets", printed "9 sets" in a line. */
export interface ShareStat {
  value: string;
  label: string;
}

export interface ShareRecord {
  /** "New record". */
  title: string;
  /** "PR", for a cell. */
  short: string;
  exercise: string;
  /** "62.5 × 7", "+2.5 kg", "× 7" with weights hidden, or nothing to add. */
  best: string | null;
}

export interface ShareExercise {
  name: string;
  /** The best set: "62.5 × 7", "× 15", "1:30", "5.2 km"; null when there is none to show. */
  best: string | null;
}

export interface ShareCardContent {
  title: string;
  /** "Wed 28 Oct · 18:20". */
  date: string | null;
  location: string | null;
  /** "52" and "min", or "1:12" and "h". Null when off, or when it is not known. */
  duration: ShareStat | null;
  /** At most two numbers about the training itself. */
  stats: ShareStat[];
  record: ShareRecord | null;
  /** The first three exercises, with their best set; none for cardio. */
  exercises: ShareExercise[];
  /** "18th workout", with the cell's "18th" and "workout". */
  number: { line: string; value: string; label: string } | null;
  /** Weeks in a row, said only from two. */
  streak: { line: string; value: string; label: string } | null;
  feeling: { glyph: string; label: string } | null;
  /** "with Bogdan Daniel": only a coach who allows it, only when switched on. */
  coach: string | null;
  /** "app.motionhive.fit/@anna": the Full card only. */
  link: string | null;
  /** Monday to Sunday of the workout's week, true where something was trained. */
  week: readonly boolean[] | null;
  kind: WorkoutKind;
}

export interface ShareInput {
  log: WorkoutLog;
  show: ShareShow;
  location: string;
  profileUrl: string | null;
  /** The workout's week, Monday first; null when it could not be read. */
  week: readonly boolean[] | null;
  /** BCP 47, for the date and the numbers. */
  locale: string;
}

/**
 * What an image says, from the workout and the switches. Pure, so the
 * rules hold without a canvas: weights off means no kilogram anywhere, a
 * coach only when allowed and chosen, the link only on the Full card,
 * never the private note or anyone else's name.
 */
export function shareCardContent(input: ShareInput, t: Translate): ShareCardContent {
  const { log, show, locale } = input;
  const kind = workoutKind(log);
  // Kilograms only where something was lifted, and only when shown: a
  // bodyweight session never says "+0 kg".
  const weights = show.weights && hasWeights(log);
  const summary = log.summary;
  const records = log.personalRecords ?? [];
  const workoutNumber = summary?.workoutNumber ?? 0;
  const weeks = summary?.streakWeeks ?? 0;
  const coach = summary?.mentionableCoach?.name ?? null;
  const feeling = FEELINGS.find((entry) => entry.value === log.feelingRating);
  const place = cleanPlace(input.location);

  return {
    title: log.name,
    date: show.date ? shareDateLine(log.startedAt, locale) : null,
    location: show.location && place ? place : null,
    duration: show.duration ? durationStat(log.durationSeconds, t) : null,
    stats: show.stats ? workoutStats(log, kind, weights, t, locale) : [],
    record:
      show.record && records.length > 0
        ? {
            title: t('workouts.share.card.record'),
            short: t('workouts.share.card.pr'),
            exercise: records[0].exerciseName,
            best: recordBest(records[0], weights, locale),
          }
        : null,
    exercises:
      show.exercises && kind !== WorkoutKinds.Cardio ? topExercises(log, weights, locale) : [],
    number:
      show.number && workoutNumber > 0
        ? {
            line: t('workouts.share.card.number', { count: workoutNumber }),
            value: t('workouts.share.card.numberValue', { count: workoutNumber }),
            label: t('workouts.share.card.numberLabel'),
          }
        : null,
    streak:
      show.number && weeks >= STREAK_WORTH_SAYING
        ? {
            line: `${weeks} ${t('workouts.share.card.streak', { count: weeks })}`,
            value: String(weeks),
            label: t('workouts.share.card.streakShort', { count: weeks }),
          }
        : null,
    feeling: show.feeling && feeling ? { glyph: feeling.glyph, label: t(feeling.label) } : null,
    coach: show.coach && coach ? t('workouts.share.card.with', { name: coach }) : null,
    link: show.link && input.profileUrl ? linkLabel(input.profileUrl) : null,
    week: show.number && input.week ? input.week : null,
    kind,
  };
}

/**
 * "Wed 28 Oct · 18:20": the day the workout started and the time, in the
 * reader's language and sentence case (Inter on the image, never
 * uppercase). Built from parts so no comma creeps in after the weekday.
 */
export function shareDateLine(iso: string, locale: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  const day = [part('weekday'), part('day'), part('month')].filter(Boolean).join(' ');
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day.charAt(0).toLocaleUpperCase(locale)}${day.slice(1)} · ${time}`;
}

/** "52" and "min" under an hour, "1:12" and "h" from one; null when not known. */
export function durationStat(seconds: number | null | undefined, t: Translate): ShareStat | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return { value: String(minutes), label: t('workouts.share.card.minutes') };
  const hours = Math.floor(minutes / 60);
  return {
    value: `${hours}:${String(minutes % 60).padStart(2, '0')}`,
    label: t('workouts.share.card.hours'),
  };
}

/** A count as the reader writes it: "4.280" in Romanian, "4,280" in English. */
function grouped(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** A measure as the reader writes it, ungrouped: "62,5" / "62.5". */
function measure(value: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}

/**
 * The two numbers about the training: sets and volume for weights (sets
 * and reps with weights hidden), sets and reps for bodyweight (or time,
 * for holds), distance and pace for cardio.
 */
export function workoutStats(
  log: WorkoutLog,
  kind: WorkoutKind,
  weights: boolean,
  t: Translate,
  locale: string,
): ShareStat[] {
  const sets = doneSets(log);
  if (sets.length === 0) return [];
  if (kind === WorkoutKinds.Cardio) {
    const meters = sets.reduce((sum, set) => sum + (set.distanceMeters ?? 0), 0);
    const timed = sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
    const seconds = timed > 0 ? timed : (log.durationSeconds ?? 0);
    const stats = [distanceStat(meters, t, locale)];
    if (meters >= 100 && seconds > 0) {
      stats.push({
        value: secondsToClock(Math.round(seconds / (meters / 1000))),
        label: t('workouts.share.card.pace'),
      });
    }
    return stats;
  }
  const setStat = {
    value: grouped(sets.length, locale),
    label: t('workouts.share.card.sets', { count: sets.length }),
  };
  const volume = sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
  if (kind === WorkoutKinds.Strength && weights && volume > 0) {
    return [
      setStat,
      { value: grouped(Math.round(volume), locale), label: t('workouts.share.card.volume') },
    ];
  }
  const reps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  if (reps > 0) {
    return [
      setStat,
      { value: grouped(reps, locale), label: t('workouts.share.card.reps', { count: reps }) },
    ];
  }
  const held = sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
  if (held <= 0) return [setStat];
  const minutes = Math.max(1, Math.round(held / 60));
  return [setStat, { value: String(minutes), label: t('workouts.share.card.minutes') }];
}

/** "5,2" and "km" from a kilometre, "800" and "m" under it. */
function distanceStat(meters: number, t: Translate, locale: string): ShareStat {
  return meters >= 1000
    ? { value: measure(meters / 1000, locale, 1), label: t('workouts.share.card.km') }
    : { value: measure(meters, locale, 0), label: t('workouts.share.card.meters') };
}

function recordBest(
  record: NonNullable<WorkoutLog['personalRecords']>[number],
  weights: boolean,
  locale: string,
): string | null {
  const reps = record.setReps ?? null;
  const loadedSet = (record.setWeightKg ?? 0) > 0;
  if (!weights || (!loadedSet && reps != null)) return reps != null ? `× ${reps}` : null;
  if (loadedSet && reps != null) return `${measure(record.setWeightKg ?? 0, locale)} × ${reps}`;
  return record.deltaKg > 0 ? `+${measure(record.deltaKg, locale)} kg` : null;
}

/**
 * The first three exercises that were done, in the order they were done,
 * each with its best set: the heaviest (more reps break a tie), the most
 * reps, the longest hold or the longest distance.
 */
export function topExercises(log: WorkoutLog, weights: boolean, locale: string): ShareExercise[] {
  return [...(log.exercises ?? [])]
    .filter(
      (exercise) => !exercise.isSkipped && (exercise.sets ?? []).some((set) => set.isCompleted),
    )
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .slice(0, 3)
    .map((exercise) => ({
      name: exerciseName(exercise),
      best: bestSet(exercise, weights, locale),
    }));
}

function exerciseName(exercise: LoggedExercise): string {
  return exercise.exerciseNameSnapshot || exercise.exercise?.name || '';
}

function bestSet(exercise: LoggedExercise, weights: boolean, locale: string): string | null {
  const sets = (exercise.sets ?? []).filter((set) => set.isCompleted);
  const heavy = sets.filter(loaded);
  if (heavy.length > 0) {
    const top = heavy.reduce((best, set) =>
      (set.weightKg ?? 0) > (best.weightKg ?? 0) ||
      ((set.weightKg ?? 0) === (best.weightKg ?? 0) && (set.reps ?? 0) > (best.reps ?? 0))
        ? set
        : best,
    );
    const reps = top.reps ?? null;
    if (!weights) return reps != null ? `× ${reps}` : null;
    return reps != null
      ? `${measure(top.weightKg ?? 0, locale)} × ${reps}`
      : `${measure(top.weightKg ?? 0, locale)} kg`;
  }
  const reps = Math.max(0, ...sets.map((set) => set.reps ?? 0));
  if (reps > 0) return `× ${reps}`;
  const hold = Math.max(0, ...sets.map((set) => set.durationSeconds ?? 0));
  const meters = Math.max(0, ...sets.map((set) => set.distanceMeters ?? 0));
  if (meters > 0) {
    return meters >= 1000
      ? `${measure(meters / 1000, locale, 1)} km`
      : `${measure(meters, locale, 0)} m`;
  }
  return hold > 0 ? secondsToClock(hold) : null;
}

/**
 * Monday to Sunday of the week `iso` falls in, true on the days one of
 * `days` (workout start times) falls on. The day itself is always true.
 */
export function weekOf(iso: string, days: readonly string[]): boolean[] {
  const start = mondayOf(new Date(iso));
  const week = Array.from({ length: 7 }, () => false);
  for (const day of [iso, ...days]) {
    const index = Math.floor((startOfDay(new Date(day)).getTime() - start.getTime()) / 86_400_000);
    if (index >= 0 && index < 7) week[index] = true;
  }
  return week;
}

/** Local midnight of the Monday the date's week starts on, and of the Monday after. */
export function weekBounds(iso: string): { from: Date; to: Date } {
  const from = mondayOf(new Date(iso));
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mondayOf(date: Date): Date {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

// ─── Links and colours ─────────────────────────────────────────────────────

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

/** `#rrggbb` at an opacity, for the see-through fills drawn over a card. */
export function withAlpha(hex: string, alpha: number): string {
  const full = toHexColor(hex);
  if (!full) return hex;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
