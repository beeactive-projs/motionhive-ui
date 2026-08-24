import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { SESSION_TYPES, SessionType, sessionTypeLabel, sessionTypeTone } from 'core';
import type { SessionTypeTone } from 'core';

/**
 * `mh-type-chip` — session type pill (GROUP / PRIVATE / OPEN).
 *
 * Words and hues come from core's `SESSION_TYPES` — the same honey / navy /
 * teal the calendar blocks and the mobile surfaces carry — rendered at the
 * light wash weight so it does not out-shout the access chip beside it.
 */

/** Core's tone as the light Tailwind wash the chip idiom uses. */
const TONE_CLASSES: Record<SessionTypeTone, string> = {
  honey: 'bg-amber-100 text-amber-700',
  navy: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
};
@Component({
  selector: 'mh-type-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './type-chip.html',
})
export class TypeChip {
  readonly type = input.required<SessionType>();

  protected readonly label = computed<string>(() => sessionTypeLabel(this.type()));

  protected readonly icon = computed<string>(
    () => SESSION_TYPES[this.type()]?.piIcon ?? 'pi pi-tag',
  );

  protected readonly colorClass = computed<string>(
    () => TONE_CLASSES[sessionTypeTone(this.type())],
  );
}
