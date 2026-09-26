import { Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  callOutline,
  calendarOutline,
  chatbubbleOutline,
  globeOutline,
  languageOutline,
  locationOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  timeOutline,
} from 'ionicons/icons';

import { PublicUserProfile } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../_shared/components/hex-avatar/hex-avatar';
import { injectOpenDirectMessage } from '../../_shared/utils/direct-message';
import { ProfileViewStore } from './profile-view.store';

/**
 * Someone else's profile, reached by tapping a name.
 *
 * What appears is the server's decision, not this screen's: every field
 * arrives already masked for the viewer's tier, so an absent value means
 * "not shared with you" and the row simply does not render. The one thing
 * worth saying out loud is when *nothing* was shared, because an avatar over
 * blank space reads as a broken page rather than a private one.
 */
@Component({
  selector: 'mh-profile-view',
  imports: [
    EmptyState,
    HexAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './profile-view.html',
  styleUrl: './profile-view.scss',
  providers: [ProfileViewStore],
})
export class ProfileView implements ViewWillEnter {
  readonly store = inject(ProfileViewStore);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _openDirectMessage = injectOpenDirectMessage();

  readonly skeletonRows = [1, 2, 3];

  readonly fullName = computed(() => {
    const p = this.store.profile();
    if (!p) return '';
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    // A profile that hides both names still has a handle to go by.
    return name || `@${p.handle}`;
  });

  readonly location = computed(() => {
    const p = this.store.profile();
    if (!p?.city) return '';
    return p.countryCode ? `${p.city}, ${p.countryCode}` : p.city;
  });

  readonly memberSince = computed(() => {
    const p = this.store.profile();
    if (!p?.memberSince) return '';
    return new Date(p.memberSince).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  });

  /**
   * "Only they can see the rest" — shown when the privacy mask left nothing
   * but a name. Without it the screen looks like it failed to load.
   */
  readonly showPrivateNote = computed(
    () => !!this.store.profile() && !this.store.hasDetails(),
  );

  /** No point offering to message yourself. */
  readonly canMessage = computed(() => this.store.profile()?.audience !== 'OWNER');

  constructor() {
    addIcons({
      arrowBackOutline,
      callOutline,
      calendarOutline,
      chatbubbleOutline,
      globeOutline,
      languageOutline,
      locationOutline,
      lockClosedOutline,
      mailOutline,
      personOutline,
      timeOutline,
    });

    // Via the param stream rather than a snapshot: Ionic reuses this page, so
    // opening a second profile has to re-init rather than keep showing the
    // first. The store ignores a repeat of the handle it already holds.
    this._route.paramMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const handle = params.get('handle');
      if (handle) this.store.init(handle);
    });
  }

  ionViewWillEnter(): void {
    // Nothing to refetch: a profile does not change while you look away, and
    // the store already loaded it from the route.
  }

  message(profile: PublicUserProfile): void {
    this._openDirectMessage({
      id: profile.userId,
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
    });
  }

  retry(): void {
    this.store.retry();
  }
}
