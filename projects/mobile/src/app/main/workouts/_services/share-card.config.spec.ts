/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { LoggedExercise, WorkoutLog, createMessageFormatTranslator, translate } from 'core';

import sharedRo from '../../../../../../core/src/i18n/ro.json';
import appRo from '../../../../../public/i18n/ro.json';
import {
  CardThemes,
  DEFAULT_SHARE_PREFS,
  SHARE_ICONS,
  SHARE_ICON_NAMES,
  ShareDetail,
  ShareInput,
  ShareModes,
  StickerStyles,
  WorkoutKinds,
  cleanPlace,
  durationStat,
  hasWeights,
  linkLabel,
  linkParts,
  locationChips,
  parsePlaces,
  parseSharePrefs,
  rememberPlace,
  saveCopyKeys,
  shareCardContent,
  shareDateLine,
  sharePlacesKey,
  sharePrefsKey,
  showFor,
  toHexColor,
  weekBounds,
  weekOf,
  withAlpha,
  workoutKind,
} from './share-card.config';

const t = (key: string, params?: Record<string, unknown>) => translate(key, params);
const ro = createMessageFormatTranslator({ ...sharedRo, ...appRo }, 'ro');

/** 28 October 2026, 18:20 on the phone's own clock. */
const STARTED = new Date(2026, 9, 28, 18, 20).toISOString();

type SetShape = {
  weightKg?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  isCompleted?: boolean;
};

function exercise(order: number, name: string, sets: SetShape[], skipped = false): LoggedExercise {
  return {
    orderIndex: order,
    exerciseNameSnapshot: name,
    isSkipped: skipped,
    sets: sets.map((set, i) => ({
      id: `${order}-${i}`,
      weightKg: null,
      reps: null,
      durationSeconds: null,
      distanceMeters: null,
      isCompleted: true,
      ...set,
    })),
  } as unknown as LoggedExercise;
}

function log(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'wl-1',
    name: 'Back and shoulders',
    startedAt: STARTED,
    completedAt: new Date(2026, 9, 28, 19, 12).toISOString(),
    durationSeconds: 3120,
    pausedSeconds: 0,
    feelingRating: 5,
    notes: 'A private note',
    exercises: [
      exercise(1, 'Squat', [
        { weightKg: 100, reps: 5 },
        { weightKg: 100, reps: 4 },
      ]),
      exercise(0, 'Bench press', [
        { weightKg: 60, reps: 8 },
        { weightKg: 62.5, reps: 7 },
        { weightKg: 62.5, reps: 5 },
      ]),
      exercise(2, 'Barbell row', [{ weightKg: 60, reps: 8 }]),
      exercise(3, 'Deadlift', [{ weightKg: 140, reps: 3 }]),
      exercise(4, 'Skipped curl', [{ weightKg: 20, reps: 10 }], true),
    ],
    personalRecords: [
      {
        id: 'pr',
        exerciseId: 'bench',
        exerciseName: 'Bench press',
        weightKg: 75,
        deltaKg: 2.5,
        setWeightKg: 62.5,
        setReps: 7,
      },
    ],
    summary: {
      workoutNumber: 18,
      streakWeeks: 3,
      previousVolumeKg: null,
      coachName: 'Bogdan Daniel',
      mentionableCoach: { name: 'Bogdan Daniel' },
    },
    ...over,
  } as unknown as WorkoutLog;
}

const ALL: Record<ShareDetail, boolean> = {
  date: true,
  duration: true,
  stats: true,
  exercises: true,
  record: true,
  number: true,
  feeling: true,
  location: true,
  coach: true,
  photo: true,
  weights: true,
  link: true,
};

function input(
  over: Partial<ShareInput> = {},
  show: Partial<Record<ShareDetail, boolean>> = {},
): ShareInput {
  return {
    log: log(),
    show: { ...ALL, ...show },
    location: 'World Class Iulius',
    profileUrl: 'https://app.motionhive.fit/@anna',
    week: [true, false, true, false, false, false, false],
    locale: 'en-GB',
    ...over,
  };
}

