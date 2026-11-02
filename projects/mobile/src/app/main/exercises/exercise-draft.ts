import { computed, signal } from '@angular/core';

import {
  CreateExercisePayload,
  Exercise,
  ExerciseForce,
  ExerciseKind,
  ExerciseLevel,
  ExerciseMechanic,
  ExerciseVisibility,
  MovementPattern,
  MuscleRole,
  youtubeVideoId,
} from 'core';

import { MAX_PRIMARY_MUSCLES } from './exercises.config';

/**
 * The exercise being written, before it is an exercise.
 *
 * Create fills this over three pages and edit fills it in one, so it lives
 * here rather than inside either — the validation and the payload shape are
 * the same question whichever screen is asking, and two copies of "what
 * counts as a valid exercise" would eventually disagree.
 *
 * `kind` is nullable because an unanswered required question is not the same
 * as a defaulted one: pre-selecting Strength would have coaches shipping
 * every mobility drill as a strength exercise without ever seeing the choice.
 */
export interface ExerciseDraft {
  name: string;
  kind: ExerciseKind | null;
  level: ExerciseLevel;
  primaryMuscleIds: string[];
  secondaryMuscleIds: string[];
  stabilizerMuscleIds: string[];
  equipmentIds: string[];
  movementPattern: MovementPattern | null;
  mechanic: ExerciseMechanic | null;
  force: ExerciseForce | null;
  isUnilateral: boolean;
  youtubeUrl: string;
  description: string;
  instructions: string;
  visibility: ExerciseVisibility;
}

/** The four id lists the anatomy block edits — everything the API calls muscles and equipment. */
export type MuscleEquipmentSelection = Pick<
  ExerciseDraft,
  'primaryMuscleIds' | 'secondaryMuscleIds' | 'stabilizerMuscleIds' | 'equipmentIds'
>;

/**
 * A blank draft. Visibility starts PRIVATE, matching the column default on
 * the server: a coach's first exercise is a draft of their own thinking, and
 * publishing it to every other coach should be something they chose, not
 * something they failed to turn off.
 */
export const EMPTY_DRAFT: ExerciseDraft = {
  name: '',
  kind: null,
  level: ExerciseLevel.Beginner,
  primaryMuscleIds: [],
  secondaryMuscleIds: [],
  stabilizerMuscleIds: [],
  equipmentIds: [],
  movementPattern: null,
  mechanic: null,
  force: null,
  isUnilateral: false,
  youtubeUrl: '',
  description: '',
  instructions: '',
  visibility: ExerciseVisibility.Private,
};

/** The BE caps names at 200; the counter on the field says so before it bites. */
export const MAX_NAME_LENGTH = 200;

/** Seed the form from a row being edited. */
export function draftFromExercise(exercise: Exercise): ExerciseDraft {
  const roles = exercise.muscleRoles ?? [];
  const byRole = (role: MuscleRole) =>
    roles.filter((entry) => entry.role === role).map((entry) => entry.muscleId);

  return {
    name: exercise.name,
    kind: exercise.kind,
    level: exercise.level,
    primaryMuscleIds: byRole(MuscleRole.Primary),
    secondaryMuscleIds: byRole(MuscleRole.Secondary),
    stabilizerMuscleIds: byRole(MuscleRole.Stabilizer),
    equipmentIds: (exercise.equipment ?? []).map((item) => item.id),
    movementPattern: exercise.movementPattern,
    mechanic: exercise.mechanic,
    force: exercise.force,
    isUnilateral: exercise.isUnilateral,
    youtubeUrl: exercise.youtubeUrl ?? '',
    description: exercise.description ?? '',
    instructions: exercise.instructions ?? '',
    visibility: exercise.visibility,
  };
}

/** Name and kind are the two things nothing else can be derived without. */
export function isBasicsValid(draft: ExerciseDraft): boolean {
  return draft.name.trim().length >= 2 && draft.kind !== null;
}

/**
 * No more primary muscles than the server accepts, and at least one when the
 * exercise is a coach's. Someone's own exercise (source USER) may name none:
 * the simple form's muscle chips are optional.
 */
export function isMusclesValid(draft: ExerciseDraft, requirePrimary = true): boolean {
  const count = draft.primaryMuscleIds.length;
  return count >= (requirePrimary ? 1 : 0) && count <= MAX_PRIMARY_MUSCLES;
}

