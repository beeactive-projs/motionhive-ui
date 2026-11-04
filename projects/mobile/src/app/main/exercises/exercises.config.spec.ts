import { describe, expect, it } from 'vitest';

import {
  Exercise,
  ExerciseKind,
  ExerciseLevel,
  ExerciseMediaKind,
  ExerciseOwnershipFilter,
  ExerciseSortKey,
  ExerciseSource,
  ExerciseVisibility,
  MuscleRole,
} from 'core';

import {
  ExerciseDraftForm,
  isMusclesValid,
  simpleDraft,
  toPayload,
  MAX_NAME_LENGTH,
} from './exercise-draft';
import {
  BadgeTones,
  OWN_EXERCISE_ACTIONS,
  OwnExerciseActionIds,
  SIMPLE_KINDS,
  TRAINEE_OWNERSHIP_PILLS,
  TaxonomyChip,
  announceResults,
  collapsedChips,
  exerciseDetailRows,
  exerciseSubline,
  featuredFirst,
  hasExactNameMatch,
  isOwnExercise,
  keepPlaces,
  normalizeExerciseName,
  ownershipChip,
  recentFromExercise,
  resultMetaLabel,
  toggleCapped,
  trackLabel,
} from './exercises.config';

const ME = 'user-1';

/** Enough of an exercise for the helpers: a system row unless told otherwise. */
function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    name: 'Bench press',
    originalName: null,
    slug: 'bench-press',
    description: null,
    instructions: null,
    kind: ExerciseKind.Strength,
    level: ExerciseLevel.Beginner,
    movementPattern: null,
    mechanic: null,
    force: null,
    metValue: null,
    source: ExerciseSource.System,
    ownerId: null,
    visibility: ExerciseVisibility.Public,
    forkedFromId: null,
    sourceProvider: null,
    sourceExternalId: null,
    mediaKind: ExerciseMediaKind.None,
    thumbnailUrl: null,
    youtubeUrl: null,
    trackingFields: null,
    isUnilateral: false,
    forkCount: 0,
    fitCategory: null,
    fitSubcategory: null,
    hkActivityType: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

/** Someone's own exercise, made with the short form. */
function own(overrides: Partial<Exercise> = {}): Exercise {
  return exercise({
    id: 'own-1',
    name: 'Hip thrust machine',
    source: ExerciseSource.User,
    ownerId: ME,
    visibility: ExerciseVisibility.Private,
    ...overrides,
  });
}

function chip(slug: string): TaxonomyChip {
  return { value: `id-${slug}`, label: slug, slug };
}

describe('exact name match (the picker\'s "Create it" row)', () => {
  it('ignores case, accents and runs of spaces', () => {
    expect(normalizeExerciseName('  Împins  la PIEPT ')).toBe('impins la piept');
    expect(hasExactNameMatch('hip  THRUST machine', [exercise({ name: 'Hip thrust machine' })])).toBe(true);
  });

  it('counts the English name under a translated one', () => {
    const translated = exercise({ name: 'Împins la piept', originalName: 'Bench press' });
    expect(hasExactNameMatch('bench press', [translated])).toBe(true);
  });

  it('treats a near match as a suggestion, not the exercise asked for', () => {
    const rows = [exercise({ name: 'Barbell hip thrust' }), exercise({ name: 'Glute bridge' })];
    expect(hasExactNameMatch('hip thrust mach', rows)).toBe(false);
  });

  it('never matches an empty search', () => {
    expect(hasExactNameMatch('   ', [exercise({ name: '' })])).toBe(false);
  });
});

