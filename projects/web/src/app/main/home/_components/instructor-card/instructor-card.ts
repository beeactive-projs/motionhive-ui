import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { InstructorSearchResult } from 'core';
import { Hex, HexTone } from '../../../../_shared/components/hex/hex';

/**
 * Compact instructor card used in the "Meet every instructor" carousel
 * on the home page. Hex avatar with initials + name + role + tag chips
 * + a "View profile" CTA that navigates to `/@<handle>`.
 *
 * Falls back to a disabled button when the instructor has no handle —
 * still a rare edge for legacy profiles created before migration 038.
 */
@Component({
  selector: 'mh-instructor-card',
  imports: [RouterLink, ButtonDirective, Card, TagModule, Hex, TranslatePipe],
  templateUrl: './instructor-card.html',
  styleUrl: './instructor-card.scss',
})
export class InstructorCard {
  private readonly _translateService = inject(TranslateService);

  readonly instructor = input.required<InstructorSearchResult>();
  /** Picks a hex tone from the instructor id so cards visually vary across the grid. */
  readonly tone = input<HexTone | null>(null);

  readonly initials = computed(() => {
    const i = this.instructor();
    return `${(i.firstName ?? '').charAt(0)}${(i.lastName ?? '').charAt(0)}`.toUpperCase() || '?';
  });

  readonly displayName = computed(() => {
    const i = this.instructor();
    return (
      i.displayName?.trim() ||
      `${i.firstName ?? ''} ${i.lastName ?? ''}`.trim() ||
      this._translateService.instant('enum.userRole.INSTRUCTOR')
    );
  });

  readonly role = computed(() => {
    const i = this.instructor();
    const yrs = i.yearsOfExperience;
    const spec = i.specializations?.[0];
    if (spec && yrs) {
      return this._translateService.instant('home.instructorCard.roleWithYears', {
        specialization: spec,
        count: yrs,
      });
    }
    if (spec) return spec;
    if (i.bio) return i.bio.slice(0, 40);
    return this._translateService.instant('enum.userRole.INSTRUCTOR');
  });

  readonly tags = computed(() => {
    const list = this.instructor().specializations ?? [];
    return list.slice(0, 2);
  });

  readonly resolvedTone = computed<HexTone>(() => {
    const explicit = this.tone();
    if (explicit) return explicit;
    // Deterministic tone from id so the same instructor always gets the same colour.
    const tones: HexTone[] = ['honey', 'coral', 'teal', 'navy'];
    const id = this.instructor().id ?? '';
    let sum = 0;
    for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
    return tones[sum % tones.length];
  });

  readonly profileLink = computed(() => {
    const handle = this.instructor().handle;
    return handle ? ['/@' + handle] : null;
  });
}
