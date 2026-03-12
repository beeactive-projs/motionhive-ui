import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  AuthStore,
  FullProfileResponse,
  UpdateFullProfilePayload,
  Gender,
  FitnessLevel,
} from 'core';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info' | 'contrast' | null | undefined;

interface EditForm {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  fitnessLevel: FitnessLevel | null;
  goals: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  displayName: string;
  bio: string;
  specializations: string;
  yearsOfExperience: number | null;
  isAcceptingClients: boolean;
  locationCity: string;
  locationCountry: string;
}

@Component({
  selector: 'bee-profile',
  imports: [
    DatePipe,
    FormsModule,
    CardModule,
    AvatarModule,
    TagModule,
    DividerModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    ToastModule,
    TabsModule,
    ToggleSwitchModule,
    SkeletonModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messageService = inject(MessageService);

  profile = signal<FullProfileResponse | null>(null);
  loading = signal(true);
  saving = signal(false);
  showEditDialog = signal(false);
  activeTab = signal(0);

  // Edit form state
  editForm = signal<EditForm>({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: null,
    heightCm: null,
    weightKg: null,
    fitnessLevel: null,
    goals: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    displayName: '',
    bio: '',
    specializations: '',
    yearsOfExperience: null,
    isAcceptingClients: false,
    locationCity: '',
    locationCountry: '',
  });

  // Options for select dropdowns
  readonly genderOptions = [
    { label: 'Male', value: 'MALE' as Gender },
    { label: 'Female', value: 'FEMALE' as Gender },
    { label: 'Other', value: 'OTHER' as Gender },
    { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' as Gender },
  ];

  readonly fitnessOptions = [
    { label: 'Beginner', value: 'BEGINNER' as FitnessLevel },
    { label: 'Intermediate', value: 'INTERMEDIATE' as FitnessLevel },
    { label: 'Advanced', value: 'ADVANCED' as FitnessLevel },
  ];

  // Computed values
  readonly fullName = computed(() => {
    const p = this.profile();
    return p ? `${p.user.firstName} ${p.user.lastName}` : '';
  });

  readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.user.firstName.charAt(0)}${p.user.lastName.charAt(0)}`.toUpperCase();
  });

  readonly isInstructor = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return p.roles.includes('INSTRUCTOR') || p.roles.includes('ORGANIZER');
  });

  readonly hasInstructorProfile = computed(() => {
    return this.profile()?.instructorProfile != null;
  });

  readonly formattedGender = computed(() => {
    const gender = this.profile()?.userProfile?.gender;
    if (!gender) return null;
    const map: Record<Gender, string> = {
      MALE: 'Male',
      FEMALE: 'Female',
      OTHER: 'Other',
      PREFER_NOT_TO_SAY: 'Prefer not to say',
    };
    return map[gender];
  });

  readonly formattedFitnessLevel = computed(() => {
    const level = this.profile()?.userProfile?.fitnessLevel;
    if (!level) return null;
    const map: Record<FitnessLevel, string> = {
      BEGINNER: 'Beginner',
      INTERMEDIATE: 'Intermediate',
      ADVANCED: 'Advanced',
    };
    return map[level];
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this._profileService.getFullProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load profile data',
        });
      },
    });
  }

  openEditDialog(): void {
    const p = this.profile();
    if (!p) return;

    this.editForm.set({
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      phone: p.user.phone || '',
      dateOfBirth: p.userProfile?.dateOfBirth || '',
      gender: p.userProfile?.gender || null,
      heightCm: p.userProfile?.heightCm || null,
      weightKg: p.userProfile?.weightKg || null,
      fitnessLevel: p.userProfile?.fitnessLevel || null,
      goals: p.userProfile?.goals?.join(', ') || '',
      emergencyContactName: p.userProfile?.emergencyContactName || '',
      emergencyContactPhone: p.userProfile?.emergencyContactPhone || '',
      displayName: p.instructorProfile?.displayName || '',
      bio: p.instructorProfile?.bio || '',
      specializations: p.instructorProfile?.specializations?.join(', ') || '',
      yearsOfExperience: p.instructorProfile?.yearsOfExperience || null,
      isAcceptingClients: p.instructorProfile?.isAcceptingClients || false,
      locationCity: p.instructorProfile?.locationCity || '',
      locationCountry: p.instructorProfile?.locationCountry || '',
    });

    this.activeTab.set(0);
    this.showEditDialog.set(true);
  }

  updateFormField(field: keyof EditForm, value: unknown): void {
    this.editForm.update((form) => ({ ...form, [field]: value }));
  }

  saveProfile(): void {
    const p = this.profile();
    if (!p) return;

    const form = this.editForm();
    const payload: UpdateFullProfilePayload = {};

    // Build user payload (only changed fields)
    const userChanges: UpdateFullProfilePayload['user'] = {};
    if (form.firstName !== p.user.firstName) userChanges.firstName = form.firstName;
    if (form.lastName !== p.user.lastName) userChanges.lastName = form.lastName;
    if (form.phone !== (p.user.phone || '')) userChanges.phone = form.phone;
    if (Object.keys(userChanges).length > 0) payload.user = userChanges;

    // Build userProfile payload (only changed fields)
    const profileChanges: NonNullable<UpdateFullProfilePayload['userProfile']> = {};
    if (form.dateOfBirth !== (p.userProfile?.dateOfBirth || '')) {
      profileChanges.dateOfBirth = form.dateOfBirth || undefined;
    }
    if (form.gender !== (p.userProfile?.gender || null)) {
      profileChanges.gender = form.gender || undefined;
    }
    if (form.heightCm !== (p.userProfile?.heightCm || null)) {
      profileChanges.heightCm = form.heightCm || undefined;
    }
    if (form.weightKg !== (p.userProfile?.weightKg || null)) {
      profileChanges.weightKg = form.weightKg || undefined;
    }
    if (form.fitnessLevel !== (p.userProfile?.fitnessLevel || null)) {
      profileChanges.fitnessLevel = form.fitnessLevel || undefined;
    }
    const newGoals = form.goals
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    const oldGoals = p.userProfile?.goals || [];
    if (JSON.stringify(newGoals) !== JSON.stringify(oldGoals)) {
      profileChanges.goals = newGoals;
    }
    if (form.emergencyContactName !== (p.userProfile?.emergencyContactName || '')) {
      profileChanges.emergencyContactName = form.emergencyContactName || undefined;
    }
    if (form.emergencyContactPhone !== (p.userProfile?.emergencyContactPhone || '')) {
      profileChanges.emergencyContactPhone = form.emergencyContactPhone || undefined;
    }
    if (Object.keys(profileChanges).length > 0) payload.userProfile = profileChanges;

    // Build instructor payload (only if instructor, only changed fields)
    if (this.isInstructor() && this.hasInstructorProfile()) {
      const instrChanges: NonNullable<UpdateFullProfilePayload['instructor']> = {};
      if (form.displayName !== (p.instructorProfile?.displayName || '')) {
        instrChanges.displayName = form.displayName || undefined;
      }
      if (form.bio !== (p.instructorProfile?.bio || '')) {
        instrChanges.bio = form.bio || undefined;
      }
      const newSpecs = form.specializations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const oldSpecs = p.instructorProfile?.specializations || [];
      if (JSON.stringify(newSpecs) !== JSON.stringify(oldSpecs)) {
        instrChanges.specializations = newSpecs;
      }
      if (form.yearsOfExperience !== (p.instructorProfile?.yearsOfExperience || null)) {
        instrChanges.yearsOfExperience = form.yearsOfExperience || undefined;
      }
      if (form.isAcceptingClients !== (p.instructorProfile?.isAcceptingClients || false)) {
        instrChanges.isAcceptingClients = form.isAcceptingClients;
      }
      if (form.locationCity !== (p.instructorProfile?.locationCity || '')) {
        instrChanges.locationCity = form.locationCity || undefined;
      }
      if (form.locationCountry !== (p.instructorProfile?.locationCountry || '')) {
        instrChanges.locationCountry = form.locationCountry || undefined;
      }
      if (Object.keys(instrChanges).length > 0) payload.instructor = instrChanges;
    }

    // Check if anything changed
    if (!payload.user && !payload.userProfile && !payload.instructor) {
      this.showEditDialog.set(false);
      this._messageService.add({
        severity: 'info',
        summary: 'No Changes',
        detail: 'No changes were made to your profile',
      });
      return;
    }

    this.saving.set(true);
    this._profileService.updateFullProfile(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showEditDialog.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Profile Updated',
          detail: 'Your profile has been updated successfully',
        });
        this.loadProfile();
      },
      error: (err) => {
        this.saving.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to update profile',
        });
      },
    });
  }

  roleSeverity(role: string): TagSeverity {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'danger';
      case 'ADMIN':
        return 'warn';
      case 'INSTRUCTOR':
      case 'ORGANIZER':
        return 'info';
      case 'SUPPORT':
        return 'contrast';
      default:
        return 'secondary';
    }
  }
}
