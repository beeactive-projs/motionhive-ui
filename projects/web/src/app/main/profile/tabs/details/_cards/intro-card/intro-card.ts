import { DatePipe } from '@angular/common';
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
  resolveFieldPrivacy,
} from 'core';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { ProfileFactRow } from '../../../../../../_shared/components/profile-fact-row/profile-fact-row';

/**
 * Compact "Intro" card — top of the Details tab, lists the
 * always-relevant location/language/timezone/member-since facts with
 * per-row privacy choosers (member-since is locked because every
 * account exposes that one publicly).
 */
@Component({
  selector: 'mh-intro-card',
  imports: [DatePipe, Card, Divider, ProfileFactRow],
  templateUrl: './intro-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroCard {
  readonly profile = input.required<MyProfile>();
  readonly privacyChange = output<{
    field: PrivacyControlledField;
    level: ProfilePrivacy;
  }>();

  readonly memberSince = computed(() => this.profile().account.createdAt);

  /** Fixed level for fields whose audience is system-controlled. */
  readonly LockedPublic: ProfilePrivacy = ProfilePrivacy.Public;

  privacyLevel(field: PrivacyControlledField): ProfilePrivacy {
    return resolveFieldPrivacy(
      this.profile().account.privacySettings,
      field,
    );
  }

  emit(field: PrivacyControlledField, level: ProfilePrivacy): void {
    this.privacyChange.emit({ field, level });
  }
}
