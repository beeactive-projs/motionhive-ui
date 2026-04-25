import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Group } from 'core';
import { Hex, HexTone } from '../hex/hex';

/**
 * Group tile for the "Every group, all in one place" row. Uses the
 * real Group model — the API already supports list/join/leave, so the
 * Open/Join action emits and the parent decides which call to make.
 */
@Component({
  selector: 'mh-group-card',
  imports: [ButtonModule, Hex],
  templateUrl: './group-card.html',
  styleUrl: './group-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCard {
  readonly group = input.required<Group>();
  /** When true, render the "Open" CTA (user is in the group); else render "Join". */
  readonly joined = input<boolean>(false);
  readonly tone = input<HexTone | null>(null);

  readonly action = output<{ group: Group; joined: boolean }>();

  readonly initials = computed(() => {
    const name = this.group().name ?? '';
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  readonly resolvedTone = computed<HexTone>(() => {
    const explicit = this.tone();
    if (explicit) return explicit;
    const tones: HexTone[] = ['honey-soft', 'coral-soft', 'teal-soft', 'navy-soft'];
    const id = this.group().id ?? '';
    let sum = 0;
    for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
    return tones[sum % tones.length];
  });

  readonly memberSummary = computed(() => {
    const count = this.group().memberCount ?? 0;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  });

  onAction(): void {
    this.action.emit({ group: this.group(), joined: this.joined() });
  }
}