/**
 * A blank draft for the simple form, named already when it was opened from a
 * search. A search is typed in lower case and a name is not, so the first
 * letter is raised; the rest is left exactly as typed. Weight and reps comes
 * preselected: it is what most of these are (the machine at your gym the
 * catalogue does not have), and a name typed in the picker should be one tap
 * from added.
 */
export function simpleDraft(name = ''): ExerciseDraft {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  const named = trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
  return { ...EMPTY_DRAFT, name: named, kind: ExerciseKind.Strength };
}

/** Empty is valid — the field is optional; a URL we cannot parse is not. */
export function isYoutubeValid(draft: ExerciseDraft): boolean {
  const url = draft.youtubeUrl.trim();
  return !url || youtubeVideoId(url) !== null;
}

/**
 * The draft as the API wants it.
 *
 * Optional text fields go out as `undefined` rather than `''`: an empty
 * string is a value, and PATCHing one would replace a description with
 * blankness instead of leaving it alone. `equipmentIds` empty is meaningful
 * in the other direction — the server reads it as bodyweight and attaches
 * that row itself, which is why it is not sent at all.
 */
export function toPayload(draft: ExerciseDraft): CreateExercisePayload | null {
  const kind = draft.kind;
  if (!kind) return null;

  const muscles = [
    ...draft.primaryMuscleIds.map((muscleId) => ({ muscleId, role: MuscleRole.Primary })),
    ...draft.secondaryMuscleIds.map((muscleId) => ({ muscleId, role: MuscleRole.Secondary })),
    ...draft.stabilizerMuscleIds.map((muscleId) => ({ muscleId, role: MuscleRole.Stabilizer })),
  ];

  return {
    name: draft.name.trim(),
    kind,
    level: draft.level,
    description: draft.description.trim() || undefined,
    instructions: draft.instructions.trim() || undefined,
    movementPattern: draft.movementPattern ?? undefined,
    mechanic: draft.mechanic ?? undefined,
    force: draft.force ?? undefined,
    isUnilateral: draft.isUnilateral,
    youtubeUrl: draft.youtubeUrl.trim() || undefined,
    visibility: draft.visibility,
    muscles,
    equipmentIds: draft.equipmentIds.length ? draft.equipmentIds : undefined,
  };
}

/**
 * The draft as a page holds it: the signal, what is derived from it, and the
 * few setters whose shape the templates share.
 *
 * A plain class rather than a service or a base component. Signals need no
 * injection context, so each page just does `readonly form = new
 * ExerciseDraftForm()` and hands it to the shared field blocks — the create
 * wizard and the edit page then read and write the same object through the
 * same names, and neither carries its own copy of `isPrivate` or `patch`.
 */
export class ExerciseDraftForm {
  readonly draft = signal<ExerciseDraft>({ ...EMPTY_DRAFT });
  /**
   * Whether the server will insist on a primary muscle: true for a coach's
   * exercise (the default, and the wizard's case), false for someone's own.
   */
  readonly requirePrimary = signal(true);

  readonly nameCount = computed(() => this.draft().name.length);
  readonly isBasicsValid = computed(() => isBasicsValid(this.draft()));
  readonly isMusclesValid = computed(() =>
    isMusclesValid(this.draft(), this.requirePrimary()),
  );
  readonly isYoutubeValid = computed(() => isYoutubeValid(this.draft()));

  readonly isValid = computed(
    () => this.isBasicsValid() && this.isMusclesValid() && this.isYoutubeValid(),
  );

  readonly isPrivate = computed(() => this.draft().visibility === ExerciseVisibility.Private);

  /** The anatomy lists, as the shared block edits them. */
  readonly selection = computed<MuscleEquipmentSelection>(() => {
    const { primaryMuscleIds, secondaryMuscleIds, stabilizerMuscleIds, equipmentIds } =
      this.draft();
    return { primaryMuscleIds, secondaryMuscleIds, stabilizerMuscleIds, equipmentIds };
  });

  seed(exercise: Exercise): void {
    this.draft.set(draftFromExercise(exercise));
  }

  /** Start over from `draft`: a fresh form each time a sheet opens. */
  reset(draft: ExerciseDraft = EMPTY_DRAFT): void {
    this.draft.set({ ...draft });
  }

  patch(patch: Partial<ExerciseDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
  }

  setPrivate(isPrivate: boolean): void {
    this.patch({
      visibility: isPrivate ? ExerciseVisibility.Private : ExerciseVisibility.Public,
    });
  }

  payload(): CreateExercisePayload | null {
    return this.isValid() ? toPayload(this.draft()) : null;
  }
}
