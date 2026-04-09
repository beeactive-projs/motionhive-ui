import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  MyProfile,
  GenderLabels,
  FitnessLevelLabels,
  UserRoles,
  TagSeverity,
} from 'core';
import { EditPersonalInfo } from './dialogs/edit-personal-info/edit-personal-info';
import { EditFitnessProfile } from './dialogs/edit-fitness-profile/edit-fitness-profile';
import { EditInstructorProfile } from './dialogs/edit-instructor-profile/edit-instructor-profile';
import { BecomeInstructor } from '../user/dialogs/become-instructor/become-instructor';

@Component({
  selector: 'mh-profile',
  imports: [
    DatePipe,
    CardModule,
    AvatarModule,
    TagModule,
    DividerModule,
    ButtonModule,
    SkeletonModule,
    ToastModule,
    EditPersonalInfo,
    EditFitnessProfile,
    EditInstructorProfile,
    BecomeInstructor,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  private readonly _profileService = inject(ProfileService);
  private readonly _messageService = inject(MessageService);

  readonly profile = signal<MyProfile | null>(null);
  readonly loading = signal(true);
  readonly showEditPersonalInfo = signal(false);
  readonly showEditFitnessProfile = signal(false);
  readonly showEditInstructor = signal(false);
  readonly becomeInstructorVisible = signal(false);

  readonly fullName = computed(() => {
    const p = this.profile();
    return p ? `${p.account.firstName} ${p.account.lastName}` : '';
  });

  readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.account.firstName.charAt(0)}${p.account.lastName.charAt(0)}`.toUpperCase();
  });

  readonly isInstructor = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return p.roles.includes(UserRoles.Instructor) || p.roles.includes('ORGANIZER');
  });

  readonly hasInstructorProfile = computed(() => this.profile()?.instructorProfile != null);

  readonly formattedGender = computed(() => {
    const gender = this.profile()?.fitnessProfile?.gender;
    return gender ? GenderLabels[gender] : null;
  });

  readonly formattedFitnessLevel = computed(() => {
    const level = this.profile()?.fitnessProfile?.fitnessLevel;
    return level ? FitnessLevelLabels[level] : null;
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this._profileService.getMyProfile().subscribe({
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

  roleSeverity(role: string): TagSeverity {
    switch (role) {
      case UserRoles.SuperAdmin:
        return TagSeverity.Danger;
      case UserRoles.Admin:
        return TagSeverity.Warn;
      case UserRoles.Instructor:
        return TagSeverity.Info;
      case UserRoles.Support:
        return TagSeverity.Contrast;
      default:
        return TagSeverity.Secondary;
    }
  }
}
