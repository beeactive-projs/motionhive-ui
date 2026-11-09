import { Component, computed, effect, inject, model, signal, untracked, viewChild } from '@angular/core';
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonTextarea,
  IonToggle,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { InstructorProfile, ProfileService, UpdateInstructorProfilePayload, normalizeUrl } from 'core';

import { ChipInput } from '../../../../_shared/components/chip-input/chip-input';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SocialLinksFields } from '../../../../_shared/components/social-links-fields/social-links-fields';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { AccountStore } from '../../account.store';

const DISPLAY_NAME_MAX_LENGTH = 100;
const BIO_MAX_LENGTH = 4000;
const MAX_YEARS_OF_EXPERIENCE = 50;
/** Room for the welcome flow's ten words and more of the coach's own. */
const MAX_SPECIALIZATIONS = 20;
const SPECIALIZATION_MAX_LENGTH = 60;

/**
 * The instructor-profile fields, in one sheet.
 *
 * Specializations are chips, as the profile shows them: the same field as the
 * welcome flow's "Anything else?" (type one, + or return adds it, tap a chip
 * to remove it). A word typed and not yet added goes in on Save.
 */
@Component({
  selector: 'mh-coaching-sheet',
  imports: [
    ChipInput,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonTextarea,
    IonToggle,
    SheetShell,
    SocialLinksFields,
    TranslatePipe,
  ],
  templateUrl: './coaching-sheet.html',
  styleUrl: './coaching-sheet.scss',
})
export class CoachingSheet {
  private readonly _profileService = inject(ProfileService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _accountStore = inject(AccountStore);
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);

  readonly displayName = signal('');
  readonly bio = signal('');
  readonly specializations = signal<string[]>([]);
  readonly yearsOfExperience = signal<number | null>(null);
  readonly isAcceptingClients = signal(false);
  readonly showSocialLinks = signal(false);
  readonly links = signal<Record<string, string>>({});
  readonly saving = signal(false);

  readonly displayNameMaxLength = DISPLAY_NAME_MAX_LENGTH;
  readonly bioMaxLength = BIO_MAX_LENGTH;
  readonly maxYears = MAX_YEARS_OF_EXPERIENCE;
  readonly maxSpecializations = MAX_SPECIALIZATIONS;
  readonly specializationMaxLength = SPECIALIZATION_MAX_LENGTH;

  private readonly _specializationsField = viewChild(ChipInput);

  readonly canSave = computed(() => this.displayName().trim().length > 0);

  constructor() {
    // Depends on `open()` alone — see the note in `name-sheet`.
    effect(() => {
      if (!this.open()) return;
      const profile = untracked(() => this._accountStore.instructorProfile());
      this.displayName.set(profile?.displayName ?? '');
      this.bio.set(profile?.bio ?? '');
      let specializations: string[] = [];
      if (profile && profile.specializations) {
        specializations = [...profile.specializations];
      }
      this.specializations.set(specializations);
      this.yearsOfExperience.set(profile?.yearsOfExperience ?? null);
      this.isAcceptingClients.set(profile?.isAcceptingClients ?? false);
      this.showSocialLinks.set(profile?.showSocialLinks ?? false);
      this.links.set({ ...(profile?.socialLinks ?? {}) });
    });
  }

  save(): void {
    const profile = this._accountStore.instructorProfile();
    if (!profile) {
      return;
    }
    // A specialization typed and not yet added goes in with the rest; one
    // that cannot (too long, no room) stays in the field with the line
    // saying why, and the sheet stays open.
    const field = this._specializationsField();
    if (field && !field.commit()) {
      return;
    }

    const patch = this._diff(profile);
    if (Object.keys(patch).length === 0) {
      this.open.set(false);
      void this._feedbackService.info(this._translateService.instant('toast.detail.noChanges'));
      return;
    }

    this.saving.set(true);
    this._accountStore.patchInstructor(patch as Partial<InstructorProfile>);

    this._profileService
      .updateInstructorProfile(patch)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this._accountStore.patchInstructor(updated);
          this.open.set(false);
          void this._feedbackService.success(
            this._translateService.instant('accountSheets.coaching.toast.updated'),
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this._accountStore.patchInstructor(profile);
          void this._feedbackService.error(
            error,
            this._translateService.instant('accountSheets.coaching.toast.failed'),
          );
        },
      });
  }

  /** Only the fields that actually moved — a full PATCH would rewrite the rest. */
  private _diff(profile: InstructorProfile): UpdateInstructorProfilePayload {
    const patch: UpdateInstructorProfilePayload = {};

    const displayName = this.displayName().trim();
    if (displayName !== (profile.displayName ?? '')) patch.displayName = displayName;

    const bio = this.bio().trim();
    if (bio !== (profile.bio ?? '')) patch.bio = bio;

    const specializations = this.specializations();
    if (specializations.join('|') !== (profile.specializations ?? []).join('|')) {
      patch.specializations = specializations;
    }

    const years = this.yearsOfExperience();
    if (years !== null && years !== profile.yearsOfExperience) {
      patch.yearsOfExperience = years;
    }

    if (this.isAcceptingClients() !== profile.isAcceptingClients) {
      patch.isAcceptingClients = this.isAcceptingClients();
    }

    if (this.showSocialLinks() !== profile.showSocialLinks) {
      patch.showSocialLinks = this.showSocialLinks();
    }

    const socialLinks = normalizeLinks(this.links());
    if (!sameLinks(profile.socialLinks ?? {}, socialLinks)) {
      patch.socialLinks = socialLinks;
    }

    return patch;
  }
}

function normalizeLinks(links: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(links)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    result[key] = normalizeUrl(trimmed) ?? trimmed;
  }
  return result;
}

function sameLinks(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? '') !== (b[key] ?? '')) return false;
  }
  return true;
}
