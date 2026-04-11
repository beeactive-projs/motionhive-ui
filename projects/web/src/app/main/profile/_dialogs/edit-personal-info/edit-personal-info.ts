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
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  MyProfile,
  UpdateMyProfilePayload,
  Gender,
  Genders,
  TIMEZONE_OPTIONS,
} from 'core';

interface PersonalInfoForm {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date | null;
  gender: Gender | null;
  timezone: string | null;
  medicalConditions: string;
  notes: string;
}

@Component({
  selector: 'mh-edit-personal-info',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DatePickerModule,
    DividerModule,
  ],
  templateUrl: './edit-personal-info.html',
  styleUrl: './edit-personal-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPersonalInfo {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly today = new Date();

  readonly timezoneOptions = TIMEZONE_OPTIONS;

  readonly form = signal<PersonalInfoForm>({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: null,
    gender: null,
    timezone: null,
    medicalConditions: '',
    notes: '',
  });

  readonly genderOptions = [
    { label: 'Male', value: Genders.Male },
    { label: 'Female', value: Genders.Female },
    { label: 'Other', value: Genders.Other },
    { label: 'Prefer not to say', value: Genders.PreferNotToSay },
  ];

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const p = this.profile();
      const fp = p.fitnessProfile;
      this.form.set({
        firstName: p.account.firstName,
        lastName: p.account.lastName,
        phone: p.account.phone ?? '',
        dateOfBirth: fp?.dateOfBirth ? this._parseDate(fp.dateOfBirth) : null,
        gender: fp?.gender ?? null,
        timezone: p.account.timezone ?? null,
        medicalConditions: fp?.medicalConditions?.join(', ') ?? '',
        notes: fp?.notes ?? '',
      });
    }
  });

  updateField(field: keyof PersonalInfoForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  save(): void {
    const p = this.profile();
    const fp = p.fitnessProfile;
    const f = this.form();
    const payload: UpdateMyProfilePayload = {};

    const accountChanges: NonNullable<UpdateMyProfilePayload['account']> = {};
    if (f.firstName !== p.account.firstName) accountChanges.firstName = f.firstName;
    if (f.lastName !== p.account.lastName) accountChanges.lastName = f.lastName;
    if (f.phone !== (p.account.phone ?? '')) accountChanges.phone = f.phone;
    if (f.timezone !== (p.account.timezone ?? null))
      accountChanges.timezone = f.timezone ?? undefined;
    if (Object.keys(accountChanges).length) payload.account = accountChanges;

    const fitnessChanges: NonNullable<UpdateMyProfilePayload['fitnessProfile']> = {};
    const newDob = f.dateOfBirth ? this._formatDate(f.dateOfBirth) : '';
    if (newDob !== (fp?.dateOfBirth ?? '')) fitnessChanges.dateOfBirth = newDob || undefined;
    if (f.gender !== (fp?.gender ?? null)) fitnessChanges.gender = f.gender ?? undefined;
    const newMed = f.medicalConditions
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (JSON.stringify(newMed) !== JSON.stringify(fp?.medicalConditions ?? []))
      fitnessChanges.medicalConditions = newMed;
    if (f.notes !== (fp?.notes ?? '')) fitnessChanges.notes = f.notes || undefined;
    if (Object.keys(fitnessChanges).length) payload.fitnessProfile = fitnessChanges;

    if (!payload.account && !payload.fitnessProfile) {
      this.visible.set(false);
      this._messageService.add({
        severity: 'info',
        summary: 'No changes',
        detail: 'No changes were made.',
      });
      return;
    }

    this.saving.set(true);
    this._profileService.updateMyProfile(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Profile updated',
          detail: 'Personal information updated successfully.',
        });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to update profile.',
        });
      },
    });
  }

  private _parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private _formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
