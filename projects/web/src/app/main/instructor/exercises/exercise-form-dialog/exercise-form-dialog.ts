import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

import {
  CreateExercisePayload,
  Exercise,
  ExerciseForce,
  ExerciseKind,
  ExerciseLevel,
  ExerciseMechanic,
  ExerciseService,
  ExerciseTaxonomyStore,
  ExerciseVisibility,
  MovementPattern,
  MuscleRole,
  UpdateExercisePayload,
  showApiError,
  youtubeThumbnailUrl,
  youtubeVideoId,
} from 'core';

interface KindCard {
  value: ExerciseKind;
  label: string;
  icon: string;
  hint: string;
}

interface LevelOption {
  value: ExerciseLevel;
  label: string;
  icon: string;
}

interface MultiOption<T> {
  value: T;
  label: string;
}

/**
 * Create / Edit custom exercise dialog (S3 + S4).
 *
 * Single component covers both flows — `exercise` input switches the
 * mode: null → create, non-null → edit. The form layout and validation
 * are identical; the only differences in edit mode are the title, the
 * divergence banner when fork_count > 0, and the Save handler routing
 * to PATCH instead of POST.
 *
 * Visibility / source / fork_count / ownership are all server-controlled
 * — the form never sends `source` (that's INSTRUCTOR by definition on
 * this surface) or `ownerId` (derived from JWT). Visibility IS
 * editable: PUBLIC ↔ PRIVATE flip is a normal owner action; the BE
 * preserves existing references regardless (locked decision §16).
 */