// The library's order moves with use: coming back from a workout re-reads
// the window, and the rows must not reshuffle under the reader.
describe('a refresh in place', () => {
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it('keeps the rows on screen where they were, with their new content', () => {
    const onScreen = [exercise({ id: 'a' }), exercise({ id: 'b' }), exercise({ id: 'c' })];
    const fresh = [
      exercise({ id: 'c' }),
      exercise({ id: 'a', name: 'Renamed' }),
      exercise({ id: 'b' }),
    ];

    const rows = keepPlaces(onScreen, fresh);

    expect(ids(rows)).toEqual(['a', 'b', 'c']);
    expect(rows[0].name).toBe('Renamed');
  });

  it('drops the rows gone from the window and adds the new ones after the rest', () => {
    const onScreen = [exercise({ id: 'a' }), exercise({ id: 'b' }), exercise({ id: 'c' })];
    const fresh = [exercise({ id: 'new' }), exercise({ id: 'c' }), exercise({ id: 'a' })];

    expect(ids(keepPlaces(onScreen, fresh))).toEqual(['a', 'c', 'new']);
  });

  it('takes the server order when nothing was on screen', () => {
    const fresh = [exercise({ id: 'b' }), exercise({ id: 'a' })];
    expect(ids(keepPlaces([], fresh))).toEqual(['b', 'a']);
  });
});

describe('collapsed chip clouds', () => {
  const all = ['chest', 'shoulders', 'lats', 'glutes', 'calves', 'neck'].map(chip);

  it('leads with the featured slugs, in their order', () => {
    expect(collapsedChips(all, ['glutes', 'chest'], [], 2).map((c) => c.slug)).toEqual([
      'glutes',
      'chest',
    ]);
  });

  it('tops up from the rest when a featured slug is missing', () => {
    expect(collapsedChips(all, ['glutes', 'nope'], [], 3).map((c) => c.slug)).toEqual([
      'glutes',
      'chest',
      'shoulders',
    ]);
  });

  it('keeps a selected chip visible even past the preview', () => {
    expect(collapsedChips(all, ['chest'], ['id-neck'], 1).map((c) => c.slug)).toEqual([
      'chest',
      'neck',
    ]);
  });

  it('expands without moving the chips already showing', () => {
    const collapsed = collapsedChips(all, ['glutes', 'chest'], [], 3).map((c) => c.slug);
    const expanded = featuredFirst(all, ['glutes', 'chest']).map((c) => c.slug);
    expect(expanded.slice(0, collapsed.length)).toEqual(collapsed);
    expect(expanded).toHaveLength(all.length);
  });
});

