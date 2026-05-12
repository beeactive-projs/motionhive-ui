import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  MyProfile,
  PrivacyControlledField,
  ProfilePrivacy,
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
