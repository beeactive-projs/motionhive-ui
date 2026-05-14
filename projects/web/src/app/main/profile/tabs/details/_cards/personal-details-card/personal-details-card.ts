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
  countryNameFromCode,
  resolveFieldPrivacy,
} from 'core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { ProfileFactRow } from '../../../../../../_shared/components/profile-fact-row/profile-fact-row';

/**
 * "Personal details" card — first/last/email/phone with per-row
 * privacy choosers. The pencil button in the header opens the
 * existing `mh-edit-personal-info` dialog (owned by the page) via the
 * `edit` output.
 */
@Component({
  selector: 'mh-personal-details-card',
  imports: [Card, Divider, Button, TooltipModule, ProfileFactRow],
  templateUrl: './personal-details-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDetailsCard {
  readonly profile = input.required<MyProfile>();
  readonly edit = output<void>();
  readonly privacyChange = output<{
    field: PrivacyControlledField;
    level: ProfilePrivacy;
  }>();

  readonly LockedPublic: ProfilePrivacy = ProfilePrivacy.Public;

  readonly locationDisplay = computed<string | null>(() => {
    const a = this.profile().account;
    const parts = [a.city, countryNameFromCode(a.countryCode)].filter(
      (x): x is string => !!x,
    );
    return parts.length ? parts.join(', ') : null;
  });

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
