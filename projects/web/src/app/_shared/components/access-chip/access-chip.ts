import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { SESSION_ACCESS_LEVELS, SessionAccess } from 'core';
import type { SessionAccessTone } from 'core';

/**
 * `mh-access-chip` — the single access pill rendered across every
 * sessions surface (list, calendar event, detail, showcase, my-sessions,
 * dialogs).
 *
 * Inputs:
 *   - `access` — the access kind (OPEN / FREE / CLIENTS_ONLY / GROUP_ONLY)
 *   - `approvalRequired` — orthogonal flag; appends a shield icon to the chip
 *
 * Words, icons, and tones come from core's `SESSION_ACCESS_LEVELS`; only the
 * tone → Tailwind wash mapping lives here.
 */

/** Core's access tone as the light wash pair the chip idiom uses. */
const TONE_CLASSES: Record<SessionAccessTone, string> = {
  teal: 'bg-teal-100 text-teal-700',
  success: 'bg-green-100 text-green-700',
  honey: 'bg-amber-100 text-amber-700',
  sky: 'bg-blue-100 text-blue-700',
};
@Component({
  selector: 'mh-access-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './access-chip.html',
})
export class AccessChip {
  readonly access = input.required<SessionAccess>();
  readonly approvalRequired = input(false);

  protected readonly label = computed<string>(
    () => SESSION_ACCESS_LEVELS[this.access()]?.label ?? this.access(),
  );

  protected readonly icon = computed<string>(
    () => SESSION_ACCESS_LEVELS[this.access()]?.piIcon ?? 'pi pi-tag',
  );

  protected readonly colorClass = computed<string>(() => {
    const meta = SESSION_ACCESS_LEVELS[this.access()];
    return meta ? TONE_CLASSES[meta.tone] : 'bg-slate-100 text-slate-700';
  });

  protected readonly ariaLabel = computed<string>(() =>
    this.approvalRequired() ? `${this.label()} · approval required` : this.label(),
  );
}
