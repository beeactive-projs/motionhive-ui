import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InstructorSearchResult } from 'core';
import { Hex, HexTone } from '../hex/hex';

/**
 * Compact instructor card used in the "Meet every instructor" grid on
 * the home page. Hex avatar with initials + name + role + tag chips +
 * a Follow button.
 *
 * NOTE: "Follow" is not a real backend feature yet — the button emits
 * `followClick` and call-sites currently log/no-op. Wire to a real
 * follow endpoint once it ships.
 */
@Component({
  selector: 'mh-instructor-card',
  imports: [ButtonModule, TagModule, Hex],
  templateUrl: './instructor-card.html',
  styleUrl: './instructor-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorCard {
  readonly instructor = input.required<InstructorSearchResult>();
  /** Picks a hex tone from the instructor id so cards visually vary across the grid. */
  readonly tone = input<HexTone | null>(null);

  readonly followClick = output<InstructorSearchResult>();

  readonly initials = computed(() => {
    const i = this.instructor();
    return `${(i.firstName ?? '').charAt(0)}${(i.lastName ?? '').charAt(0)}`.toUpperCase() || '?';
  });

  readonly displayName = computed(() => {
    const i = this.instructor();
    return i.displayName?.trim() || `${i.firstName ?? ''} ${i.lastName ?? ''}`.trim() || 'Instructor';
  });

  readonly role = computed(() => {
    const i = this.instructor();
    const yrs = i.yearsOfExperience;
    const spec = i.specializations?.[0];
    if (spec && yrs) return `${spec} · ${yrs} ${yrs === 1 ? 'yr' : 'yrs'}`;
    if (spec) return spec;
    if (i.bio) return i.bio.slice(0, 40);
    return 'Instructor';
  });

  readonly tags = computed(() => {
    const list = this.instructor().specializations ?? [];
    return list.slice(0, 2);
  });

  readonly resolvedTone = computed<HexTone>(() => {
    const explicit = this.tone();
    if (explicit) return explicit;
    // Deterministic-ish tone from id so the same instructor always gets the same colour.
    const tones: HexTone[] = ['honey', 'coral', 'teal', 'navy'];
    const id = this.instructor().id ?? '';
    let sum = 0;
    for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
    return tones[sum % tones.length];
  });

  onFollow(): void {
    this.followClick.emit(this.instructor());
  }
}
