import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Centered pill rendered for SYSTEM_* messages — group join/leave,
 * rename, role change, pinned session. v1 never inserts these (no
 * group conversations yet) but the component is scaffolded so when
 * groups land we don't have to retro-fit the thread renderer.
 */
@Component({
  selector: 'mh-system-event',
  standalone: true,
  template: `
    <div class="mh-sysevent">
      <span class="mh-sysevent__pill">{{ text() }}</span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      text-align: center;
      margin: 8px 0;
    }
    .mh-sysevent__pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      background: #f7f1e6;
      color: #475569;
      font-size: 11px;
      font-weight: 500;
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    :host-context(.dark) .mh-sysevent__pill {
      background: rgba(248, 250, 252, 0.08);
      color: var(--p-surface-300, #cbd5e1);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemEvent {
  readonly text = input.required<string>();
}
