import {
  addOutline,
  alertCircleOutline,
  barbellOutline,
  bodyOutline,
  checkmarkCircle,
  checkmarkOutline,
  closeCircleOutline,
  createOutline,
  flashOutline,
  funnelOutline,
  gitNetworkOutline,
  globeOutline,
  heartOutline,
  informationCircleOutline,
  lockClosedOutline,
  mapOutline,
  moveOutline,
  searchOutline,
  syncOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  Exercise,
  ExerciseForce,
  ExerciseKind,
  ExerciseLevel,
  ExerciseMechanic,
  ExerciseOwnershipFilter,
  ExerciseSortKey,
  ExerciseSource,
  ExerciseVisibility,
  MovementPattern,
  MuscleRole,
} from 'core';

import {
  HexAvatarTone,
  HexAvatarTones,
} from '../../_shared/components/hex-avatar/hex-avatar';

/**
 * Every icon the exercise screens render. Each page calls
 * `addIcons(EXERCISE_ICONS)` once, so a name in a template can never
 * reference an icon nobody registered.
 */
export const EXERCISE_ICONS = {
  addOutline,
  alertCircleOutline,
  barbellOutline,
  bodyOutline,
  checkmarkCircle,
  checkmarkOutline,
  closeCircleOutline,
  createOutline,
  flashOutline,
  funnelOutline,
  gitNetworkOutline,
  globeOutline,
  heartOutline,
  informationCircleOutline,
  lockClosedOutline,
  mapOutline,
  moveOutline,
  searchOutline,
  syncOutline,
  timeOutline,
  trashOutline,
};

// ── Badge tones ─────────────────────────────────────────────────────────────

/**
 * The `data-tone` vocabulary of theme/components/ion-badge.css, so a chip
 * cannot name a wash the stylesheet does not paint. `Medium` is the sheet's
 * unnamed default — the neutral slate every unrecognised tone falls back to.
 */
export const BadgeTones = {
  Honey: 'honey',
  Teal: 'teal',
  Success: 'success',
  Warn: 'warn',
  Info: 'info',
  Danger: 'danger',
  Violet: 'violet',
  Coral: 'coral',
  Navy: 'navy',
  Medium: 'medium',
} as const;

export type BadgeTone = (typeof BadgeTones)[keyof typeof BadgeTones];

// ── Option shape ────────────────────────────────────────────────────────────

/**
 * One option row in a picker, a pill strip or a chip cloud. Every list of
 * choices on these screens is this shape or extends it — the pills, the
 * sort rows, the facet chips, the taxonomy picker — so a row renderer written
 * for one of them reads the others.
 */
export interface LabelledOption<T> {
  value: T;
  label: string;
}

// ── Kind ────────────────────────────────────────────────────────────────────

/**
 * What a kind looks like and what it means. The tone is an Ionic palette
 * name, always rendered as a `wash` — a list of sixty rows with saturated
 * tiles reads as a colour chart, not a library.
 *
 * `tracking` is the promise the kind makes about logging: picking Strength
 * is picking reps + weight, and the create form says so rather than making
 * the coach guess which fields appear later.
 */
export interface KindMeta {
  label: string;
  icon: string;
  /** Ionic palette name for the hex tile. */
  tone: string;
  tracking: string;
}

export const KIND_META: Record<ExerciseKind, KindMeta> = {
  [ExerciseKind.Strength]: {
    label: 'Strength',
    icon: 'flash-outline',
    tone: 'warning',
    tracking: 'Reps + weight',
  },
  [ExerciseKind.Cardio]: {
    label: 'Cardio',
    icon: 'heart-outline',
    tone: 'coral',
    tracking: 'Duration + distance + HR',
  },
  [ExerciseKind.Duration]: {
    label: 'Duration',
    icon: 'time-outline',
    tone: 'info',
    tracking: 'Time only — e.g. plank',
  },
  [ExerciseKind.Distance]: {
    label: 'Distance',
    icon: 'map-outline',
    tone: 'violet',
    tracking: 'Distance only',
  },
  [ExerciseKind.Bodyweight]: {
    label: 'Bodyweight',
    icon: 'body-outline',
    tone: 'medium',
    tracking: 'Reps, no load',
  },
  [ExerciseKind.Mobility]: {
    label: 'Mobility',
    icon: 'sync-outline',
    tone: 'teal',
    tracking: 'Time / reps, mobility',
  },
};

