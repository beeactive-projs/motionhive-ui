import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import type { SessionType } from '../../models/session/session.enums';

/**
 * `mh-type-chip` — session type pill (GROUP / PRIVATE / OPEN).
 *
 * Smaller and less colorful than `mh-access-chip` — it appears
 * alongside the access chip in nearly every surface; visual weight
 * goes to access (the actionable concept).
 */
@Component({
  selector: 'mh-type-chip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="mh-type"
      [class.mh-type--group]="type === 'GROUP'"
      [class.mh-type--private]="type === 'PRIVATE'"
      [class.mh-type--open]="type === 'OPEN'"
    >
      <i [class]="iconClass()" aria-hidden="true"></i>
      <span>{{ label() }}</span>
    </span>
  `,
  styles: `
    .mh-type {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      background: var(--p-surface-100);
      color: var(--p-text-muted-color);
      line-height: 1.4;
      white-space: nowrap;

      i { font-size: 10px; }
    }
    .mh-type--group   { background: #FFE7B5; color: #92400E; }
    .mh-type--private { background: #DBEAFE; color: #1D4ED8; }
    .mh-type--open    { background: #E0F2F1; color: #00695C; }
  `,
})
export class TypeChip {
  @Input({ required: true }) type!: SessionType;

  protected label(): string {
    switch (this.type) {
      case 'GROUP': return 'Group';
      case 'PRIVATE': return '1-on-1';
      case 'OPEN': return 'Open';
      default: return this.type;
    }
  }

  protected iconClass(): string {
    switch (this.type) {
      case 'GROUP': return 'pi pi-users';
      case 'PRIVATE': return 'pi pi-user';
      case 'OPEN': return 'pi pi-globe';
      default: return 'pi pi-tag';
    }
  }
}