describe('shareCardContent: what an image says', () => {
  it('says the workout with everything on', () => {
    const card = shareCardContent(input(), t);
    expect(card.title).toBe('Back and shoulders');
    expect(card.date).toBe('Wed 28 Oct · 18:20');
    expect(card.location).toBe('World Class Iulius');
    expect(card.duration).toEqual({ value: '52', label: 'min' });
    expect(card.stats).toEqual([
      { value: '7', label: 'sets' },
      { value: '3,030', label: 'kg volume' },
    ]);
    expect(card.record).toEqual({
      title: 'New record',
      short: 'PR',
      exercise: 'Bench press',
      best: '62.5 × 7',
    });
    expect(card.number).toEqual({ line: '18th workout', value: '18th', label: 'workout' });
    expect(card.streak).toEqual({ line: '3 weeks in a row', value: '3', label: 'wks in a row' });
    expect(card.feeling).toEqual({ glyph: '🤩', label: 'Great' });
    expect(card.coach).toBe('with Bogdan Daniel');
    expect(card.link).toBe('app.motionhive.fit/@anna');
    expect(card.kind).toBe(WorkoutKinds.Strength);
  });

  it('lists the first three exercises done, in order, with their best set', () => {
    expect(shareCardContent(input(), t).exercises).toEqual([
      { name: 'Bench press', best: '62.5 × 7' },
      { name: 'Squat', best: '100 × 5' },
      { name: 'Barbell row', best: '60 × 8' },
    ]);
  });

  it('says it in Romanian, with Romanian numbers and plurals', () => {
    const card = shareCardContent(
      input({ locale: 'ro-RO', log: log({ name: 'Antrenament complet pentru spate și umeri' }) }),
      ro,
    );
    expect(card.date).toBe('Mie. 28 oct. · 18:20');
    expect(card.stats).toEqual([
      { value: '7', label: 'serii' },
      { value: '3.030', label: 'kg volum' },
    ]);
    expect(card.record?.best).toBe('62,5 × 7');
    expect(card.number?.line).toBe('Al 18-lea antrenament');
    expect(card.streak?.line).toBe('3 săptămâni la rând');
    expect(card.coach).toBe('cu Bogdan Daniel');
    const first = shareCardContent(
      input({
        locale: 'ro-RO',
        log: log({ summary: { workoutNumber: 1, streakWeeks: 20, previousVolumeKg: null } }),
      }),
      ro,
    );
    expect(first.number?.line).toBe('Primul antrenament');
    expect(first.streak?.line).toBe('20 de săptămâni la rând');
  });

  it('leaves out every kilogram when weights stay private', () => {
    const card = shareCardContent(input({}, { weights: false }), t);
    expect(JSON.stringify(card)).not.toMatch(/kg|62\.5|100 ×/);
    expect(card.stats).toEqual([
      { value: '7', label: 'sets' },
      { value: '40', label: 'reps' },
    ]);
    expect(card.record?.best).toBe('× 7');
    expect(card.exercises[0]).toEqual({ name: 'Bench press', best: '× 7' });
  });

  it('never says the private note, and names a coach only when allowed and on', () => {
    expect(JSON.stringify(shareCardContent(input(), t))).not.toContain('private note');
    expect(shareCardContent(input({}, { coach: false }), t).coach).toBeNull();
    const notAllowed = log({
      summary: {
        workoutNumber: 3,
        streakWeeks: 0,
        previousVolumeKg: null,
        coachName: 'Bogdan Daniel',
        mentionableCoach: null,
      },
    });
    expect(shareCardContent(input({ log: notAllowed }), t).coach).toBeNull();
  });

  it('switches each detail off on its own, and keeps the name', () => {
    const none = shareCardContent(
      input(
        {},
        {
          date: false,
          duration: false,
          stats: false,
          exercises: false,
          record: false,
          number: false,
          feeling: false,
          location: false,
          coach: false,
          link: false,
        },
      ),
      t,
    );
    expect(none).toMatchObject({
      title: 'Back and shoulders',
      date: null,
      location: null,
      duration: null,
      stats: [],
      record: null,
      exercises: [],
      number: null,
      streak: null,
      feeling: null,
      coach: null,
      link: null,
      week: null,
    });
  });

  it('says nothing that is not there: no record, no rating, a short streak, no link', () => {
    const quiet = log({
      personalRecords: [],
      feelingRating: null,
      summary: { workoutNumber: 0, streakWeeks: 1, previousVolumeKg: null },
    });
    const card = shareCardContent(input({ log: quiet, profileUrl: null }), t);
    expect(card.record).toBeNull();
    expect(card.feeling).toBeNull();
    expect(card.number).toBeNull();
    expect(card.streak).toBeNull();
    expect(card.link).toBeNull();
  });

  it('keeps a place to one line of 40 characters, and an empty one off the image', () => {
    const long = shareCardContent(
      input({ location: '  Bazinul   Olimpic Universitatea, Cluj-Napoca  ' }),
      t,
    );
    expect(long.location).toBe('Bazinul Olimpic Universitatea, Cluj-Napo');
    expect(Array.from(long.location ?? '')).toHaveLength(40);
    expect(shareCardContent(input({ location: '   ' }), t).location).toBeNull();
  });

  it('treats a bodyweight workout as sets and reps, with no weights to hide', () => {
    const bodyweight = log({
      exercises: [
        exercise(0, 'Push-ups', [{ reps: 15 }, { reps: 12 }]),
        exercise(1, 'Pull-ups', [{ reps: 8 }]),
      ],
    });
    expect(workoutKind(bodyweight)).toBe(WorkoutKinds.Bodyweight);
    expect(hasWeights(bodyweight)).toBe(false);
    const card = shareCardContent(input({ log: bodyweight }, { weights: false }), t);
    expect(card.stats).toEqual([
      { value: '3', label: 'sets' },
      { value: '35', label: 'reps' },
    ]);
    expect(card.exercises).toEqual([
      { name: 'Push-ups', best: '× 15' },
      { name: 'Pull-ups', best: '× 8' },
    ]);
    // A bodyweight record says the reps, never "+0 kg", even with weights on.
    const record = log({
      exercises: bodyweight.exercises,
      personalRecords: [
        {
          id: 'pr',
          exerciseId: 'p',
          exerciseName: 'Pull-ups',
          weightKg: 0,
          deltaKg: 0,
          setWeightKg: null,
          setReps: 8,
        },
      ],
    });
    const withWeights = shareCardContent(input({ log: record }), t);
    expect(withWeights.record?.best).toBe('× 8');
    expect(JSON.stringify(withWeights)).not.toContain('kg');
  });

  it('says the gain when the set that earned a record is not known', () => {
    const gain = log({
      personalRecords: [
        {
          id: 'pr',
          exerciseId: 'b',
          exerciseName: 'Bench press',
          weightKg: 80,
          deltaKg: 2.5,
          setWeightKg: null,
          setReps: null,
        },
      ],
    });
    expect(shareCardContent(input({ log: gain }), t).record?.best).toBe('+2.5 kg');
  });

  it('treats a run as distance and pace, with no exercise list', () => {
    const run = log({
      durationSeconds: 1920,
      personalRecords: [],
      exercises: [exercise(0, 'Running', [{ distanceMeters: 5200, durationSeconds: 1920 }])],
    });
    expect(workoutKind(run)).toBe(WorkoutKinds.Cardio);
    const card = shareCardContent(input({ log: run, locale: 'ro-RO' }), ro);
    expect(card.stats).toEqual([
      { value: '5,2', label: 'km' },
      { value: '6:09', label: 'min/km' },
    ]);
    expect(card.exercises).toEqual([]);
    expect(card.duration).toEqual({ value: '32', label: 'min' });
  });
});

