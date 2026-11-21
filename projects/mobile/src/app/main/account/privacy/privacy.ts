import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { take } from 'rxjs';

import {
  PrivacyControlledField,
  ProfilePrivacy,
  ProfilePrivacyLabels,
  MessagingService,
  ProfileService,
  UserService,
  WhoCanMessage,
  resolveFieldPrivacy,
} from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { FeedbackService } from '../../../_shared/services/feedback.service';
import { ChoiceOption, ChoiceSheet } from '../../../_shared/components/choice-sheet/choice-sheet';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { ACCOUNT_ICONS } from '../account.config';
import { AccountStore } from '../account.store';
import { ProfileStacks } from '../../../_shared/utils/stack-paths';
import { DETAIL_TILES } from '../../../_shared/config/detail-tiles.config';
import {
  WORKOUT_VISIBILITY_LEVELS,
  workoutVisibilityHint,
} from '../../../_shared/config/workout-visibility.config';

interface PrivacyRow {
  field: PrivacyControlledField;
  labelKey: string;
  icon: string;
  iconColor: string;
  /** The levels offered; all three when absent. */
  levels?: readonly ProfilePrivacy[];
  /** The line under each level; the profile wording when absent. */
  hint?: (level: ProfilePrivacy) => string;
  /** Translation key for a line under the row's label. */
  note?: string;
}

/** The birthday's levels say what they show: the age, never the date. */
export function ageVisibilityHint(level: ProfilePrivacy): string {
  return `account.privacy.ageHint.${level}`;
}

/**
 * The details whose audience a person chooses, in the order web's profile
 * lists them. Name and photo are always public, so they are not here.
 */
export const PRIVACY_ROWS: readonly PrivacyRow[] = [
  { field: 'email', labelKey: 'form.label.email', icon: DETAIL_TILES.email.icon, iconColor: DETAIL_TILES.email.color },
  { field: 'phone', labelKey: 'form.label.phone', icon: DETAIL_TILES.phone.icon, iconColor: DETAIL_TILES.phone.color },
  { field: 'city', labelKey: 'form.label.location', icon: DETAIL_TILES.location.icon, iconColor: DETAIL_TILES.location.color },
  { field: 'language', labelKey: 'form.label.language', icon: DETAIL_TILES.language.icon, iconColor: DETAIL_TILES.language.color },
  { field: 'timezone', labelKey: 'form.label.timezone', icon: DETAIL_TILES.timezone.icon, iconColor: DETAIL_TILES.timezone.color },
  {
    field: 'birthDate',
    labelKey: 'aboutYou.birthday',
    icon: DETAIL_TILES.birthday.icon,
    iconColor: DETAIL_TILES.birthday.color,
    hint: ageVisibilityHint,
    note: 'account.privacy.birthdayNote',
  },
  { field: 'gender', labelKey: 'aboutYou.gender', icon: DETAIL_TILES.gender.icon, iconColor: DETAIL_TILES.gender.color },
];

/**
 * Not a detail on the profile: the level each new workout starts at. Every
 * workout can still be changed from its summary.
 */
export const WORKOUTS_PRIVACY_ROW: PrivacyRow = {
  field: 'workouts',
  labelKey: 'workoutVisibility.newWorkouts',
  icon: 'barbell-outline',
  iconColor: 'primary',
  levels: WORKOUT_VISIBILITY_LEVELS,
  hint: workoutVisibilityHint,
};

/**
 * "Who can message you" (API migration 090): straight into the chats for
 * everyone, a message request for anyone not connected (the default), or
 * nobody but the people one trains with.
 */