/** Grid order for the create form and the filter sheet — most used first. */
export const KIND_ORDER: readonly ExerciseKind[] = [
  ExerciseKind.Strength,
  ExerciseKind.Cardio,
  ExerciseKind.Duration,
  ExerciseKind.Distance,
  ExerciseKind.Bodyweight,
  ExerciseKind.Mobility,
];

export function kindLabel(kind: ExerciseKind): string {
  return KIND_META[kind]?.label ?? kind;
}

export function kindIcon(kind: ExerciseKind): string {
  return KIND_META[kind]?.icon ?? 'barbell-outline';
}

export function kindTone(kind: ExerciseKind): string {
  return KIND_META[kind]?.tone ?? 'medium';
}

// ── Level ───────────────────────────────────────────────────────────────────

/**
 * Difficulty as a green → amber → red ramp, matching core's
 * `exerciseLevelTag` on web. Deliberately not the brand honey: a level is a
 * state, and honey is reserved for things you press.
 */
export interface LevelMeta {
  label: string;
  /** `data-tone` on the row badge (see theme/components/ion-badge.css). */
  tone: BadgeTone;
}

export const LEVEL_META: Record<ExerciseLevel, LevelMeta> = {
  [ExerciseLevel.Beginner]: { label: 'Beginner', tone: BadgeTones.Success },
  [ExerciseLevel.Intermediate]: { label: 'Intermediate', tone: BadgeTones.Warn },
  [ExerciseLevel.Advanced]: { label: 'Advanced', tone: BadgeTones.Danger },
};

export const LEVEL_ORDER: readonly ExerciseLevel[] = [
  ExerciseLevel.Beginner,
  ExerciseLevel.Intermediate,
  ExerciseLevel.Advanced,
];

export function levelLabel(level: ExerciseLevel): string {
  return LEVEL_META[level]?.label ?? level;
}

export function levelTone(level: ExerciseLevel): BadgeTone {
  return LEVEL_META[level]?.tone ?? BadgeTones.Medium;
}

// ── Classification (meta chips + the create form's optional selects) ─────────

export const MECHANIC_LABELS: Record<ExerciseMechanic, string> = {
  [ExerciseMechanic.Compound]: 'Compound',
  [ExerciseMechanic.Isolation]: 'Isolation',
};

export const FORCE_LABELS: Record<ExerciseForce, string> = {
  [ExerciseForce.Push]: 'Push',
  [ExerciseForce.Pull]: 'Pull',
  [ExerciseForce.Static]: 'Static',
};

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  [MovementPattern.Squat]: 'Squat',
  [MovementPattern.Hinge]: 'Hinge',
  [MovementPattern.Lunge]: 'Lunge',
  [MovementPattern.PushHorizontal]: 'Horizontal push',
  [MovementPattern.PushVertical]: 'Vertical push',
  [MovementPattern.PullHorizontal]: 'Horizontal pull',
  [MovementPattern.PullVertical]: 'Vertical pull',
  [MovementPattern.Carry]: 'Carry',
  [MovementPattern.Rotation]: 'Rotation',
  [MovementPattern.AntiRotation]: 'Anti-rotation',
  [MovementPattern.Locomotion]: 'Locomotion',
  [MovementPattern.Isolation]: 'Isolation',
};

export const PATTERN_OPTIONS: readonly LabelledOption<MovementPattern>[] = Object.values(
  MovementPattern,
).map((value) => ({ value, label: PATTERN_LABELS[value] }));

export const MECHANIC_OPTIONS: readonly LabelledOption<ExerciseMechanic>[] = Object.values(
  ExerciseMechanic,
).map((value) => ({ value, label: MECHANIC_LABELS[value] }));

export const FORCE_OPTIONS: readonly LabelledOption<ExerciseForce>[] = Object.values(
  ExerciseForce,
).map((value) => ({ value, label: FORCE_LABELS[value] }));

// ── Ownership pills ─────────────────────────────────────────────────────────

export type OwnershipPill = LabelledOption<ExerciseOwnershipFilter>;

/**
 * The pill row over the list, one-to-one with the BE's `?ownership=`.
 *
 * A trainee gets a different set: they never author an exercise, so "My
 * exercises" would always be empty, and "Public · others" only means
 * anything once you have a library of your own to contrast it with. What
 * they can see is the system catalogue and whatever coaches published, so
 * that is what the pills say.
 */
