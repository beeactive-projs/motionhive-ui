import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import type { SessionParticipant } from '../../models/session/session.model';

/**
 * `mh-participants-table` — table primitive for a session's roster.
 *
 * Domain-agnostic over a participant array; the consumer wires the
 * action callbacks (`approve` / `decline` / `markAttended`). The
 * component only emits intent — it never calls the API itself.
 *
 * Three column profiles via `mode`:
 *   - `roster`     — pre-session roster (status + approve/decline)
 *   - `attendance` — at-session check-in (attended yes/no/no-record)
 *   - `readonly`   — historical view, no actions
 */
@Component({
  selector: 'mh-participants-table',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Mobile (≤600px): card stack. Tables horizontal-scroll on phones,
         which the design forbids (rule 5). One card per row instead. -->
    <ul class="mh-pt-cards" role="list">
      @for (p of participants; track p.id) {
        <li class="mh-pt-card">
          <div class="mh-pt-card__top">
            @if (p.user?.avatarUrl) {
              <img [src]="p.user!.avatarUrl" alt="" class="mh-pt__avatar" />
            } @else {
              <span class="mh-pt__avatar mh-pt__avatar--ph">{{ initials(p) }}</span>
            }
            <div class="mh-pt-card__lines">
              <strong>{{ fullName(p) }}</strong>
              <small class="mh-pt-card__when">
                {{ p.bookedAt | date: 'd MMM, HH:mm' }}
              </small>
            </div>
            <p-tag
              [value]="statusLabel(p.status)"
              [severity]="statusSeverity(p.status)"
            />
          </div>
          @if (p.bookingNote) {
            <p class="mh-pt-card__note">"{{ p.bookingNote }}"</p>
          }
          @if (mode === 'roster' && p.status === 'PENDING_APPROVAL') {
            <div class="mh-pt-card__actions">
              <p-button
                icon="pi pi-check"
                label="Approve"
                severity="success"
                [outlined]="true"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="approve.emit(p.id)"
              />
              <p-button
                icon="pi pi-times"
                label="Decline"
                severity="danger"
                [text]="true"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="decline.emit(p.id)"
              />
            </div>
          } @else if (mode === 'attendance') {
            <div class="mh-pt-card__actions">
              <p-button
                icon="pi pi-check"
                label="Attended"
                severity="success"
                [outlined]="p.attended !== true"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: true })"
              />
              <p-button
                icon="pi pi-times"
                label="No-show"
                severity="danger"
                [outlined]="p.attended !== false"
                [text]="p.attended !== false"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: false })"
              />
            </div>
          }
        </li>
      } @empty {
        <li class="mh-pt-card mh-pt-card--empty">No participants yet.</li>
      }
    </ul>

    <p-table
      [value]="participants"
      [paginator]="participants.length > pageSize"
      [rows]="pageSize"
      [rowsPerPageOptions]="[10, 25, 50]"
      styleClass="mh-pt"
      [scrollable]="true"
      scrollHeight="flex"
    >
      <ng-template pTemplate="header">
        <tr>
          <th>Name</th>
          <th>Booked</th>
          <th>Status</th>
          @if (mode !== 'readonly') {
            <th class="mh-pt__th-right">Actions</th>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-p>
        <tr>
          <td>
            <div class="mh-pt__name">
              @if (p.user?.avatarUrl) {
                <img [src]="p.user.avatarUrl" alt="" class="mh-pt__avatar" />
              } @else {
                <span class="mh-pt__avatar mh-pt__avatar--ph">
                  {{ initials(p) }}
                </span>
              }
              <div class="mh-pt__nameLines">
                <strong>{{ fullName(p) }}</strong>
                @if (p.bookingNote) {
                  <small>“{{ p.bookingNote }}”</small>
                }
              </div>
            </div>
          </td>
          <td>{{ p.bookedAt | date: 'd MMM, HH:mm' }}</td>
          <td>
            <p-tag
              [value]="statusLabel(p.status)"
              [severity]="statusSeverity(p.status)"
            />
          </td>
          @if (mode === 'roster') {
            <td class="mh-pt__td-right">
              @if (p.status === 'PENDING_APPROVAL') {
                <p-button
                  icon="pi pi-check"
                  severity="success"
                  [outlined]="true"
                  size="small"
                  [loading]="isBusy(p.id)"
                  (onClick)="approve.emit(p.id)"
                  ariaLabel="Approve"
                />
                <p-button
                  icon="pi pi-times"
                  severity="danger"
                  [text]="true"
                  size="small"
                  [loading]="isBusy(p.id)"
                  (onClick)="decline.emit(p.id)"
                  ariaLabel="Decline"
                />
              }
            </td>
          } @else if (mode === 'attendance') {
            <td class="mh-pt__td-right">
              <p-button
                icon="pi pi-check"
                severity="success"
                [outlined]="p.attended !== true"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: true })"
                ariaLabel="Mark attended"
              />
              <p-button
                icon="pi pi-times"
                severity="danger"
                [outlined]="p.attended !== false"
                [text]="p.attended !== false"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: false })"
                ariaLabel="Mark no-show"
              />
            </td>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td [attr.colspan]="mode === 'readonly' ? 3 : 4" class="mh-pt__empty">
            No participants yet.
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: `
    :host { display: block; }
    .mh-pt__name { display: flex; align-items: center; gap: 10px; }
    .mh-pt__avatar {
      width: 32px; height: 32px; border-radius: 50%;
      object-fit: cover;
      background: var(--p-surface-200);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: var(--p-text-muted-color);
    }
    .mh-pt__avatar--ph { background: var(--p-primary-100); color: var(--p-primary-700); }
    .mh-pt__nameLines {
      display: flex; flex-direction: column;
      strong { font-size: 13px; color: var(--p-text-color); }
      small { font-size: 11px; color: var(--p-text-muted-color); font-style: italic; }
    }
    .mh-pt__th-right, .mh-pt__td-right { text-align: right; }
    .mh-pt__td-right p-button + p-button { margin-left: 4px; }
    .mh-pt__empty { text-align: center; padding: 24px; color: var(--p-text-muted-color); }

    /* Desktop: hide the card stack; the p-table is the canonical surface. */
    .mh-pt-cards { display: none; }

    /* Mobile (≤600px): swap. Tables horizontal-scrolling on a phone reads
       as broken; one stacked card per row carries the same information. */
    @media (max-width: 767.98px) {
      .mh-pt-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
        list-style: none;
        padding: 0;
        margin: 0;
      }
      :host ::ng-deep .p-table,
      :host ::ng-deep .mh-pt { display: none !important; }
    }
    .mh-pt-card {
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mh-pt-card--empty {
      text-align: center;
      color: var(--p-text-muted-color);
      padding: 24px 12px;
    }
    .mh-pt-card__top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mh-pt-card__lines {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      strong {
        font-size: 14px;
        color: var(--p-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .mh-pt-card__when { font-size: 11px; color: var(--p-text-muted-color); }
    .mh-pt-card__note {
      margin: 0;
      padding: 8px 10px;
      font-size: 12px;
      font-style: italic;
      color: var(--p-text-muted-color);
      background: var(--p-surface-50);
      border-left: 2px solid var(--p-surface-300);
      border-radius: 4px;
    }
    .mh-pt-card__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class ParticipantsTable {
  @Input({ required: true }) participants: SessionParticipant[] = [];
  @Input() mode: 'roster' | 'attendance' | 'readonly' = 'roster';
  @Input() pageSize = 25;
  /** Set of in-flight participant ids — disables their actions. */
  @Input() busyIds: Set<string> = new Set();

  @Output() approve = new EventEmitter<string>();
  @Output() decline = new EventEmitter<string>();
  @Output() markAttended = new EventEmitter<{ id: string; attended: boolean }>();

  protected fullName(p: SessionParticipant): string {
    if (p.user) return `${p.user.firstName} ${p.user.lastName}`;
    return 'Member';
  }

  protected initials(p: SessionParticipant): string {
    if (!p.user) return '?';
    const f = p.user.firstName?.[0] ?? '';
    const l = p.user.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  protected isBusy(id: string): boolean {
    return this.busyIds.has(id);
  }

  protected statusLabel(s: string): string {
    switch (s) {
      case 'CONFIRMED': return 'Confirmed';
      case 'PENDING_APPROVAL': return 'Pending';
      case 'WAITLISTED': return 'Waitlisted';
      case 'CANCELLED': return 'Cancelled';
      case 'DECLINED': return 'Declined';
      default: return s;
    }
  }

  protected statusSeverity(
    s: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (s) {
      case 'CONFIRMED': return 'success';
      case 'PENDING_APPROVAL': return 'warn';
      case 'WAITLISTED': return 'info';
      case 'CANCELLED':
      case 'DECLINED': return 'danger';
      default: return 'secondary';
    }
  }
}
