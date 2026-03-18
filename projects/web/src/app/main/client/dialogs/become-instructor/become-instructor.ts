import { Component, ChangeDetectionStrategy, model, inject, signal } from '@angular/core';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageModule } from 'primeng/message';
import { StepperModule } from 'primeng/stepper';
import { ProfileService, TokenService, CreateInstructorProfilePayload } from 'core';

@Component({
  selector: 'bee-become-instructor',
  imports: [
    DialogModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    AutoCompleteModule,
    MessageModule,
    StepperModule,
    ToggleSwitchModule,
    ReactiveFormsModule,
  ],
  templateUrl: './become-instructor.html',
  styleUrl: './become-instructor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BecomeInstructor {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _profileService = inject(ProfileService);
  private readonly _tokenService = inject(TokenService);
  private readonly _router = inject(Router);

  readonly visible = model(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly activeStep = signal(1);
  readonly currentYear = new Date().getFullYear();
  private readonly _allSpecializations = [
    'HIIT', 'Yoga', 'Pilates', 'Strength Training', 'Cardio', 'CrossFit',
    'Bodybuilding', 'Calisthenics', 'Cycling', 'Running', 'Swimming',
    'Boxing', 'Kickboxing', 'Martial Arts', 'Stretching & Flexibility',
    'Functional Training', 'Weight Loss', 'Nutrition Coaching',
    'Rehabilitation', 'Senior Fitness', 'Pre/Postnatal Fitness',
    'Sports Performance', 'Mobility & Stability', 'Mindfulness',
  ];

  readonly specializationSuggestions = signal<string[]>([]);

  private _getDefaultDisplayName(): string {
    const user = this._tokenService.getUser();
    return user ? `${user.firstName} ${user.lastName}` : '';
  }

  filterSpecializations(event: { query: string }): void {
    const q = event.query.toLowerCase();
    const filtered = this._allSpecializations.filter((s) =>
      s.toLowerCase().includes(q),
    );
    this.specializationSuggestions.set(filtered.length ? filtered : [event.query]);
  }

  readonly form = this._formBuilder.group({
    displayName: [this._getDefaultDisplayName(), Validators.required],
    bio: [''],
    specializations: [[] as string[]],
    yearsOfExperience: [null as number | null],
    isAcceptingClients: [true],
    locationCity: [''],
    locationCountry: [''],
    profileVisibility: ['public', Validators.required],
    showEmail: [false],
    showPhone: [false],
    showSocialLinks: [false],
    socialLinks: this._formBuilder.group({
      instagram: [''],
      facebook: [''],
      youtube: [''],
      linkedin: [''],
    }),
    certifications: this._formBuilder.array<FormGroup>([]),
  });

  get certifications(): FormArray {
    return this.form.get('certifications') as FormArray;
  }

  addCertification(): void {
    this.certifications.push(
      this._formBuilder.group({
        name: ['', Validators.required],
        issuer: ['', Validators.required],
        year: [
          this.currentYear,
          [Validators.required, Validators.min(1900), Validators.max(this.currentYear)],
        ],
      }),
    );
  }

  removeCertification(index: number): void {
    this.certifications.removeAt(index);
  }

  submit(): void {
    if (this.form.invalid) return;

    const v = this.form.value;

    const socialLinksRaw = v.socialLinks ?? {};
    const socialLinks: Record<string, string> = {};
    for (const [key, val] of Object.entries(socialLinksRaw)) {
      if (val) socialLinks[key] = val as string;
    }

    const payload: CreateInstructorProfilePayload = {
      displayName: v.displayName!,
      isPublic: v.profileVisibility === 'public',
      bio: v.bio || undefined,
      specializations: v.specializations?.length ? v.specializations : undefined,
      certifications: this.certifications.length ? this.certifications.value : undefined,
      yearsOfExperience: v.yearsOfExperience ?? undefined,
      isAcceptingClients: v.isAcceptingClients ?? undefined,
      showEmail: v.showEmail ?? undefined,
      showPhone: v.showPhone ?? undefined,
      showSocialLinks: v.showSocialLinks ?? undefined,
      socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
      locationCity: v.locationCity || undefined,
      locationCountry: v.locationCountry || undefined,
    };

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._profileService.createInstructorProfile(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.visible.set(false);
        this._router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Something went wrong. Please try again.');
      },
    });
  }

  cancel(): void {
    this.visible.set(false);
    this.activeStep.set(1);
    this.form.reset({ profileVisibility: 'public', isAcceptingClients: true });
    while (this.certifications.length) {
      this.certifications.removeAt(0);
    }
    this.errorMessage.set(null);
  }
}
