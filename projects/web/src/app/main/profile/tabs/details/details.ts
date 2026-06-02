import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  MyProfile,
  PrivacyControlledField,
  ProfilePrivacy,
  UserRoles,
} from 'core';
import { IntroCard } from './_cards/intro-card/intro-card';
import { PersonalDetailsCard } from './_cards/personal-details-card/personal-details-card';
import { CoachingCard } from './_cards/coaching-card/coaching-card';
import { BecomeInstructorCard } from './_cards/become-instructor-card/become-instructor-card';
import { ExerciseCatalogCard } from './_cards/exercise-catalog-card/exercise-catalog-card';

/**
 * Thin shell for the Profile details tab — composes the four
 * Facebook-style cards. Identity-level state (avatar, name, handle,
 * verification, action buttons) lives in `mh-profile-hero-card` on
 * the parent page; the Details tab only renders facts.
 *
 * Privacy patching is owned by the parent page so the optimistic
 * override survives tab switches; each card emits the
 * `(field, level)` pair and the page handles the rest.
 */
@Component({
  selector: 'mh-profile-details',
  imports: [
    IntroCard,
    PersonalDetailsCard,
    CoachingCard,
    BecomeInstructorCard,
    ExerciseCatalogCard,
  ],
  templateUrl: './details.html',
  styleUrl: './details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Details {
  readonly profile = input.required<MyProfile>();
  readonly refresh = output<void>();
  readonly editPersonalInfo = output<void>();
  readonly privacyChange = output<{
    field: PrivacyControlledField;
    level: ProfilePrivacy;
  }>();

  readonly isInstructor = computed(() =>
    this.profile().roles.includes(UserRoles.Instructor),
  );

  readonly hasInstructorProfile = computed(
    () => this.profile().instructorProfile != null,
  );
}
