import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './type-chip.html',
  styleUrl: './type-chip.scss',
})
export class TypeChip {
  readonly type = input.required<SessionKind>();

  /** Expose the enum object so the template avoids magic strings. */
  protected readonly Type = SessionKind;

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

  protected readonly iconClass = computed<string>(() => {
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
}
