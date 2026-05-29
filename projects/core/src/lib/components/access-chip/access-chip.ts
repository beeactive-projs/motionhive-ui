import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  input,
} from '@angular/core';
import type { SessionAccess } from '../../models/session/session.enums';

/**
 * `mh-access-chip` — the single access pill rendered across every
 * sessions surface (list, calendar event, detail, showcase, my-sessions,
 * dialogs).
 *
 * Inputs:
 *   - `access` — the access kind (OPEN / FREE / CLIENTS_ONLY / GROUP_ONLY)
 *   - `approvalRequired` — orthogonal flag; adds a "Approval" suffix label
 *
 * Visual conventions:
 *   - OPEN — teal (community accent)
 *   - FREE — emerald green (highlights free sessions)
 *   - CLIENTS_ONLY — honey primary (instructor-owned)
 *   - GROUP_ONLY — navy (group accent)
 *   - approvalRequired — coral tint added to the right side of the chip
 *
 * Rendered as a small pill with an icon + label. Consistent across
 * every artboard.
 */
@Component({
  selector: 'mh-access-chip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="mh-access"
      [class.mh-access--open]="access === 'OPEN'"
      [class.mh-access--free]="access === 'FREE'"
      [class.mh-access--clients]="access === 'CLIENTS_ONLY'"
      [class.mh-access--group]="access === 'GROUP_ONLY'"
      [attr.aria-label]="ariaLabel()"
    >
      <i [class]="iconClass()" aria-hidden="true"></i>
      <span>{{ label() }}</span>
      @if (approvalRequired) {
        <span class="mh-access__approval" title="Approval required">
          <i class="pi pi-shield" aria-hidden="true"></i>
        </span>
      }
    </span>
  `,
  styles: `
    .mh-access {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.4;
      white-space: nowrap;

      i { font-size: 10px; }
    }
    .mh-access--open    { background: #E0F2F1; color: #00695C; }
    .mh-access--free    { background: #DCFCE7; color: #15803D; }
    .mh-access--clients { background: #FEEFD2; color: #B45309; }
    .mh-access--group   { background: #DBEAFE; color: #1D4ED8; }

    .mh-access__approval {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-left: 2px;
      padding: 1px 4px;
      border-radius: 999px;
      background: #FFE4E1;
      color: #B91C1C;
      font-size: 9px;
    }
  `,
})
export class AccessChip {
  @Input({ required: true }) access!: SessionAccess;
  @Input() approvalRequired: boolean = false;

  // Use signal inputs in mixed mode would require migration; stick with
  // `Input` plus computed-style getters for now (matches the existing
  // codebase pattern; signal inputs are a Phase D+ refactor target).

  protected label(): string {
    switch (this.access) {
      case 'OPEN': return 'Open to all';
      case 'FREE': return 'Free';
      case 'CLIENTS_ONLY': return 'Clients only';
      case 'GROUP_ONLY': return 'Group only';
      default: return this.access;
    }
  }

  protected iconClass(): string {
    switch (this.access) {
      case 'OPEN': return 'pi pi-globe';
      case 'FREE': return 'pi pi-heart';
      case 'CLIENTS_ONLY': return 'pi pi-user';
      case 'GROUP_ONLY': return 'pi pi-sitemap';
      default: return 'pi pi-tag';
    }
  }

  protected ariaLabel(): string {
    return this.approvalRequired
      ? `${this.label()} · approval required`
      : this.label();
  }
}
