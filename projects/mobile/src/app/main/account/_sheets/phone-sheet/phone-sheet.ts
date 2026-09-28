import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { IonInput, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AsYouType,
  CountryCode,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import { take } from 'rxjs';

import {
  ProfileService,
  STRIPE_CONNECT_COUNTRIES,
  appLocale,
  countryFlagEmoji,
  countryNameFromCode,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

const DEFAULT_COUNTRY: CountryCode = 'RO';

/**
 * Phone number, stored as E.164.
 *
 * Web's equivalent is a PrimeNG component mobile cannot import, so the country
 * picker is rebuilt here on `ion-select`. Clearing the field is a valid edit —
 * the API accepts `null`.
 */
@Component({
  selector: 'mh-phone-sheet',
  imports: [IonInput, IonSelect, IonSelectOption, SheetShell, TranslatePipe],
  templateUrl: './phone-sheet.html',
  styleUrl: './phone-sheet.scss',
})
export class PhoneSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly country = signal<CountryCode>(DEFAULT_COUNTRY);
  readonly nationalNumber = signal('');
  readonly saving = signal(false);

  readonly countries = STRIPE_CONNECT_COUNTRIES.map(({ code }) => ({
    code: code as CountryCode,
    name: countryNameFromCode(code) ?? code,
  }))
    .sort((a, b) => a.name.localeCompare(b.name, appLocale()))
    .map(({ code, name }) => ({
      code,
      label: `${countryFlagEmoji(code)}  ${name} (+${getCountryCallingCode(code)})`,
    }));

  /** `null` when the field is empty — that is a clear, not an error. */
  readonly e164 = computed(() => {
    const raw = this.nationalNumber().trim();
    if (!raw) return null;
    const parsed = parsePhoneNumberFromString(raw, this.country());
    return parsed?.isValid() ? parsed.number : null;
  });

  readonly invalid = computed(() => this.nationalNumber().trim().length > 0 && !this.e164());
  readonly canSave = computed(() => !this.invalid());

  constructor() {
    // Depends on `open()` alone — see the note in `name-sheet`.
    effect(() => {
      if (!this.open()) return;
      const phone = untracked(() => this._accountStore.account()?.phone) ?? '';
      const parsed = phone ? parsePhoneNumberFromString(phone) : null;
      this.country.set(parsed?.country ?? DEFAULT_COUNTRY);
      this.nationalNumber.set(parsed?.formatNational() ?? phone);
    });
  }

  onNumberInput(value: string): void {
    // AsYouType gives the national grouping people expect while typing.
    this.nationalNumber.set(new AsYouType(this.country()).input(value));
  }

  save(): void {
    const next = this.e164();
    const previous = this._accountStore.account()?.phone ?? null;

    if (next === previous) {
      this.open.set(false);
      void this._feedbackService.info(this._translateService.instant('toast.detail.noChanges'));
      return;
    }

    this.saving.set(true);
    this._accountStore.patchAccount({ phone: next });

    this._profileService
      .updateMyProfile({ account: { phone: next } })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success(
            this._translateService.instant(
              next ? 'accountSheets.phone.toast.updated' : 'accountSheets.phone.toast.removed',
            ),
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchAccount({ phone: previous });
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.phone.toast.failed'),
          );
        },
      });
  }
}
