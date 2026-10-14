import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  PrivacyControlledField,
  ProfilePrivacy,
  ProfilePrivacyLabels,
  ProfileService,
  resolveFieldPrivacy,
} from 'core';

import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ChoiceOption, ChoiceSheet } from '../_sheets/choice-sheet/choice-sheet';
import { ACCOUNT_ICONS } from '../account.config';
import { AccountStore } from '../account.store';

interface PrivacyRow {
  field: PrivacyControlledField;
  labelKey: string;
  icon: string;
  iconColor: string;
}

/**
 * The details whose audience a person chooses, in the order web's profile
 * lists them. Name and photo are always public, so they are not here.
 */
export const PRIVACY_ROWS: readonly PrivacyRow[] = [
  { field: 'email', labelKey: 'form.label.email', icon: 'mail-outline', iconColor: 'primary' },
  { field: 'phone', labelKey: 'form.label.phone', icon: 'call-outline', iconColor: 'success' },
  { field: 'city', labelKey: 'form.label.location', icon: 'location-outline', iconColor: 'info' },
  { field: 'language', labelKey: 'form.label.language', icon: 'language-outline', iconColor: 'medium' },
  { field: 'timezone', labelKey: 'form.label.timezone', icon: 'time-outline', iconColor: 'medium' },
];

/**
 * "Who can see my details": one row per detail, each opening a choice of
 * Public, Coaches only or Only me. Saves on the tap, optimistically, and puts
 * the old level back if the server refuses.
 */
@Component({
  selector: 'mh-account-privacy',
  imports: [
    ChoiceSheet,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './privacy.html',
})
export class AccountPrivacy implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(AccountStore);

  readonly account = this.store.account;
  readonly rows = PRIVACY_ROWS;

  /** The detail whose sheet is open. */
  readonly editing = signal<PrivacyRow | null>(null);
  readonly sheetOpen = signal(false);
  /** Fields with a save in flight: a second tap would race the first. */
  readonly saving = signal<ReadonlySet<PrivacyControlledField>>(new Set());

  readonly levelOptions: ChoiceOption[] = Object.values(ProfilePrivacy).map((level) => ({
    value: level,
    label: ProfilePrivacyLabels[level],
    hint: this._translateService.instant(`account.privacy.hint.${level}`),
  }));

  readonly sheetTitle = computed(() => {
    const row = this.editing();
    return row ? this._translateService.instant(row.labelKey) : '';
  });
  readonly sheetSelected = computed(() => {
    const row = this.editing();
    return row ? this.levelOf(row.field) : null;
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  levelOf(field: PrivacyControlledField): ProfilePrivacy {
    return resolveFieldPrivacy(this.account()?.privacySettings, field);
  }

  levelLabel(field: PrivacyControlledField): string {
    return ProfilePrivacyLabels[this.levelOf(field)];
  }

  isSaving(field: PrivacyControlledField): boolean {
    return this.saving().has(field);
  }

  choose(row: PrivacyRow): void {
    this.editing.set(row);
    this.sheetOpen.set(true);
  }

  onPicked(value: string): void {
    const row = this.editing();
    const level = Object.values(ProfilePrivacy).find((candidate) => candidate === value);
    const account = this.account();
    if (!row || !level || !account) return;

    const field = row.field;
    const previous = account.privacySettings;
    this.store.patchAccount({ privacySettings: { ...previous, [field]: level } });
    this._setSaving(field, true);

    this._profileService
      .updatePrivacy({ [field]: level })
      .pipe(take(1))
      .subscribe({
        next: ({ privacySettings }) => {
          this._setSaving(field, false);
          this.store.patchAccount({ privacySettings });
        },
        error: (error: unknown) => {
          this._setSaving(field, false);
          this.store.patchAccount({ privacySettings: previous });
          void this._feedbackService.error(
            error,
            this._translateService.instant('account.privacy.saveFailed'),
          );
        },
      });
  }

  private _setSaving(field: PrivacyControlledField, on: boolean): void {
    this.saving.update((current) => {
      const next = new Set(current);
      if (on) next.add(field);
      else next.delete(field);
      return next;
    });
  }
}
