import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { SessionAccess } from 'core';

/**
 * `mh-access-chip` — the single access pill rendered across every
 * sessions surface (list, calendar event, detail, showcase, my-sessions,
 * dialogs).
 *
 * Inputs:
 *   - `access` — the access kind (OPEN / FREE / CLIENTS_ONLY / GROUP_ONLY)
 *   - `approvalRequired` — orthogonal flag; appends a shield icon to the chip
 *
 * Visual conventions (lighter-than-severity bg + text, per access):
 *   - OPEN — teal (community accent)
 *   - FREE — emerald green (highlights free sessions)
 *   - CLIENTS_ONLY — amber (instructor-owned)
 *   - GROUP_ONLY — blue (group accent)
 */
@Component({
  selector: 'mh-access-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-chip.html',
})
export class AccessChip {
  readonly access = input.required<SessionAccess>();
  readonly approvalRequired = input(false);

  protected readonly label = computed<string>(() => {
    switch (this.access()) {
      case SessionAccess.Open:
        return 'Open to all';
      case SessionAccess.Free:
        return 'Free';
      case SessionAccess.ClientsOnly:
        return 'Clients only';
      case SessionAccess.GroupOnly:
        return 'Group only';
      default:
        return this.access();
    }
  });

  protected readonly icon = computed<string>(() => {
    switch (this.access()) {
      case SessionAccess.Open:
        return 'pi pi-globe';
      case SessionAccess.Free:
        return 'pi pi-heart';
      case SessionAccess.ClientsOnly:
        return 'pi pi-user';
      case SessionAccess.GroupOnly:
        return 'pi pi-sitemap';
      default:
        return 'pi pi-tag';
    }
  });

  /** Lighter-than-severity bg + text color classes, per access. */
  protected readonly colorClass = computed<string>(() => {
    switch (this.access()) {
      case SessionAccess.Open:
        return 'bg-teal-100 text-teal-700';
      case SessionAccess.Free:
        return 'bg-green-100 text-green-700';
      case SessionAccess.ClientsOnly:
        return 'bg-amber-100 text-amber-700';
      case SessionAccess.GroupOnly:
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  });

  protected readonly ariaLabel = computed<string>(() =>
    this.approvalRequired() ? `${this.label()} · approval required` : this.label(),
  );
}
