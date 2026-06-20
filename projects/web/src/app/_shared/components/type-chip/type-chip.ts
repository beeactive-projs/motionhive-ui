import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { SessionKind } from 'core';

/**
 * `mh-type-chip` — session type pill (GROUP / PRIVATE / OPEN).
 *
 * Smaller and less colorful than `mh-access-chip` — it appears
 * alongside the access chip in nearly every surface; visual weight
 * goes to access (the actionable concept).
 */
@Component({
  selector: 'mh-type-chip',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './type-chip.html',
})
export class TypeChip {
  readonly type = input.required<SessionKind>();

  protected readonly label = computed<string>(() => {
    switch (this.type()) {
      case SessionKind.Group:
        return 'Group';
      case SessionKind.Private:
        return '1-on-1';
      case SessionKind.Open:
        return 'Open';
      default:
        return this.type();
    }
  });

  protected readonly icon = computed<string>(() => {
    switch (this.type()) {
      case SessionKind.Group:
        return 'pi pi-users';
      case SessionKind.Private:
        return 'pi pi-user';
      case SessionKind.Open:
        return 'pi pi-globe';
      default:
        return 'pi pi-tag';
    }
  });

  /** Lighter-than-severity bg + text color classes, per type. */
  protected readonly colorClass = computed<string>(() => {
    switch (this.type()) {
      case SessionKind.Group:
        return 'bg-blue-100 text-blue-700';
      case SessionKind.Open:
        return 'bg-green-100 text-green-700';
      case SessionKind.Private:
        return 'bg-violet-100 text-violet-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  });
}
