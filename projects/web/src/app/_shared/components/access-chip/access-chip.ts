import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SessionAccess } from 'core';

/**
 * `mh-access-chip` — the single access pill rendered across every
 * sessions surface (list, calendar event, detail, showcase, my-sessions,
 * dialogs).
 *
 * Inputs:
 *   - `access` — the access kind (OPEN / FREE / CLIENTS_ONLY / GROUP_ONLY)
 *   - `approvalRequired` — orthogonal flag; adds an "approval required" suffix
 *
 * Visual conventions:
 *   - OPEN — teal (community accent)
 *   - FREE — emerald green (highlights free sessions)
 *   - CLIENTS_ONLY — honey primary (instructor-owned)
 *   - GROUP_ONLY — navy (group accent)
 *   - approvalRequired — coral tint added to the right side of the chip
 */
@Component({
  selector: 'mh-access-chip',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-chip.html',
  styleUrl: './access-chip.scss',
})
export class AccessChip {
  readonly access = input.required<SessionAccess>();
  readonly approvalRequired = input(false);

  /** Expose the enum object so the template avoids magic strings. */
  protected readonly Access = SessionAccess;

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

  protected readonly iconClass = computed<string>(() => {
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

  protected readonly ariaLabel = computed<string>(() =>
    this.approvalRequired() ? `${this.label()} · approval required` : this.label(),
  );
}
