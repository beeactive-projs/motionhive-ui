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
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import {
  MyProfile,
  ProfileService,
  UpdateInstructorProfilePayload,
  showApiError,
} from 'core';

interface InstructorForm {
  displayName: string;
  bio: string;
  specializations: string;
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
}

@Component({
  selector: 'mh-edit-instructor-profile',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    ToggleSwitchModule,
  ],
  templateUrl: './edit-instructor-profile.html',
  styleUrl: './edit-instructor-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditInstructorProfile {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly form = signal<InstructorForm>({
    displayName: '',
    bio: '',
    specializations: '',
    yearsOfExperience: null,
    isAcceptingClients: false,
  });

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const ip = this.profile().instructorProfile;
      this.form.set({
        displayName: ip?.displayName ?? '',
        bio: ip?.bio ?? '',
        specializations: ip?.specializations?.join(', ') ?? '',
        yearsOfExperience: ip?.yearsOfExperience ?? null,
        isAcceptingClients: ip?.isAcceptingClients ?? false,
      });
    }
  });

  updateField(field: keyof InstructorForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  save(): void {
    const ip = this.profile().instructorProfile;
    const f = this.form();
    const instrChanges: UpdateInstructorProfilePayload = {};

    if (f.displayName !== (ip?.displayName ?? ''))
      instrChanges.displayName = f.displayName || undefined;
    if (f.bio !== (ip?.bio ?? '')) instrChanges.bio = f.bio || undefined;
    const newSpecs = f.specializations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(newSpecs) !== JSON.stringify(ip?.specializations ?? []))
      instrChanges.specializations = newSpecs;
    if (f.yearsOfExperience !== (ip?.yearsOfExperience ?? null))
      instrChanges.yearsOfExperience = f.yearsOfExperience ?? undefined;
    if (f.isAcceptingClients !== (ip?.isAcceptingClients ?? false))
      instrChanges.isAcceptingClients = f.isAcceptingClients;

    if (!Object.keys(instrChanges).length) {
      this.visible.set(false);
      this._messageService.add({
        severity: 'info',
        summary: 'No changes',
        detail: 'No changes were made.',
      });
      return;
    }

    this.saving.set(true);
    this._profileService.updateInstructorProfile(instrChanges).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Profile updated',
          detail: 'Instructor profile updated successfully.',
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        showApiError(
          this._messageService,
          'Error',
          'Failed to update instructor profile.',
          err,
        );
      },
    });
  }
}
