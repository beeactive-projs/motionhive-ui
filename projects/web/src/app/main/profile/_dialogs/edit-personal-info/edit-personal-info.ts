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
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthStore,
  MyProfile,
  PickedLocation,
  ProfileService,
  StripeOnboardingStore,
  UserRoles,
  showApiError,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { LocationPicker } from '../../../../_shared/components/location-picker/location-picker';
import { PhoneInput } from '../../../../_shared/components/phone-input/phone-input';

/**
 * Edit personal information dialog — edits fields that live on the
 * user account (including country + city). Instructor-specific
 * fields are handled by `edit-instructor-profile`. Venues (where
 * training happens) are managed separately under /coaching/venues.
 */
interface PersonalInfoForm {
  firstName: string;
  lastName: string;
  /** E.164 string, or null when empty / invalid. */
  phone: string | null;
  location: PickedLocation | null;
}

/**
 * Rehydrate the form's location signal from the current profile's
 * flat country/city. We don't have street-level data on the account
 * (the user never filled it), so `line1`, `region`, `postalCode`,
 * `latitude`, `longitude` stay null — the picker will overwrite with
 * rich data if the user picks a new place.
 */
function locationFromAccount(
  account: MyProfile['account'],
): PickedLocation | null {
  if (!account.city && !account.countryCode) return null;
  return {
    displayName: [account.city, account.countryCode].filter(Boolean).join(', '),
    line1: null,
    city: account.city ?? null,
    region: null,
    postalCode: null,
    country: null,
    countryCode: account.countryCode ?? null,
    latitude: null,
    longitude: null,
  };
}

@Component({
  selector: 'mh-edit-personal-info',
  imports: [FormsModule, Button, Dialog, InputText, LocationPicker, PhoneInput],
  templateUrl: './edit-personal-info.html',
  styleUrl: './edit-personal-info.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditPersonalInfo {
  private readonly _profileService = inject(ProfileService);
  private readonly _onboardingStore = inject(StripeOnboardingStore);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  /** Handle to the phone input so we can check its validity state
   *  before submit. The dialog refuses to save when the input has
   *  a value but it's not valid E.164. */
  private readonly _phoneInput = viewChild<PhoneInput>(PhoneInput);

  readonly saving = signal(false);
  /**
   * True when the user has a Stripe Connect account — country becomes
   * read-only at that point because Stripe doesn't allow country
   * changes. Reads from the shared onboarding store so we don't
   * re-fetch the status every time the dialog opens.
   */
  readonly countryLocked = computed(() => this._onboardingStore.hasAccount());

  readonly form = signal<PersonalInfoForm>({
    firstName: '',
    lastName: '',
    phone: null,
    location: null,
  });

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const a = this.profile().account;
      this.form.set({
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone ?? null,
        location: locationFromAccount(a),
      });

      // Only instructors can have a Stripe account. The store does
      // its own caching, so calling ensureLoaded() repeatedly is a
      // no-op once the status has been pulled.
      const isInstructor = this.profile().roles.includes(UserRoles.Instructor);
      if (isInstructor) {
        this._onboardingStore.ensureLoaded();
      }
    }
  });

  updateField(field: keyof PersonalInfoForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  save(): void {
    const a = this.profile().account;
    const f = this.form();

    // Block submit when the phone input has characters but doesn't
    // parse to valid E.164 — otherwise we'd silently drop the number
    // and the user would see the "No changes" toast.
    if (this._phoneInput()?.invalid()) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Phone number invalid',
        detail:
          'Enter a valid phone number or clear the field before saving.',
      });
      return;
    }

    const account: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      countryCode?: string | null;
      city?: string | null;
    } = {};

    if (f.firstName !== a.firstName) account.firstName = f.firstName;
    if (f.lastName !== a.lastName) account.lastName = f.lastName;
    if ((f.phone ?? null) !== (a.phone ?? null)) account.phone = f.phone;

    const newCity = f.location?.city ?? null;
    const newCountryCode = f.location?.countryCode ?? null;

    // Country is locked once Stripe Connect is set up — Stripe does
    // not let us change a connected account's country, so allowing
    // a profile-side change would silently desync the two. Reject
    // in the UI with an actionable message. City stays editable.
    if (
      this.countryLocked() &&
      newCountryCode !== (a.countryCode ?? null)
    ) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Country is locked',
        detail:
          'Your country cannot be changed because payments are set up. Contact support if you need to migrate.',
      });
      return;
    }

    if (newCity !== (a.city ?? null)) account.city = newCity;
    if (newCountryCode !== (a.countryCode ?? null)) {
      account.countryCode = newCountryCode;
    }

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

        const currentUser = this._authStore.user();
        if (currentUser) {
          this._authStore.setUser({
            ...currentUser,
            firstName: updated.account.firstName,
            lastName: updated.account.lastName,
            countryCode: updated.account.countryCode,
            city: updated.account.city,
          });
        }

        this._messageService.add({
          severity: 'success',
          summary: 'Profile updated',
          detail: 'Personal information updated successfully.',
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        showApiError(
          this._messageService,
          'Error',
          'Failed to update profile.',
          err,
        );
      },
    });
  }
}
