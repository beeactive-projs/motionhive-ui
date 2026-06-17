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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MyProfile,
  ProfileService,
  UpdateInstructorProfilePayload,
  normalizeUrl,
  showApiError,
} from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
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

const SOCIAL_PLATFORMS: readonly {
  key: SocialKey;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  { key: 'instagram', label: 'Instagram', icon: 'pi pi-instagram', placeholder: 'instagram.com/yourhandle' },
  { key: 'youtube', label: 'YouTube', icon: 'pi pi-youtube', placeholder: 'youtube.com/@yourchannel' },
  { key: 'tiktok', label: 'TikTok', icon: 'pi pi-tiktok', placeholder: 'tiktok.com/@yourhandle' },
  { key: 'facebook', label: 'Facebook', icon: 'pi pi-facebook', placeholder: 'facebook.com/yourpage' },
  { key: 'twitter', label: 'X / Twitter', icon: 'pi pi-twitter', placeholder: 'x.com/yourhandle' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'pi pi-linkedin', placeholder: 'linkedin.com/in/yourhandle' },
  { key: 'website', label: 'Website', icon: 'pi pi-globe', placeholder: 'yourwebsite.com' },
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
    Button,
    Dialog,
    InputText,
    InputNumber,
    Message,
    TextareaModule,
    ToggleSwitch,
  ],
  templateUrl: './edit-instructor-profile.html',
  styleUrl: './edit-instructor-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditInstructorProfile {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);
  private readonly _formBuilder = inject(FormBuilder);

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
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    if (errors['required']) return 'This field is required.';
    if (errors['url']) return 'Enter a valid URL (e.g. https://example.com).';
    if (errors['min']) return `Must be at least ${errors['min'].min}.`;
    if (errors['max']) return `Must be at most ${errors['max'].max}.`;
    if (errors['maxlength']) {
      return `Must be ${errors['maxlength'].requiredLength} characters or fewer.`;
    }
    return 'Invalid value.';
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
          detail: 'Coaching profile updated successfully.',
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
