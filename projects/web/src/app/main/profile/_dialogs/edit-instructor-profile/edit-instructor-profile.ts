import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  MyProfile,
  ProfileService,
  UpdateInstructorProfilePayload,
  normalizeUrl,
  showApiError,
  translate,
  validationMessage,
} from 'core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';

type SocialKey =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'website';

type FormField =
  | 'displayName'
  | 'bio'
  | 'specializations'
  | 'yearsOfExperience'
  | 'isAcceptingClients'
  | 'showSocialLinks'
  | SocialKey;

interface SocialPlatform {
  readonly key: SocialKey;
  readonly label: string;
  readonly icon: string;
  readonly placeholder: string;
}

/**
 * Brand names stay as-is; the generic "Website" label and the example
 * URLs are translated. Getters, because this is a module constant
 * evaluated before the language file loads.
 */
function socialPlatform(key: SocialKey, icon: string, brand?: string): SocialPlatform {
  return {
    key,
    icon,
    get label() {
      return brand ?? translate('form.label.website');
    },
    get placeholder() {
      return translate(`form.placeholder.social.${key}`);
    },
  };
}

const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  socialPlatform('instagram', 'pi pi-instagram', 'Instagram'),
  socialPlatform('youtube', 'pi pi-youtube', 'YouTube'),
  socialPlatform('tiktok', 'pi pi-tiktok', 'TikTok'),
  socialPlatform('facebook', 'pi pi-facebook', 'Facebook'),
  socialPlatform('twitter', 'pi pi-twitter', 'X / Twitter'),
  socialPlatform('linkedin', 'pi pi-linkedin', 'LinkedIn'),
  socialPlatform('website', 'pi pi-globe'),
];

function optionalUrl(control: AbstractControl): ValidationErrors | null {
  const raw = (control.value ?? '').toString().trim();
  if (!raw) return null;
  return normalizeUrl(raw) ? null : { url: true };
}

@Component({
  selector: 'mh-edit-instructor-profile',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Dialog,
    InputText,
    InputNumber,
    Message,
    TextareaModule,
    ToggleSwitch,
    TranslatePipe,
  ],
  templateUrl: './edit-instructor-profile.html',
  styleUrl: './edit-instructor-profile.scss',
})
export class EditInstructorProfile {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);
  readonly profile = input.required<MyProfile>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly socialPlatforms = SOCIAL_PLATFORMS;

  readonly form = this._formBuilder.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    bio: ['', [Validators.maxLength(4000)]],
    specializations: [''],
    yearsOfExperience: [
      null as number | null,
      [Validators.min(0), Validators.max(50)],
    ],
    isAcceptingClients: [false],
    showSocialLinks: [false],
    instagram: ['', [optionalUrl, Validators.maxLength(500)]],
    youtube: ['', [optionalUrl, Validators.maxLength(500)]],
    tiktok: ['', [optionalUrl, Validators.maxLength(500)]],
    facebook: ['', [optionalUrl, Validators.maxLength(500)]],
    twitter: ['', [optionalUrl, Validators.maxLength(500)]],
    linkedin: ['', [optionalUrl, Validators.maxLength(500)]],
    website: ['', [optionalUrl, Validators.maxLength(500)]],
  });

  private readonly _formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly canSubmit = computed(
    () => !this.saving() && this._formStatus() === 'VALID',
  );

  private readonly _initEffect = effect(() => {
    if (this.visible()) {
      const ip = this.profile().instructorProfile;
      const existing = ip?.socialLinks ?? {};
      this.form.reset({
        displayName: ip?.displayName ?? '',
        bio: ip?.bio ?? '',
        specializations: ip?.specializations?.join(', ') ?? '',
        yearsOfExperience: ip?.yearsOfExperience ?? null,
        isAcceptingClients: ip?.isAcceptingClients ?? false,
        showSocialLinks: ip?.showSocialLinks ?? false,
        instagram: existing['instagram'] ?? '',
        youtube: existing['youtube'] ?? '',
        tiktok: existing['tiktok'] ?? '',
        facebook: existing['facebook'] ?? '',
        twitter: existing['twitter'] ?? '',
        linkedin: existing['linkedin'] ?? '',
        website: existing['website'] ?? '',
      });
    }
  });

  isFieldInvalid(field: FormField): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getFieldError(field: FormField): string {
    return validationMessage(this.form.get(field)?.errors);
  }

  save(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const ip = this.profile().instructorProfile;
    const v = this.form.getRawValue();
    const instrChanges: UpdateInstructorProfilePayload = {};

    const displayName = (v.displayName ?? '').trim();
    if (displayName !== (ip?.displayName ?? '')) instrChanges.displayName = displayName;

    const bio = (v.bio ?? '').trim();
    if (bio !== (ip?.bio ?? '')) instrChanges.bio = bio;

    const newSpecs = (v.specializations ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (JSON.stringify(newSpecs) !== JSON.stringify(ip?.specializations ?? []))
      instrChanges.specializations = newSpecs;

    if (v.yearsOfExperience !== (ip?.yearsOfExperience ?? null))
      instrChanges.yearsOfExperience = v.yearsOfExperience ?? undefined;

    if (v.isAcceptingClients !== (ip?.isAcceptingClients ?? false))
      instrChanges.isAcceptingClients = !!v.isAcceptingClients;

    const existingLinks = ip?.socialLinks ?? {};
    const nextLinks: Record<string, string> = {};
    for (const { key } of SOCIAL_PLATFORMS) {
      const raw = ((v[key] as string) ?? '').trim();
      if (!raw) continue;
      const normalized = normalizeUrl(raw);
      if (normalized) nextLinks[key] = normalized;
    }
    if (!shallowEqualRecord(nextLinks, existingLinks))
      instrChanges.socialLinks = nextLinks;

    if (v.showSocialLinks !== (ip?.showSocialLinks ?? false))
      instrChanges.showSocialLinks = !!v.showSocialLinks;

    if (!Object.keys(instrChanges).length) {
      this.visible.set(false);
      this._messageService.add({
        severity: 'info',
        summary: this._translateService.instant('toast.detail.noChanges'),
        detail: this._translateService.instant('profile.toast.noChanges'),
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
          summary: this._translateService.instant('profile.toast.profileUpdated'),
          detail: this._translateService.instant('profile.editCoaching.toast.updated'),
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('profile.editCoaching.toast.failed'),
          err,
        );
      },
    });
  }
}

function shallowEqualRecord(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
