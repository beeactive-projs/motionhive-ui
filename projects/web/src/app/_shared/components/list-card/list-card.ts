import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { TagSeverity } from 'core';

/**
 * Presentational list-card used by mobile variants of instructor-facing
 * list pages (Invoices, Memberships, Pricing, etc.). Desktop keeps its
 * data tables; the mobile template renders `mh-list-card` per row.
 *
 * Content projection slots:
 *   <ng-content select="[badges]">   optional top-row badges (e.g. "overdue")
 *   <ng-content select="[amount]">   right-aligned amount block (stacked label)
 *   <ng-content select="[meta]">     small text under title/subtitle
 *   <ng-content select="[actions]">  action buttons row at the bottom
 *
 * Inputs are limited to the pieces every card shares (status pill +
 * avatar + title + subtitle) so the component stays simple; anything
 * list-specific (amount formatting, meta rows, action buttons) is
 * projected so we don't end up with a god-prop object.
 */
@Component({
  selector: 'mh-list-card',
  imports: [AvatarModule, TagModule],
  templateUrl: './list-card.html',
  styleUrl: './list-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCard {
  /** Status pill — omit to hide. */
  readonly status = input<string | null>(null);
  readonly statusSeverity = input<TagSeverity>(TagSeverity.Secondary);

  /** Optional avatar initials (first+last letter, e.g. "TU"). Falls
   *  back to `avatarIcon` when no initials are provided. */
  readonly avatarInitials = input<string | null>(null);
  /** Fallback avatar icon when there are no initials. */
  readonly avatarIcon = input<string>('pi pi-user');

  /** Main title line — usually a person's name or product name. */
  readonly title = input.required<string>();
  /** Optional subtitle below the title — usually an email / category. */
  readonly subtitle = input<string | null>(null);

  /** When true, the whole card looks interactive (hover, pointer). */
  readonly clickable = input<boolean>(false);

  /** When set, the card renders an amber left border — useful to call
   *  out overdue or pending items without having to add the border
   *  manually at every call site. */
  readonly accent = input<'none' | 'primary' | 'danger' | 'success'>('none');

  readonly accentClass = computed(() => {
    switch (this.accent()) {
      case 'primary':
        return 'border-l-4 border-l-primary-500';
      case 'danger':
        return 'border-l-4 border-l-red-500';
      case 'success':
        return 'border-l-4 border-l-green-500';
      default:
        return '';
    }
  });
}