export const COACH_OWNERSHIP_PILLS: readonly OwnershipPill[] = [
  { value: ExerciseOwnershipFilter.All, label: 'All' },
  { value: ExerciseOwnershipFilter.System, label: 'System' },
  { value: ExerciseOwnershipFilter.Mine, label: 'My exercises' },
  { value: ExerciseOwnershipFilter.PublicOthers, label: 'Public · others' },
];

export const TRAINEE_OWNERSHIP_PILLS: readonly OwnershipPill[] = [
  { value: ExerciseOwnershipFilter.All, label: 'All' },
  { value: ExerciseOwnershipFilter.System, label: 'System' },
  { value: ExerciseOwnershipFilter.PublicOthers, label: 'From coaches' },
];

// ── Sort ────────────────────────────────────────────────────────────────────

export interface SortOption extends LabelledOption<ExerciseSortKey> {
  hint: string;
}

/** The three keys the BE can order by — nothing invented on top. */
export const SORT_OPTIONS: readonly SortOption[] = [
  { value: ExerciseSortKey.Name, label: 'Name', hint: 'A to Z' },
  { value: ExerciseSortKey.Newest, label: 'Newest', hint: 'Recently added first' },
  {
    value: ExerciseSortKey.MostForked,
    label: 'Most forked',
    hint: 'Popular with other coaches',
  },
];

export function sortLabel(sort: ExerciseSortKey): string {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Name';
}

// ── Row copy ────────────────────────────────────────────────────────────────

/**
 * "Abdominals · Bodyweight" — what the exercise trains and what it needs.
 *
 * The list response eager-loads only PRIMARY muscle roles, so this is the
 * primary muscle by construction. Equipment is truncated to the first row
 * plus a count: a barbell complex listing five pieces would push the name
 * off the line it shares.
 */
export function exerciseSubline(exercise: Exercise): string {
  const muscle = musclesByRole(exercise, MuscleRole.Primary)[0];
  const equipment = exercise.equipment ?? [];
  const gear =
    equipment.length === 0
      ? null
      : equipment.length === 1
        ? equipment[0]!.name
        : `${equipment[0]!.name} +${equipment.length - 1}`;

  return [muscle, gear].filter(Boolean).join(' · ') || kindLabel(exercise.kind);
}

export function musclesByRole(exercise: Exercise, role: MuscleRole): string[] {
  return (exercise.muscleRoles ?? [])
    .filter((entry) => entry.role === role)
    .map((entry) => entry.muscle?.commonName)
    .filter((name): name is string => !!name);
}

/**
 * The ownership chip on a row. Exceptions only: a System exercise is the
 * default case in a catalogue of 800, and labelling every row "system"
 * would say nothing. Mine wears the amber wash, someone else's public
 * exercise the sky one.
 */
export interface OwnershipChip {
  label: string;
  tone: BadgeTone;
}

export function ownershipChip(exercise: Exercise, myUserId: string | null): OwnershipChip | null {
  if (exercise.source === ExerciseSource.System) return null;
  if (myUserId && exercise.ownerId === myUserId) return { label: 'Mine', tone: BadgeTones.Honey };
  return { label: 'Public', tone: BadgeTones.Info };
}

/** "887 exercises · sorted by name" — the meta line above the list. */
export function resultMetaLabel(total: number, sort: ExerciseSortKey): string {
  const noun = total === 1 ? 'exercise' : 'exercises';
  return `${total} ${noun} · sorted by ${sortLabel(sort).toLowerCase()}`;
}

// ── Detail copy ─────────────────────────────────────────────────────────────

/**
 * Instructions arrive as one blob. The seed writes them as sentences, and a
 * wall of prose is unreadable while you are holding a kettlebell — so split
 * on newlines where the author gave us any, and on sentence ends where they
 * did not.
 */
export function instructionSteps(instructions: string | null): string[] {
  const raw = (instructions ?? '').trim();
  if (!raw) return [];

  const byLine = raw
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, '').trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  return raw
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * The mono line closing the detail page. System rows are the MotionHive
 * catalogue; a custom one belongs to whoever wrote it, and the fork count
 * only earns a mention once somebody has actually taken a copy.
 */