describe('the date line and the duration', () => {
  it('writes the day and the time in sentence case, Inter style, never upper case', () => {
    expect(shareDateLine(STARTED, 'en-GB')).toBe('Wed 28 Oct · 18:20');
    expect(shareDateLine(STARTED, 'ro-RO')).toBe('Mie. 28 oct. · 18:20');
  });

  it('says minutes under an hour and hours from one', () => {
    expect(durationStat(3120, t)).toEqual({ value: '52', label: 'min' });
    expect(durationStat(4320, t)).toEqual({ value: '1:12', label: 'h' });
    expect(durationStat(3600, t)).toEqual({ value: '1:00', label: 'h' });
    expect(durationStat(20, t)).toEqual({ value: '1', label: 'min' });
    expect(durationStat(null, t)).toBeNull();
    expect(durationStat(0, t)).toBeNull();
  });
});

describe('the week comb', () => {
  it('marks the days of the workout week that saw training, Monday first', () => {
    const wednesday = STARTED;
    const monday = new Date(2026, 9, 26, 7).toISOString();
    const lastSunday = new Date(2026, 9, 25, 9).toISOString();
    const sunday = new Date(2026, 10, 1, 9).toISOString();
    expect(weekOf(wednesday, [monday, lastSunday, sunday])).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
    const { from, to } = weekBounds(wednesday);
    expect(from.getDay()).toBe(1);
    expect(from.getDate()).toBe(26);
    expect((to.getTime() - from.getTime()) / 86_400_000).toBeCloseTo(7, 0);
  });
});

