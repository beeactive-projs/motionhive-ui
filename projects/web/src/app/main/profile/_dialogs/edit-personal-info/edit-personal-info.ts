import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore, MyProfile, ProfileService, UserLocation } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { LocationPicker } from '../../../../_shared/components/location-picker/location-picker';

interface PersonalInfoForm {
  firstName: string;
  lastName: string;
  phone: string;
  location: UserLocation | null;
}

@Component({
  selector: 'mh-edit-personal-info',
  imports: [FormsModule, Button, Dialog, InputText, LocationPicker],
  templateUrl: './edit-personal-info.html',
  styleUrl: './edit-personal-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPersonalInfo {
  private readonly _profileService = inject(ProfileService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly form = signal<PersonalInfoForm>({
    firstName: '',
    lastName: '',
    phone: '',
    location: null,
  });

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const a = this.profile().account;
      this.form.set({
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone ?? '',
        location:
          a.location?.city || a.location?.country || a.location?.name || a.location?.address
            ? {
                name: a.location?.name ?? null,
                address: a.location?.address ?? null,
                city: a.location?.city,
                country: a.location?.country,
              }
            : null,
      });
    }
  });

  updateField(field: keyof PersonalInfoForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  save(): void {
    const a = this.profile().account;
    const f = this.form();

    const account: Record<string, unknown> = {};
    if (f.firstName !== a.firstName) account['firstName'] = f.firstName;
    if (f.lastName !== a.lastName) account['lastName'] = f.lastName;
    if ((f.phone || null) !== a.phone) account['phone'] = f.phone || null;

    const newName = f.location?.name ?? null;
    const newAddress = f.location?.address ?? null;
    const newCity = f.location?.city ?? null;
    const newCountry = f.location?.country ?? null;
    if (newName !== (a.location?.name ?? null)) account['locationName'] = newName;
    if (newAddress !== (a.location?.address ?? null)) account['locationAddress'] = newAddress;
    if (newCity !== a.location?.city) account['locationCity'] = newCity;
    if (newCountry !== a.location?.country) account['locationCountry'] = newCountry;

    if (!Object.keys(account).length) {
      this.visible.set(false);
      this._messageService.add({
        severity: 'info',
        summary: 'No changes',
        detail: 'No changes were made.',
      });
      return;
    }

    this.saving.set(true);
    this._profileService.updateMyProfile({ account }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.visible.set(false);

        // Keep AuthStore user in sync with the new location
        const currentUser = this._authStore.user();
        if (currentUser) {
          this._authStore.setUser({
            ...currentUser,
            firstName: updated.account.firstName,
            lastName: updated.account.lastName,
            location: updated.account.location,
          });
        }

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
}