@Component({
  selector: 'mh-exercise-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    MultiSelect,
    Select,
    TextareaModule,
    ToggleSwitch,
  ],
  templateUrl: './exercise-form-dialog.html',
  styleUrl: './exercise-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseFormDialog {
  readonly visible = model(false);
  readonly exercise = input<Exercise | null>(null);

  readonly saved = output<Exercise>();

  private readonly _exerciseService = inject(ExerciseService);
  private readonly _messageService = inject(MessageService);
  readonly taxonomy = inject(ExerciseTaxonomyStore);

  readonly Visibilities = ExerciseVisibility;

  // ── Form state ───────────────────────────────────────────────────

  readonly name = signal('');
  readonly description = signal('');
  readonly instructions = signal('');
  readonly kind = signal<ExerciseKind | null>(null);
  readonly level = signal<ExerciseLevel>(ExerciseLevel.Beginner);
  readonly movementPattern = signal<MovementPattern | null>(null);
  readonly mechanic = signal<ExerciseMechanic | null>(null);
  readonly force = signal<ExerciseForce | null>(null);
  readonly isUnilateral = signal(false);
  readonly youtubeUrl = signal('');
  readonly visibility = signal<ExerciseVisibility>(ExerciseVisibility.Private);

  // Muscle picker — three separate slots so the UI stays simple and the
  // role on each row is unambiguous. BE validation is identical to what
  // we enforce here (1+ primary, max 3).
  readonly primaryMuscleIds = signal<string[]>([]);
  readonly secondaryMuscleIds = signal<string[]>([]);
  readonly stabilizerMuscleIds = signal<string[]>([]);

  readonly equipmentIds = signal<string[]>([]);

  readonly saving = signal(false);

  // ── Derived ──────────────────────────────────────────────────────

  readonly isEditMode = computed(() => this.exercise() !== null);

  readonly canSave = computed(
    () =>
      this.name().trim().length >= 2 &&
      this.kind() !== null &&
      this.primaryMuscleIds().length >= 1 &&
      this.primaryMuscleIds().length <= 3,
  );

  readonly dialogTitle = computed(() =>
    this.isEditMode() ? 'Edit exercise' : 'New custom exercise',
  );

  readonly nameCharCount = computed(() => this.name().length);

  /** Editors that have forks see a warning — their changes won't propagate. */
  readonly forkDivergenceCount = computed(() => {
    const e = this.exercise();
    if (!e || e.visibility !== ExerciseVisibility.Public) return 0;
    return e.forkCount;
  });

  readonly youtubeThumb = computed(() => {
    const id = youtubeVideoId(this.youtubeUrl());
    return id ? youtubeThumbnailUrl(id) : null;
  });

  readonly youtubeValid = computed(() => {
    const url = this.youtubeUrl().trim();
    if (!url) return true; // empty is valid (optional field)
    return youtubeVideoId(url) !== null;
  });

  readonly kindCards: KindCard[] = [
    {
      value: ExerciseKind.Strength,
      label: 'Strength',
      icon: 'pi-bolt',
      hint: 'Reps + weight',
    },
    {
      value: ExerciseKind.Cardio,
      label: 'Cardio',
      icon: 'pi-heart',
      hint: 'Duration + distance + HR',
    },
    {
      value: ExerciseKind.Duration,
      label: 'Duration',
      icon: 'pi-clock',
      hint: 'Time only — e.g. plank',
    },
    {
      value: ExerciseKind.Distance,
      label: 'Distance',
      icon: 'pi-map',
      hint: 'Distance only',
    },
    {
      value: ExerciseKind.Bodyweight,
      label: 'Bodyweight',
      icon: 'pi-user',
      hint: 'Reps, no load',
    },
    {
      value: ExerciseKind.Mobility,
      label: 'Mobility',
      icon: 'pi-sync',
      hint: 'Time / reps, mobility',
    },
  ];

  readonly levelOptions: LevelOption[] = [
    {
      value: ExerciseLevel.Beginner,
      label: 'Beginner',
      icon: 'pi-angle-down',
    },
    {
      value: ExerciseLevel.Intermediate,
      label: 'Intermediate',
      icon: 'pi-equals',
    },
    {
      value: ExerciseLevel.Advanced,
      label: 'Advanced',
      icon: 'pi-angle-double-up',
    },
  ];

  readonly patternOptions: MultiOption<MovementPattern>[] = [
    { value: MovementPattern.Squat, label: 'Squat' },
    { value: MovementPattern.Hinge, label: 'Hinge' },
    { value: MovementPattern.Lunge, label: 'Lunge' },
    { value: MovementPattern.PushHorizontal, label: 'Horizontal push' },
    { value: MovementPattern.PushVertical, label: 'Vertical push' },
    { value: MovementPattern.PullHorizontal, label: 'Horizontal pull' },
    { value: MovementPattern.PullVertical, label: 'Vertical pull' },
    { value: MovementPattern.Carry, label: 'Carry' },
    { value: MovementPattern.Rotation, label: 'Rotation' },
    { value: MovementPattern.AntiRotation, label: 'Anti-rotation' },
    { value: MovementPattern.Locomotion, label: 'Locomotion' },
    { value: MovementPattern.Isolation, label: 'Isolation' },
  ];

  readonly mechanicOptions: MultiOption<ExerciseMechanic>[] = [
    { value: ExerciseMechanic.Compound, label: 'Compound' },
    { value: ExerciseMechanic.Isolation, label: 'Isolation' },
  ];

  readonly forceOptions: MultiOption<ExerciseForce>[] = [
    { value: ExerciseForce.Push, label: 'Push' },
    { value: ExerciseForce.Pull, label: 'Pull' },
    { value: ExerciseForce.Static, label: 'Static' },
  ];

  constructor() {
    this.taxonomy.ensureLoaded();

    // Reset / pre-fill whenever the dialog opens, NOT on every signal
    // tick (which would clobber the user's typing every time the parent
    // re-renders).
    effect(() => {
      if (!this.visible()) return;
      this.populateForm(this.exercise());
    });
  }

  // ── Actions ──────────────────────────────────────────────────────

  selectKind(value: ExerciseKind): void {
    this.kind.set(value);
  }

  cancel(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.canSave() || this.saving()) return;

    const payload = this.buildPayload();
    if (!payload) return;

    this.saving.set(true);

    const req$ = this.isEditMode()
      ? this._exerciseService.update(this.exercise()!.id, payload)
      : this._exerciseService.create(payload as CreateExercisePayload);

    req$.subscribe({
      next: (saved) => {
        this._messageService.add({
          severity: 'success',
          summary: this.isEditMode() ? 'Exercise updated' : 'Exercise created',
          detail: saved.name,
          life: 3000,
        });
        this.saved.emit(saved);
        this.visible.set(false);
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this.isEditMode() ? 'Update failed' : 'Create failed',
          'Check the highlighted fields and try again.',
          err,
        ),
      complete: () => this.saving.set(false),
    });
  }

  // ── Internals ────────────────────────────────────────────────────

  private populateForm(ex: Exercise | null): void {
    if (!ex) {
      // Fresh create — all defaults.
      this.name.set('');
      this.description.set('');
      this.instructions.set('');
      this.kind.set(null);
      this.level.set(ExerciseLevel.Beginner);
      this.movementPattern.set(null);
      this.mechanic.set(null);
      this.force.set(null);
      this.isUnilateral.set(false);
      this.youtubeUrl.set('');
      this.visibility.set(ExerciseVisibility.Private);
      this.primaryMuscleIds.set([]);
      this.secondaryMuscleIds.set([]);
      this.stabilizerMuscleIds.set([]);
      this.equipmentIds.set([]);
      return;
    }
    // Edit — pre-fill from the row.
    this.name.set(ex.name);
    this.description.set(ex.description ?? '');
    this.instructions.set(ex.instructions ?? '');
    this.kind.set(ex.kind);
    this.level.set(ex.level);
    this.movementPattern.set(ex.movementPattern);
    this.mechanic.set(ex.mechanic);
    this.force.set(ex.force);
    this.isUnilateral.set(ex.isUnilateral);
    this.youtubeUrl.set(ex.youtubeUrl ?? '');
    this.visibility.set(ex.visibility);

    const roles = ex.muscleRoles ?? [];
    this.primaryMuscleIds.set(
      roles.filter((m) => m.role === MuscleRole.Primary).map((m) => m.muscleId),
    );
    this.secondaryMuscleIds.set(
      roles
        .filter((m) => m.role === MuscleRole.Secondary)
        .map((m) => m.muscleId),
    );
    this.stabilizerMuscleIds.set(
      roles
        .filter((m) => m.role === MuscleRole.Stabilizer)
        .map((m) => m.muscleId),
    );

    this.equipmentIds.set((ex.equipment ?? []).map((e) => e.id));
  }

  private buildPayload(): CreateExercisePayload | UpdateExercisePayload | null {
    const k = this.kind();
    if (!k) return null;

    const muscles = [
      ...this.primaryMuscleIds().map((muscleId) => ({
        muscleId,
        role: MuscleRole.Primary,
      })),
      ...this.secondaryMuscleIds().map((muscleId) => ({
        muscleId,
        role: MuscleRole.Secondary,
      })),
      ...this.stabilizerMuscleIds().map((muscleId) => ({
        muscleId,
        role: MuscleRole.Stabilizer,
      })),
    ];

    const url = this.youtubeUrl().trim();

    return {
      name: this.name().trim(),
      description: this.description().trim() || undefined,
      instructions: this.instructions().trim() || undefined,
      kind: k,
      level: this.level(),
      movementPattern: this.movementPattern() ?? undefined,
      mechanic: this.mechanic() ?? undefined,
      force: this.force() ?? undefined,
      isUnilateral: this.isUnilateral(),
      youtubeUrl: url || undefined,
      visibility: this.visibility(),
      muscles,
      equipmentIds: this.equipmentIds().length ? this.equipmentIds() : undefined,
    };
  }
}