describe('share prefs: kept per person on the phone', () => {
  it('opens Quick, Light and Badge the first time, everything on but the feeling', () => {
    const prefs = parseSharePrefs(null);
    expect(prefs).toEqual(DEFAULT_SHARE_PREFS);
    expect(prefs.mode).toBe(ShareModes.Quick);
    expect(prefs.show.feeling).toBe(false);
    expect(prefs.show.location).toBe(true);
    expect(prefs.location).toBe('');
  });

  it('keys them by person', () => {
    expect(sharePrefsKey('u1')).toBe('mh.sharePrefs.v2.u1');
    expect(sharePlacesKey('u1')).toBe('mh.sharePlaces.v1.u1');
    expect(sharePrefsKey(null)).toBe('mh.sharePrefs.v2.anon');
  });

  it('reads back what was written', () => {
    const prefs = {
      ...DEFAULT_SHARE_PREFS,
      mode: ShareModes.Full,
      theme: CardThemes.Dusk,
      sticker: StickerStyles.Cells,
      show: { ...DEFAULT_SHARE_PREFS.show, weights: false, feeling: true },
      fullPhoto: false,
      location: 'Parcul Copou',
      guideHidden: true,
    };
    expect(parseSharePrefs(JSON.stringify(prefs))).toEqual(prefs);
  });

  it('keeps every good field when one is not', () => {
    const parsed = parseSharePrefs(
      JSON.stringify({ theme: 'neon', mode: 'story', show: { weights: false, date: 'yes' } }),
    );
    expect(parsed.theme).toBe(CardThemes.Light);
    expect(parsed.mode).toBe(ShareModes.Quick);
    expect(parsed.show.weights).toBe(false);
    expect(parsed.show.date).toBe(true);
    expect(parseSharePrefs('{not json')).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs('[1,2]')).toEqual(DEFAULT_SHARE_PREFS);
  });

  it('carries the old choices over: Honey becomes Light, hidden weights stay hidden', () => {
    const legacy = JSON.stringify({
      mode: 'full',
      theme: 'honey',
      sticker: 'cells',
      quickKg: true,
      fullKg: false,
      quickRecord: false,
      quickPhoto: false,
      fullBackground: 'hive',
      fullLink: false,
      guideHidden: true,
    });
    const prefs = parseSharePrefs(null, legacy);
    expect(prefs).toMatchObject({
      mode: ShareModes.Full,
      theme: CardThemes.Light,
      sticker: StickerStyles.Cells,
      quickPhoto: false,
      fullPhoto: false,
      guideHidden: true,
    });
    expect(prefs.show).toMatchObject({ weights: false, record: false, link: false, date: true });
    expect(parseSharePrefs(null, JSON.stringify({ theme: 'dark' })).theme).toBe(CardThemes.Dark);
    // Once there are v2 choices, the old ones are not read again.
    expect(parseSharePrefs(JSON.stringify({ theme: 'teal' }), legacy).theme).toBe(CardThemes.Teal);
  });

  it('puts the way’s own photo and the Full card’s link in, and the coach as chosen', () => {
    const prefs = { ...DEFAULT_SHARE_PREFS, quickPhoto: false, fullPhoto: true };
    expect(showFor(prefs, ShareModes.Quick, false)).toMatchObject({
      photo: false,
      link: false,
      coach: false,
    });
    expect(showFor(prefs, ShareModes.Full, true)).toMatchObject({
      photo: true,
      link: true,
      coach: true,
    });
  });
});

