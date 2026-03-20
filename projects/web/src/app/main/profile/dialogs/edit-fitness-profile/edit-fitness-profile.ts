import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  output,
  signal,
  inject,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  MyProfile,
  UpdateFitnessProfilePayload,
  FitnessLevel,
  FitnessLevels,
} from 'core';

interface FitnessForm {
  heightCm: number | null;
  weightKg: number | null;
  fitnessLevel: FitnessLevel | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

@Component({
  selector: 'bee-edit-fitness-profile',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DividerModule,
  ],
  templateUrl: './edit-fitness-profile.html',
  styleUrl: './edit-fitness-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditFitnessProfile {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly form = signal<FitnessForm>({
    heightCm: null,
    weightKg: null,
    fitnessLevel: null,
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  readonly fitnessOptions = [
    { label: 'Beginner', value: FitnessLevels.Beginner },
    { label: 'Intermediate', value: FitnessLevels.Intermediate },
    { label: 'Advanced', value: FitnessLevels.Advanced },
  ];

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const fp = this.profile().fitnessProfile;
      this.form.set({
        heightCm: fp?.heightCm ?? null,
        weightKg: fp?.weightKg ?? null,
        fitnessLevel: fp?.fitnessLevel ?? null,
        emergencyContactName: fp?.emergencyContactName ?? '',
        emergencyContactPhone: fp?.emergencyContactPhone ?? '',
      });
    }
  });

  updateField(field: keyof FitnessForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  save(): void {
    const fp = this.profile().fitnessProfile;
    const f = this.form();
    const payload: UpdateFitnessProfilePayload = {};

    if (f.heightCm !== (fp?.heightCm ?? null)) payload.heightCm = f.heightCm ?? undefined;
    if (f.weightKg !== (fp?.weightKg ?? null)) payload.weightKg = f.weightKg ?? undefined;
    if (f.fitnessLevel !== (fp?.fitnessLevel ?? null)) payload.fitnessLevel = f.fitnessLevel ?? undefined;
    if (f.emergencyContactName !== (fp?.emergencyContactName ?? '')) payload.emergencyContactName = f.emergencyContactName || undefined;
    if (f.emergencyContactPhone !== (fp?.emergencyContactPhone ?? '')) payload.emergencyContactPhone = f.emergencyContactPhone || undefined;

    if (!Object.keys(payload).length) {
      this.visible.set(false);
      this._messageService.add({ severity: 'info', summary: 'No changes', detail: 'No changes were made.' });
      return;
    }

    this.saving.set(true);
    this._profileService.updateFitnessProfile(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({ severity: 'success', summary: 'Profile updated', detail: 'Fitness profile updated successfully.' });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this._messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to update fitness profile.' });
      },
    });
  }
}