export function attributionLine(exercise: Exercise, ownerName: string | null): string {
  const origin =
    exercise.source === ExerciseSource.System
      ? 'System exercise · MotionHive library'
      : ownerName
        ? `Custom exercise · by ${ownerName}`
        : 'Custom exercise';

  if (exercise.forkCount <= 0) return origin;
  const times = exercise.forkCount === 1 ? 'once' : `${exercise.forkCount} times`;
  return `${origin} · forked ${times}`;
}

// ── Taxonomy picker ─────────────────────────────────────────────────────────

/** A row in the muscle / equipment picker: the taxonomy row's id, and its name. */
export type TaxonomyOption = LabelledOption<string>;

/** "2 of 3" — the mono counter that enforces the primary-muscle cap. */
export function selectionCounter(selected: number, max: number | null): string {
  return max === null ? `${selected} selected` : `${selected} of ${max}`;
}

// ── Muscle role slots on the form ───────────────────────────────────────────

export const MUSCLE_ROLE_LABELS: Record<MuscleRole, string> = {
  [MuscleRole.Primary]: 'Primary muscles',
  [MuscleRole.Secondary]: 'Secondary muscles',
  [MuscleRole.Stabilizer]: 'Stabilizers',
};

/** The BE takes one to three primary muscles; the picker inerts rows at the cap. */
export const MAX_PRIMARY_MUSCLES = 3;

// ── Detail rows ─────────────────────────────────────────────────────────────

/** One chip in a detail row. `tone` is a `data-tone` from ion-badge.css. */
export interface ExerciseChip {
  label: string;
  tone: BadgeTone;
  /** Semantic only — a lock, a globe. Never a caret: these are not menus. */
  icon?: string;
}

/**
 * One row of a detail card: a hex tile, the category it names, and that
 * category's chips under it — the session card's tile + label shape, with
 * chips in place of a single fact.
 */
export interface ExerciseChipRow {
  icon: string;
  /** Ionic palette name for the tile. */
  color: string;
  tone: HexAvatarTone;
  label: string;
  chips: ExerciseChip[];
  /** A caption under the chips, when the category needs a word of explanation. */
  hint: string | null;
}

/**
 * Which step of a colour a solid tile fills with. A white glyph needs 3:1
 * against its tile, and the 500 step of Sky and Emerald both miss it; the
 * 600 step clears it. Every other palette entry already carries an ink that
 * passes on its base.
 */
export function tileTone(color: string): HexAvatarTone {
  return color === 'info' || color === 'success' ? HexAvatarTones.Shade : HexAvatarTones.Base;
}

/**
 * The badge wash for each Ionic palette name a tile can wear, so a tile and
 * its chips can be handed the same colour. Most names are shared with the
 * badge vocabulary; `warning`, `primary` and `secondary` are the three the
 * stylesheet calls something else. A palette name with no wash (`dark`)
 * falls to the neutral default.
 */
const PALETTE_BADGE_TONE: Readonly<Record<string, BadgeTone>> = {
  warning: BadgeTones.Warn,
  primary: BadgeTones.Honey,
  secondary: BadgeTones.Navy,
  coral: BadgeTones.Coral,
  danger: BadgeTones.Danger,
  info: BadgeTones.Info,
  medium: BadgeTones.Medium,
  success: BadgeTones.Success,
  teal: BadgeTones.Teal,
  violet: BadgeTones.Violet,
};

export function badgeTone(color: string): BadgeTone {
  return PALETTE_BADGE_TONE[color] ?? BadgeTones.Medium;
}

/** The roles in the order a muscle chart lists them — most work first. */
export const MUSCLE_ROLE_ORDER: readonly MuscleRole[] = [
  MuscleRole.Primary,
  MuscleRole.Secondary,
  MuscleRole.Stabilizer,
];

export interface MuscleRoleMeta {
  /** Ionic palette name — the row's tile, and the chips' wash via `badgeTone`. */
  color: string;
  /** What the role does, as the row's caption. */
  hint: string;
}

/**
 * Muscle roles wear the muscle-chart convention: red for the target muscle,
 * orange for the synergists that assist it, and light blue for the
 * stabilizers holding everything still — the warm hues are the work, the
 * cool one is the bracing. On the app's ramps that is danger (red), coral
 * (the brand orange) and info (sky).
 *
 * This departs from web's single sky ramp in core's `exercise-tag.utils` on
 * purpose: three shades of one blue do not survive a glance the way
 * red → orange → blue does, and the row label spells the role out anyway.
 */