describe('places', () => {
  it('cleans a typed place to one line of 40 characters', () => {
    expect(cleanPlace('  Sala   Iulius\n Mall ')).toBe('Sala Iulius Mall');
    expect(cleanPlace('x'.repeat(50))).toHaveLength(40);
  });

  it('remembers the place last used first, once, five at most', () => {
    let places = ['World Class Iulius', 'Parcul Copou'];
    places = rememberPlace(places, 'parcul copou');
    expect(places).toEqual(['parcul copou', 'World Class Iulius']);
    places = rememberPlace(places, 'Iasi');
    places = rememberPlace(places, 'Iași');
    expect(places.filter((place) => place.startsWith('Ia'))).toEqual(['Iași']);
    for (const place of ['A', 'B', 'C', 'D', 'E']) places = rememberPlace(places, place);
    expect(places).toEqual(['E', 'D', 'C', 'B', 'A']);
    expect(rememberPlace(places, '   ')).toEqual(places);
  });

  it('offers the places used before, then the profile city', () => {
    expect(locationChips('Iași', ['World Class Iulius'])).toEqual(['World Class Iulius', 'Iași']);
    expect(locationChips('Iasi', ['Iași', 'Copou'])).toEqual(['Iași', 'Copou']);
    expect(locationChips(null, [])).toEqual([]);
    expect(locationChips('Iași', ['A', 'B', 'C', 'D', 'E'])).toHaveLength(5);
  });

  it('reads what is stored, and nothing from what is not', () => {
    expect(parsePlaces(JSON.stringify(['Copou', 3, '', 'Iulius']))).toEqual(['Copou', 'Iulius']);
    expect(parsePlaces('nope')).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });
});

describe('colours and links', () => {
  it('gives Instagram #rrggbb whatever the token is written as', () => {
    expect(toHexColor('#FFF')).toBe('#ffffff');
    expect(toHexColor(' #0e1b31 ')).toBe('#0e1b31');
    expect(toHexColor('rgb(245, 158, 11)')).toBe('#f59e0b');
    expect(toHexColor('rgba(245, 158, 11, 0.22)')).toBe('#f59e0b');
    expect(toHexColor('var(--x)')).toBeNull();
    expect(withAlpha('#b45309', 0.16)).toBe('rgba(180, 83, 9, 0.16)');
  });

  it('prints a link without its scheme, split at its slash', () => {
    expect(linkLabel('https://app.motionhive.fit/@anna')).toBe('app.motionhive.fit/@anna');
    expect(linkLabel('https://www.motionhive.fit/')).toBe('motionhive.fit');
    expect(linkParts('app.motionhive.fit/@annapopescu')).toEqual({
      host: 'app.motionhive.fit',
      path: '@annapopescu',
    });
    expect(linkParts('motionhive.fit')).toEqual({ host: 'motionhive.fit', path: '' });
  });
});

/** The share sheets' templates, inlined at build time by Vite. */
const templates = import.meta.glob(
  ['../_sheets/share-*/*.html', '../_sheets/adjust-duration-sheet/*.html'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const camel = (name: string) =>
  name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

describe('SHARE_ICONS', () => {
  it('registers exactly the icons the share sheets bind', () => {
    const registered = Object.keys(SHARE_ICONS).sort();
    const named = Object.values(SHARE_ICON_NAMES).map(camel).sort();
    expect(named).toEqual(registered);
  });

  it('binds every icon through SHARE_ICON_NAMES, and uses each one', () => {
    const html = Object.values(templates).join('\n');
    expect(html.length).toBeGreaterThan(0);
    // A static name would be checked against the workouts registry instead.
    expect(html).not.toMatch(/<ion-icon[^>]*\sname="[a-z]/);
    expect(html).not.toMatch(/\sicon="[a-z]/);
    for (const key of Object.keys(SHARE_ICON_NAMES)) {
      expect(html, `icons.${key} is registered but unused`).toContain(`icons.${key}`);
    }
  });
});

describe('saveCopyKeys', () => {
  it('names Photos on iOS and the browser, the gallery on Android', () => {
    expect(saveCopyKeys('ios').done).toBe('workouts.share.save.done');
    expect(saveCopyKeys('web').action).toBe('workouts.share.save.action');
    expect(saveCopyKeys('android')).toEqual({
      action: 'workouts.share.save.gallery.action',
      done: 'workouts.share.save.gallery.done',
      denied: 'workouts.share.save.gallery.denied',
    });
  });
});
