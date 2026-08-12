import { Component, model } from '@angular/core';
import { IonIcon, IonInput } from '@ionic/angular/standalone';

import { SOCIAL_PLATFORMS, SocialPlatformKey } from 'core';

import { SOCIAL_ICONS } from '../../../main/account/account.config';

/**
 * One URL field per social platform core knows about.
 *
 * Shared by the Links sheet and the coaching-profile edit sheet, which edit the
 * same `socialLinks` record from different screens. Normalisation is the
 * caller's job — this only collects what was typed.
 */
@Component({
  selector: 'mh-social-links-fields',
  imports: [IonIcon, IonInput],
  templateUrl: './social-links-fields.html',
  styleUrl: './social-links-fields.scss',
})
export class SocialLinksFields {
  readonly links = model<Record<string, string>>({});

  readonly platforms = SOCIAL_PLATFORMS;
  readonly icons = SOCIAL_ICONS;

  valueFor(key: SocialPlatformKey): string {
    return this.links()[key] ?? '';
  }

  update(key: SocialPlatformKey, value: string): void {
    this.links.update((links) => ({ ...links, [key]: value }));
  }
}
