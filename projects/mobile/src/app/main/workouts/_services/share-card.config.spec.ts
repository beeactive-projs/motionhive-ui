/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { WorkoutLog, translate } from 'core';

import {
  CardThemes,
  DEFAULT_SHARE_PREFS,
  FullBackgrounds,
  SHARE_ICONS,
  SHARE_ICON_NAMES,
  SITE_LABEL,
  ShareCardOptions,
  ShareModes,
  ShareSteps,
  StickerCellKinds,
  StickerStyles,
  linkLabel,
  openingStep,
  saveCopyKeys,
  parseSharePrefs,
  shareCardContent,
  stickerCells,
  suggestedMode,
  toHexColor,
  withAlpha,
} from './share-card.config';

const t = (key: string, params?: Record<string, unknown>) => translate(key, params);

function log(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'wl-1',
    name: 'Leg day',
    completedAt: '2026-10-22T16:47:00Z',
    durationSeconds: 3134,
    exercises: [
      {
        sets: [
          { id: 's1', isCompleted: true, weightKg: 100, reps: 5, durationSeconds: null, distanceMeters: null },
          { id: 's2', isCompleted: true, weightKg: 100, reps: 5, durationSeconds: null, distanceMeters: null },
        ],
      },
    ],
    personalRecords: [
      { id: 'pr', exerciseId: 'squat', exerciseName: 'Squat', weightKg: 116.7, deltaKg: 5, setWeightKg: 100, setReps: 5 },
    ],
    summary: {
      workoutNumber: 12,
      streakWeeks: 3,
      previousVolumeKg: null,
      coachName: 'Bogdan Daniel',
      mentionableCoach: { name: 'Bogdan Daniel' },
    },
    ...over,
  } as unknown as WorkoutLog;
}

const options = (over: Partial<ShareCardOptions> = {}): ShareCardOptions => ({
  showKg: true,
  showRecord: true,
  showCoach: false,
  showLink: true,
  ...over,
});

const PROFILE = 'https://app.motionhive.fit/@anna';

describe('shareCardContent: what the card says', () => {
  it('says what the summary says', () => {
    const card = shareCardContent(log(), options(), t, PROFILE);
    expect(card.title).toBe('Leg day');
    expect(card.subtitle).toBe('your 12th workout · 1 record');
    expect(card.stats.map((s) => s.value)).toEqual(['52:14', '2', '1000 kg']);
    // The volume is the one number picked out in the accent.
    expect(card.stats.map((s) => s.accent)).toEqual([false, false, true]);
    expect(card.record).toEqual({ title: 'New record', exercise: 'Squat', value: '100 kg', reps: '× 5' });
    expect(card.streak).toEqual({ value: '3', label: 'weeks in a row' });
    expect(card.link).toBe('app.motionhive.fit/@anna');
  });

  it('leaves out every kilogram when weights stay private', () => {
    const card = shareCardContent(log(), options({ showKg: false }), t, PROFILE);
    expect(card.stats.map((s) => s.value).join(' ')).not.toContain('kg');
    // The record still says what was beaten, not by how much.
    expect(card.record).toMatchObject({ exercise: 'Squat', value: null, reps: null });
  });

  it('says the gain when the set that earned the record is not known', () => {
    const gain = log({
      personalRecords: [
        { id: 'pr', exerciseId: 'b', exerciseName: 'Bench', weightKg: 80, deltaKg: 2.5, setWeightKg: null, setReps: null },
      ],
    });
    expect(shareCardContent(gain, options(), t, null).record).toMatchObject({
      exercise: 'Bench',
      value: '+2.5 kg',
      reps: null,
    });
  });

  it('drops the record, and its count, when the person turns it off', () => {
    const card = shareCardContent(log(), options({ showRecord: false }), t, PROFILE);
    expect(card.record).toBeNull();
    expect(card.subtitle).toBe('your 12th workout');
  });

  it('names a coach only when chosen, and only one who allows it', () => {
    expect(shareCardContent(log(), options(), t, PROFILE).coach).toBeNull();
    expect(shareCardContent(log(), options({ showCoach: true }), t, PROFILE).coach).toBe(
      'Program by Bogdan Daniel',
    );
    const notAllowed = log({
      summary: {
        workoutNumber: 3,
        streakWeeks: 0,
        previousVolumeKg: null,
        coachName: 'Bogdan Daniel',
        mentionableCoach: null,
      },
    });
    expect(shareCardContent(notAllowed, options({ showCoach: true }), t, PROFILE).coach).toBeNull();
  });

  it('prints the personal link only when there is one and it is on', () => {
    expect(shareCardContent(log(), options({ showLink: false }), t, PROFILE).link).toBe(SITE_LABEL);
    expect(shareCardContent(log(), options(), t, null).link).toBe(SITE_LABEL);
  });

  it('says nothing about a streak, a record or a number that is not there', () => {
    const quiet = log({
      personalRecords: [],
      summary: { workoutNumber: 0, streakWeeks: 1, previousVolumeKg: null, coachName: null },
    });
    const card = shareCardContent(quiet, options(), t, null);
    expect(card.record).toBeNull();
    expect(card.streak).toBeNull();
    expect(card.subtitle).toBe('');
  });
});

