import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { countryNameFromCode } from 'core';
import type { PublicUserProfile, ViewerMode } from 'core';
import { ProfileFactRow } from '../../../../_shared/components/profile-fact-row/profile-fact-row';

/**
 * Long-scroll content column for non-instructor `/@:handle` views.
 *
 * Owns *only* the left column — the shell composes the side panel
 * alongside this component so both instructor and user modes use the
 * same 2-column shell layout. Future user-mode sections (mission,
 * journey, achievements, …) land in here as their endpoints ship in
 * Phase B4+.
 */
@Component({
  selector: 'mh-user-profile',
  imports: [DatePipe, Card, Divider, ProfileFactRow],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfile {
  readonly profile = input.required<PublicUserProfile>();
  readonly viewerMode = input.required<ViewerMode>();

  readonly locationDisplay = computed<string | null>(() => {
    const u = this.profile();
    const parts = [u.city, countryNameFromCode(u.countryCode)].filter(
      (x): x is string => !!x,
    );
    return parts.length ? parts.join(', ') : null;
  });

  readonly hasPersonalDetails = computed(() => {
    const u = this.profile();
    return !!(u.firstName || u.lastName || u.email || u.phone || u.city || u.countryCode);
  });
}
