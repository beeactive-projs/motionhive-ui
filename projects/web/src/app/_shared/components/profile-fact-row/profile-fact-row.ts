import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import type { PrivacyControlledField, ProfilePrivacy } from 'core';
import { PrivacyChooser } from '../privacy-chooser/privacy-chooser';

/**
 * Tiny presentational row used inside the Facebook-style profile
 * cards. Layout is:
 *
 *   [ icon ]  Label                                [ privacy chip ]
 *             Value (or muted placeholder)
 *
 * Rules:
 * - When `value` is null we render `placeholder` muted (defaults to
 *   "Not set").
 * - When `privacyLevel` or `privacyField` is omitted no chooser is
 *   rendered — used for purely informational rows (e.g. "Member since"
 *   is shown via the locked variant, not via the absence of inputs).
 */
@Component({
  selector: 'mh-profile-fact-row',
  imports: [TooltipModule, PrivacyChooser],
  templateUrl: './profile-fact-row.html',
  styleUrl: './profile-fact-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFactRow {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input<string | null | undefined>(null);
  readonly placeholder = input<string>('Not set');

  readonly privacyField = input<PrivacyControlledField | null>(null);
  readonly privacyLevel = input<ProfilePrivacy | null>(null);
  readonly lockedPrivacy = input<boolean>(false);
  readonly lockedTooltip = input<string | undefined>(undefined);

  readonly privacyChange = output<ProfilePrivacy>();

  readonly hasValue = computed(() => {
    const v = this.value();
    return typeof v === 'string' && v.length > 0;
  });

  readonly hasChooser = computed(() => this.privacyLevel() !== null);
}