export const MUSCLE_ROLE_META: Record<MuscleRole, MuscleRoleMeta> = {
  [MuscleRole.Primary]: { color: 'danger', hint: 'Does most of the work' },
  [MuscleRole.Secondary]: { color: 'coral', hint: 'Assists the movement' },
  [MuscleRole.Stabilizer]: { color: 'info', hint: 'Holds you steady' },
};

/**
 * The Details card, grouped the way the create form asks for these things:
 * kind and level together, then the classification traits, then — on your
 * own exercise — who can see it. Every chip type has its own wash: kind and
 * level carry their existing tones, and each classification trait gets a
 * hue of its own so "Hinge · Compound · Push" reads as three facts, not one
 * long tag.
 */
export function exerciseDetailRows(exercise: Exercise, mine: boolean): ExerciseChipRow[] {
  const kind = kindTone(exercise.kind);

  const rows: ExerciseChipRow[] = [
    {
      icon: kindIcon(exercise.kind),
      color: kind,
      tone: tileTone(kind),
      label: 'Kind & level',
      chips: [
        { label: kindLabel(exercise.kind), tone: badgeTone(kind) },
        { label: levelLabel(exercise.level), tone: levelTone(exercise.level) },
      ],
      hint: null,
    },
  ];

  // Same order as the create form's Classification card.
  const classification: ExerciseChip[] = [];
  if (exercise.movementPattern) {
    classification.push({
      label: PATTERN_LABELS[exercise.movementPattern],
      tone: BadgeTones.Teal,
    });
  }
  if (exercise.mechanic) {
    classification.push({ label: MECHANIC_LABELS[exercise.mechanic], tone: BadgeTones.Violet });
  }
  if (exercise.force) {
    classification.push({ label: FORCE_LABELS[exercise.force], tone: BadgeTones.Info });
  }
  if (exercise.isUnilateral) {
    classification.push({ label: 'Unilateral', tone: BadgeTones.Navy });
  }
  if (classification.length > 0) {
    rows.push({
      icon: 'move-outline',
      color: 'violet',
      tone: HexAvatarTones.Base,
      label: 'Classification',
      chips: classification,
      hint: null,
    });
  }

  if (mine) {
    // A lock, not a caret: this says who can see it, and it is not a menu.
    rows.push(
      exercise.visibility === ExerciseVisibility.Private
        ? {
            icon: 'lock-closed-outline',
            color: 'dark',
            tone: HexAvatarTones.Base,
            label: 'Visibility',
            chips: [{ label: 'Private', tone: BadgeTones.Medium, icon: 'lock-closed-outline' }],
            hint: 'Only you can see it',
          }
        : {
            icon: 'globe-outline',
            color: 'info',
            tone: HexAvatarTones.Shade,
            label: 'Visibility',
            chips: [{ label: 'Public', tone: BadgeTones.Info, icon: 'globe-outline' }],
            hint: 'Other coaches can find and fork it',
          },
    );
  }

  return rows;
}

/**
 * The Muscles & equipment card — the create form's second step, read back:
 * a row per muscle role that has anything in it, then equipment. Needing no
 * equipment is still a fact worth a line ("no venue set" gets one on a
 * session), so that row stays and says so rather than vanishing.
 */
export function muscleEquipmentRows(exercise: Exercise): ExerciseChipRow[] {
  const rows = MUSCLE_ROLE_ORDER.flatMap((role): ExerciseChipRow[] => {
    const names = musclesByRole(exercise, role);
    if (names.length === 0) return [];
    const meta = MUSCLE_ROLE_META[role];
    const tone = badgeTone(meta.color);
    return [
      {
        icon: 'body-outline',
        color: meta.color,
        tone: tileTone(meta.color),
        label: MUSCLE_ROLE_LABELS[role],
        chips: names.map((label) => ({ label, tone })),
        hint: meta.hint,
      },
    ];
  });

  const equipment = (exercise.equipment ?? []).map((item) => item.name);
  rows.push(
    equipment.length > 0
      ? {
          icon: 'barbell-outline',
          color: 'secondary',
          tone: HexAvatarTones.Base,
          label: 'Equipment',
          chips: equipment.map((label) => ({ label, tone: BadgeTones.Navy })),
          hint: null,
        }
      : {
          icon: 'barbell-outline',
          color: 'medium',
          tone: HexAvatarTones.Base,
          label: 'Equipment',
          chips: [],
          hint: 'None needed',
        },
  );

  return rows;
}