describe('stickerCells: the cells sticker', () => {
  it('is a 2 + 3 + 2 honeycomb with the name in the middle', () => {
    const cells = stickerCells(shareCardContent(log(), options(), t, null));
    expect(cells.map((c) => c.y)).toEqual([0, 0, 1, 1, 1, 2, 2]);
    expect(cells.map((c) => c.x)).toEqual([-0.5, 0.5, -1, 0, 1, -0.5, 0.5]);
    expect(cells[3]).toMatchObject({ kind: StickerCellKinds.Title, value: 'Leg day' });
  });

  it('puts the record first, with its kilograms, and the streak under it', () => {
    const cells = stickerCells(shareCardContent(log(), options(), t, null));
    expect(cells[1]).toMatchObject({ kind: StickerCellKinds.Record, value: '100 kg', label: 'Squat' });
    expect(cells[6]).toMatchObject({ kind: StickerCellKinds.Streak, value: '3' });
  });

  it('keeps a place with nothing true to say as a ghost', () => {
    const quiet = log({
      personalRecords: [],
      exercises: [],
      summary: { workoutNumber: 1, streakWeeks: 0, previousVolumeKg: null },
    });
    const cells = stickerCells(shareCardContent(quiet, options(), t, null));
    expect(cells.filter((c) => c.kind === StickerCellKinds.Ghost)).toHaveLength(4);
    expect(cells[0].kind).toBe(StickerCellKinds.Stat);
  });

  it('shows the trophy in the record cell when weights stay private', () => {
    const cells = stickerCells(shareCardContent(log(), options({ showKg: false }), t, null));
    expect(cells[1]).toMatchObject({ kind: StickerCellKinds.Record, value: '🏆' });
    expect(cells.map((c) => c.value).join(' ')).not.toContain('kg');
  });
});

describe('share prefs: remembered on the device', () => {
  it('asks the first time, then opens the way picked last', () => {
    expect(parseSharePrefs(null)).toEqual(DEFAULT_SHARE_PREFS);
    expect(openingStep(DEFAULT_SHARE_PREFS)).toBe(ShareSteps.Choose);
    expect(suggestedMode(DEFAULT_SHARE_PREFS)).toBe(ShareModes.Quick);
    const full = { ...DEFAULT_SHARE_PREFS, mode: ShareModes.Full };
    expect(openingStep(full)).toBe(ShareSteps.Full);
    expect(suggestedMode(full)).toBe(ShareModes.Full);
  });

  it('reads back what was written', () => {
    const prefs = {
      ...DEFAULT_SHARE_PREFS,
      mode: ShareModes.Quick,
      theme: CardThemes.Honey,
      sticker: StickerStyles.Cells,
      quickKg: false,
      fullBackground: FullBackgrounds.Hive,
      guideHidden: true,
    };
    expect(parseSharePrefs(JSON.stringify(prefs))).toEqual(prefs);
  });

  it('keeps every good field when one is not', () => {
    const parsed = parseSharePrefs(JSON.stringify({ theme: 'neon', quickKg: false, mode: 'story' }));
    expect(parsed.theme).toBe(DEFAULT_SHARE_PREFS.theme);
    expect(parsed.mode).toBeNull();
    expect(parsed.quickKg).toBe(false);
    expect(parseSharePrefs('{not json')).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs('[1,2]')).toEqual(DEFAULT_SHARE_PREFS);
  });
});

describe('colours and links', () => {
  it('gives Instagram #rrggbb whatever the token is written as', () => {
    expect(toHexColor('#FFF')).toBe('#ffffff');
    expect(toHexColor(' #0e1b31 ')).toBe('#0e1b31');
    expect(toHexColor('rgb(245, 158, 11)')).toBe('#f59e0b');
    expect(toHexColor('var(--x)')).toBeNull();
    expect(withAlpha('#b45309', 0.16)).toBe('rgba(180, 83, 9, 0.16)');
  });

  it('prints a link without its scheme', () => {
    expect(linkLabel('https://app.motionhive.fit/@anna')).toBe('app.motionhive.fit/@anna');
    expect(linkLabel('https://www.motionhive.fit/')).toBe('motionhive.fit');
  });
});

/** The share sheets' templates and sources, inlined at build time by Vite. */
const templates = import.meta.glob('../_sheets/share-*/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

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