describe('toggleCapped', () => {
  it('turns a chip off, and on while there is room', () => {
    expect(toggleCapped(['a', 'b'], 'a', 3)).toEqual(['b']);
    expect(toggleCapped(['a'], 'b', 3)).toEqual(['a', 'b']);
  });

  it('refuses a new chip at the cap instead of dropping an old one', () => {
    expect(toggleCapped(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('what an exercise tracks', () => {
  it('names the four simple kinds in the form\'s words', () => {
    expect(SIMPLE_KINDS.map(trackLabel)).toEqual(['Weight and reps', 'Reps only', 'Time', 'Distance']);
  });

  it('keeps the category name for a kind the short form does not offer', () => {
    expect(trackLabel(ExerciseKind.Cardio)).not.toBe('');
    expect(SIMPLE_KINDS).not.toContain(ExerciseKind.Cardio);
  });

  it('leads your own exercise\'s facts line with it', () => {
    expect(exerciseSubline(own({ kind: ExerciseKind.Duration }))).toBe('Time');
    expect(exerciseSubline(own({ equipment: [{ id: 'm', slug: 'machine', name: 'Machine', displayOrder: 5 }] }))).toBe(
      'Weight and reps · Machine',
    );
  });

  it('leaves a catalogue row\'s facts line as it was', () => {
    expect(exerciseSubline(exercise())).toBe('Strength');
  });

  it('shows on the detail page instead of a level nobody chose', () => {
    const [first] = exerciseDetailRows(own(), true);
    expect(first?.label).toBe('What it tracks');
    expect(first?.chips.map((c) => c.label)).toEqual(['Weight and reps']);

    const [system] = exerciseDetailRows(exercise(), false);
    expect(system?.chips).toHaveLength(2);
  });
});

describe('your own exercises in the library', () => {
  it('gives a trainee a Mine pill, last', () => {
    expect(TRAINEE_OWNERSHIP_PILLS.map((pill) => pill.value)).toEqual([
      ExerciseOwnershipFilter.All,
      ExerciseOwnershipFilter.System,
      ExerciseOwnershipFilter.PublicOthers,
      ExerciseOwnershipFilter.Mine,
    ]);
    expect(TRAINEE_OWNERSHIP_PILLS.at(-1)?.label).toBe('Mine');
  });

  it('knows whose exercise it is', () => {
    expect(isOwnExercise(own(), ME)).toBe(true);
    expect(isOwnExercise(own(), 'someone-else')).toBe(false);
    expect(isOwnExercise(own(), null)).toBe(false);
  });

  it('never calls someone else\'s private exercise public', () => {
    expect(ownershipChip(own(), ME)?.label).toBe('Mine');
    expect(ownershipChip(own(), 'someone-else')).toBeNull();
  });

  // Honey is for actions and selection; "yours" is violet, as "Your coach" is.
  it('marks your own exercise in violet, never honey', () => {
    expect(ownershipChip(own(), ME)?.tone).toBe(BadgeTones.Violet);
  });

  it('offers Edit, then Delete as the one destructive verb', () => {
    expect(OWN_EXERCISE_ACTIONS.map((action) => action.id)).toEqual([
      OwnExerciseActionIds.Edit,
      OwnExerciseActionIds.Delete,
    ]);
    expect(OWN_EXERCISE_ACTIONS.filter((action) => action.destructive).map((a) => a.id)).toEqual([
      OwnExerciseActionIds.Delete,
    ]);
  });
});

describe('the library\'s search', () => {
  // A recent looks like the row it was opened from: the photo where there
  // is one, the kind's tile where there is not.
  it('keeps an exercise as a recent with its facts line and tile', () => {
    expect(recentFromExercise(exercise())).toEqual({
      id: 'ex-1',
      name: 'Bench press',
      avatarUrl: null,
      subline: 'Strength',
      tile: { icon: 'flash-outline', color: 'warning' },
    });
    expect(recentFromExercise(exercise({ thumbnailUrl: 'start.jpg' })).avatarUrl).toBe('start.jpg');
  });

  it('announces the whole result, not the page loaded so far', () => {
    expect(announceResults(0)).toBe('No exercises match that.');
    expect(announceResults(1)).toBe('1 exercise.');
    expect(announceResults(42)).toBe('42 exercises.');
  });

  // No sort control: the list says the order it is in, the API's default.
  it('names the order over the list', () => {
    expect(resultMetaLabel(908, ExerciseSortKey.Relevance)).toBe(
      '908 exercises · sorted by relevance',
    );
    expect(resultMetaLabel(1, ExerciseSortKey.Name)).toBe('1 exercise · sorted by name');
  });
});

describe('the short form\'s draft', () => {
  it('starts named from the search, on weight and reps', () => {
    const draft = simpleDraft('  hip thrust machine ');
    expect(draft.name).toBe('Hip thrust machine');
    expect(simpleDraft('împins cu gantere').name).toBe('Împins cu gantere');
    expect(draft.kind).toBe(ExerciseKind.Strength);
    expect(draft.visibility).toBe(ExerciseVisibility.Private);
    expect(simpleDraft('x'.repeat(MAX_NAME_LENGTH + 20)).name).toHaveLength(MAX_NAME_LENGTH);
  });

  it('lets your own exercise go without a muscle, but not a coach\'s', () => {
    const draft = simpleDraft('Dead hang');
    expect(isMusclesValid(draft, false)).toBe(true);
    expect(isMusclesValid(draft)).toBe(false);
    expect(isMusclesValid({ ...draft, primaryMuscleIds: ['a', 'b', 'c', 'd'] }, false)).toBe(false);
  });

  it('is valid with a name and a kind when no muscle is required', () => {
    const form = new ExerciseDraftForm();
    form.reset(simpleDraft('Dead hang'));
    expect(form.isValid()).toBe(false);

    form.requirePrimary.set(false);
    expect(form.isValid()).toBe(true);
    expect(form.payload()).toMatchObject({ name: 'Dead hang', kind: ExerciseKind.Strength, muscles: [] });

    form.patch({ name: 'D' });
    expect(form.isValid()).toBe(false);
  });

  it('sends a picked muscle chip as the primary muscle', () => {
    const payload = toPayload({ ...simpleDraft('Hip thrust machine'), primaryMuscleIds: ['glutes'] });
    expect(payload?.muscles).toEqual([{ muscleId: 'glutes', role: MuscleRole.Primary }]);
  });
});
