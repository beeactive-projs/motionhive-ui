import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Venue, countryNameFromCode } from 'core';
import { VENUE_KIND_META } from '../venue-kind.utils';

/**
 * Compact, reusable venue row. Used in the profile Venues section
 * and in any future venue picker. Pure presentational — emits edit/
 * archive/delete actions; the parent owns the data.
 *
 * Layout is single-row with an ellipsized secondary line; the full
 * details (address, meeting URL, notes) surface on hover via a
 * tooltip. On mobile the tooltip is unreachable so the parent can
 * open the edit dialog to see everything.
 */
@Component({
  selector: 'mh-venue-card',
  imports: [ButtonModule, Tag, TooltipModule],
  templateUrl: './venue-card.html',
  styleUrl: './venue-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenueCard {
  readonly venue = input.required<Venue>();
  readonly showActions = input(true);

  readonly edit = output<Venue>();
  readonly archive = output<Venue>();
  readonly restore = output<Venue>();
  readonly remove = output<Venue>();

  readonly meta = computed(() => VENUE_KIND_META[this.venue().kind]);

  /**
   * Short, one-line summary beneath the name. Prefers the address for
   * physical venues, the meeting URL for online, or the notes as a
   * last resort.
   */
  readonly detailsLine = computed<string | null>(() => {
    const v = this.venue();
    if (v.isOnline) return v.meetingUrl ?? v.notes ?? null;
    const parts = [v.city, v.region, countryNameFromCode(v.countryCode)].filter(
      (x): x is string => !!x,
    );
    const address = parts.join(', ');
    return address || v.notes || null;
  });

  /**
   * Full content for the hover tooltip. Newline-separated so PrimeNG
   * renders multi-line text. Includes everything we have: name,
   * full address, meeting link, notes.
   */
  readonly tooltipContent = computed<string>(() => {
    const v = this.venue();
    const lines: string[] = [v.name];

    if (!v.isOnline) {
      const addr = [v.line1, v.city, v.region, v.postalCode]
        .filter((x): x is string => !!x)
        .join(', ');
      const countryName = countryNameFromCode(v.countryCode);
      const full = [addr, countryName].filter(Boolean).join(' · ');
      if (full) lines.push(full);
    }
    if (v.isOnline && v.meetingUrl) lines.push(v.meetingUrl);
    if (v.notes) lines.push(v.notes);

    return lines.join('\n');
  });

  onEdit(): void {
    this.edit.emit(this.venue());
  }

  onArchive(): void {
    this.archive.emit(this.venue());
  }

  onRestore(): void {
    this.restore.emit(this.venue());
  }

  onRemove(): void {
    this.remove.emit(this.venue());
  }
}
