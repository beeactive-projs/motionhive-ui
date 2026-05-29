import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

export interface AvatarStackUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

/**
 * `mh-avatar-stack` — overlapping circle row + "+N more" tail.
 *
 * Inputs:
 *   - `users` — at most `maxVisible` are rendered as circles
 *   - `total` — total count (defaults to `users.length`); the difference
 *     becomes the "+N more" tail
 *   - `size` — pixel size of each avatar (default 26)
 *   - `maxVisible` — how many circles before "+N" (default 4)
 *
 * Domain-agnostic; takes a minimal `AvatarStackUser` shape that any
 * module can adapt to.
 */
@Component({
  selector: 'mh-avatar-stack',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-avstack"
      [style.--size.px]="size"
      [attr.aria-label]="(total ?? users.length) + ' participants'"
    >
      @for (u of visible(); track u.id; let i = $index) {
        <span
          class="mh-avstack__avatar"
          [style.zIndex]="100 - i"
          [title]="u.firstName + ' ' + u.lastName"
        >
          @if (u.avatarUrl) {
            <img [src]="u.avatarUrl" [alt]="u.firstName ?? ''" />
          } @else {
            <span class="mh-avstack__initials">{{ initials(u) }}</span>
          }
        </span>
      }
      @if (extra() > 0) {
        <span class="mh-avstack__more" [style.zIndex]="0">+{{ extra() }}</span>
      }
    </div>
  `,
  styles: `
    .mh-avstack {
      display: inline-flex;
      align-items: center;
    }
    .mh-avstack__avatar {
      width: var(--size, 26px);
      height: var(--size, 26px);
      border-radius: 50%;
      background: var(--p-surface-200);
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--p-surface-0, #fff);
      margin-left: calc(var(--size, 26px) * -0.35);
      position: relative;
      font-size: 11px;
      font-weight: 700;
      color: var(--p-text-muted-color);

      &:first-child { margin-left: 0; }

      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .mh-avstack__initials {
      pointer-events: none;
      user-select: none;
    }
    .mh-avstack__more {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--size, 26px);
      height: var(--size, 26px);
      padding: 0 8px;
      border-radius: 999px;
      background: var(--p-surface-100);
      color: var(--p-text-muted-color);
      font-size: 11px;
      font-weight: 700;
      margin-left: 6px;
    }
  `,
})
export class AvatarStack {
  @Input({ required: true }) users: AvatarStackUser[] = [];
  @Input() total?: number;
  @Input() size: number = 26;
  @Input() maxVisible: number = 4;

  protected visible(): AvatarStackUser[] {
    return this.users.slice(0, this.maxVisible);
  }

  protected extra(): number {
    const totalCount = this.total ?? this.users.length;
    return Math.max(0, totalCount - this.maxVisible);
  }

  protected initials(u: AvatarStackUser): string {
    const a = (u.firstName ?? '').trim();
    const b = (u.lastName ?? '').trim();
    return ((a[0] ?? '') + (b[0] ?? '')).toUpperCase() || '·';
  }
}
