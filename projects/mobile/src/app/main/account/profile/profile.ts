import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';

import { SOCIAL_PLATFORMS } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SettingsRow } from '../../../_shared/components/settings-row/settings-row';
import { birthdayLabel, genderLabel } from '../../../_shared/config/about-you.config';
import { ViewPhotoDirective } from '../../../_shared/directives/view-photo.directive';
import { ACCOUNT_ICONS } from '../account.config';
import { AccountStore } from '../account.store';
import { AboutSheet } from '../_sheets/about-sheet/about-sheet';
import { BirthdaySheet } from '../_sheets/birthday-sheet/birthday-sheet';
import { GenderSheet } from '../_sheets/gender-sheet/gender-sheet';
import { HandleSheet } from '../_sheets/handle-sheet/handle-sheet';
import { LinksSheet } from '../_sheets/links-sheet/links-sheet';
import { LocationSheet } from '../_sheets/location-sheet/location-sheet';
import { NameSheet } from '../_sheets/name-sheet/name-sheet';
import { PhoneSheet } from '../_sheets/phone-sheet/phone-sheet';
import { PhotoSheet } from '../_sheets/photo-sheet/photo-sheet';

/**
 * Identity, one row per field, each opening its own sheet. Birthday and
 * gender are on the signed-in user rather than `/profile/me`; the store
 * reads them there.
 *
 * About and Links are backed by the instructor profile (`bio`, `socialLinks`),
 * which a trainee account does not have — so those two rows only appear once
 * there is one. Saving them for a trainee would mean creating an instructor
 * profile, which changes their role.
 */
@Component({
  selector: 'mh-profile',
  imports: [
    AboutSheet,
    BirthdaySheet,
    EmptyState,
    GenderSheet,
    HandleSheet,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    LinksSheet,
    LocationSheet,
    NameSheet,
    PhoneSheet,
    PhotoSheet,
    SettingsRow,
    TranslatePipe,
    ViewPhotoDirective,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  readonly store = inject(AccountStore);

  readonly photoSheetOpen = signal(false);
  readonly nameSheetOpen = signal(false);
  readonly aboutSheetOpen = signal(false);
  readonly handleSheetOpen = signal(false);
  readonly phoneSheetOpen = signal(false);
  readonly locationSheetOpen = signal(false);
  readonly linksSheetOpen = signal(false);
  readonly birthdaySheetOpen = signal(false);
  readonly genderSheetOpen = signal(false);

  readonly account = this.store.account;
  readonly isInstructor = this.store.isInstructor;

  readonly handleValue = computed(() => {
    const handle = this.account()?.handle;
    return handle ? `@${handle}` : null;
  });

  readonly locationValue = computed(() => {
    const account = this.account();
    if (!account) return null;
    return [account.city, account.countryCode].filter(Boolean).join(', ') || null;
  });

  readonly aboutValue = computed(() => this.store.instructorProfile()?.bio || null);

  /** "14 March 1992"; the row says "Not provided" while there is none. */
  readonly birthdayValue = computed(() => birthdayLabel(this.store.birthDate()));

  readonly genderValue = computed(() => {
    const label = genderLabel(this.store.gender());
    if (label === '') {
      return null;
    }
    return label;
  });

  /** "Instagram, YouTube" — the platforms that actually have a link. */
  readonly linksValue = computed(() => {
    const links = this.store.instructorProfile()?.socialLinks ?? {};
    const labels = SOCIAL_PLATFORMS.filter((platform) => !!links[platform.key]).map(
      (platform) => platform.label,
    );
    return labels.length ? labels.join(', ') : null;
  });

  constructor() {
    addIcons(ACCOUNT_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }
}