export const WHO_CAN_MESSAGE_OPTIONS: readonly {
  value: WhoCanMessage;
  label: string;
  /** The row's value: short enough to sit beside its label. */
  short: string;
  hint: string;
}[] = [
  {
    value: WhoCanMessage.Everyone,
    label: 'account.privacy.messages.who.EVERYONE',
    short: 'account.privacy.messages.whoShort.EVERYONE',
    hint: 'account.privacy.messages.whoHint.EVERYONE',
  },
  {
    value: WhoCanMessage.Requests,
    label: 'account.privacy.messages.who.REQUESTS',
    short: 'account.privacy.messages.whoShort.REQUESTS',
    hint: 'account.privacy.messages.whoHint.REQUESTS',
  },
  {
    value: WhoCanMessage.Connections,
    label: 'account.privacy.messages.who.CONNECTIONS',
    short: 'account.privacy.messages.whoShort.CONNECTIONS',
    hint: 'account.privacy.messages.whoHint.CONNECTIONS',
  },
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
    EmptyState,
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
    IonToggle,
    IonToolbar,
    HexAvatar,
    SettingsRow,
    TranslatePipe,
  ],
  templateUrl: './privacy.html',
})
export class AccountPrivacy implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _messagingService = inject(MessagingService);
  private readonly _userService = inject(UserService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _router = inject(Router);

  readonly store = inject(AccountStore);

  readonly account = this.store.account;
  readonly rows = PRIVACY_ROWS;
  readonly workoutsRow = WORKOUTS_PRIVACY_ROW;

  /** The detail whose sheet is open. */
  readonly editing = signal<PrivacyRow | null>(null);
  readonly sheetOpen = signal(false);
  /** Fields with a save in flight: a second tap would race the first. */
  readonly saving = signal<ReadonlySet<PrivacyControlledField>>(new Set());

  /** The open row's levels, each with the line that says what it means there. */
  readonly levelOptions = computed<ChoiceOption[]>(() => {
    const row = this.editing();
    const levels = row?.levels ?? Object.values(ProfilePrivacy);
    return levels.map((level) => ({
      value: level,
      label: ProfilePrivacyLabels[level],
      hint: this._translateService.instant(
        row?.hint ? row.hint(level) : `account.privacy.hint.${level}`,
      ),
    }));
  });

  // ── Messages ─────────────────────────────────────────────────────

  readonly whoOpen = signal(false);
  readonly savingWho = signal(false);
  readonly savingFind = signal(false);

  readonly whoCanMessage = computed(
    () => this.account()?.whoCanMessage ?? WhoCanMessage.Requests,
  );
  /** On when the API says nothing: the default for everyone. */
  readonly findByName = computed(() => this.account()?.findByName ?? true);

  readonly whoCanMessageLabel = computed(() => {
    const option = WHO_CAN_MESSAGE_OPTIONS.find((o) => o.value === this.whoCanMessage());
    if (!option) {
      return '';
    }
    return this._translateService.instant(option.short);
  });

  readonly whoOptions = computed<ChoiceOption[]>(() =>
    WHO_CAN_MESSAGE_OPTIONS.map((option) => ({
      value: option.value,
      label: this._translateService.instant(option.label),
      hint: this._translateService.instant(option.hint),
    })),
  );

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

  /** The line under a row's label, translated; null for a row with none. */
  noteOf(row: PrivacyRow): string | null {
    if (!row.note) {
      return null;
    }
    return this._translateService.instant(row.note);
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
    const level = (row?.levels ?? Object.values(ProfilePrivacy)).find(
      (candidate) => candidate === value,
    );
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

  /** Saved on the tap; the old choice comes back if the server refuses. */
  onWhoPicked(value: string): void {
    const option = WHO_CAN_MESSAGE_OPTIONS.find((o) => o.value === value);
    if (!option || option.value === this.whoCanMessage()) {
      return;
    }
    const previous = this.whoCanMessage();
    this.store.patchAccount({ whoCanMessage: option.value });
    this.savingWho.set(true);
    this._messagingService
      .updateSettings({ whoCanMessage: option.value })
      .pipe(take(1))
      .subscribe({
        next: () => this.savingWho.set(false),
        error: (error: unknown) => {
          this.savingWho.set(false);
          this.store.patchAccount({ whoCanMessage: previous });
          void this._feedbackService.error(
            error,
            this._translateService.instant('account.privacy.saveFailed'),
          );
        },
      });
  }

  toggleFindByName(): void {
    if (this.savingFind()) {
      return;
    }
    const next = !this.findByName();
    this.store.patchAccount({ findByName: next });
    this.savingFind.set(true);
    this._userService
      .updateMe({ findByName: next })
      .pipe(take(1))
      .subscribe({
        next: () => this.savingFind.set(false),
        error: (error: unknown) => {
          this.savingFind.set(false);
          this.store.patchAccount({ findByName: !next });
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

  /** Sensitive actions: what cannot be undone, Delete account among them. */
  openSensitive(): void {
    void this._router.navigateByUrl(`${ProfileStacks.Account}/sensitive`);
  }
}
