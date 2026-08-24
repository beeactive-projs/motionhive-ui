import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import {
  SESSION_PARTICIPANT_STATUSES,
  SessionParticipant,
  SessionParticipantStatus,
} from 'core';
import type { SessionStatusTone } from 'core';

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
  imports: [CommonModule, TableModule, ButtonDirective, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participants-table.html',
  styleUrl: './participants-table.scss',
})
export class ParticipantsTable {
  readonly participants = input.required<SessionParticipant[]>();
  readonly mode = input<'roster' | 'attendance' | 'readonly'>('roster');
  readonly pageSize = input(25);
  /** Set of in-flight participant ids — disables their actions. */
  readonly busyIds = input<Set<string>>(new Set());

  readonly approve = output<string>();
  readonly decline = output<string>();
  readonly markAttended = output<{ id: string; attended: boolean }>();

  protected readonly Status = SessionParticipantStatus;

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
    return this.busyIds().has(id);
  }

  protected statusLabel(s: string): string {
    return SESSION_PARTICIPANT_STATUSES[s as SessionParticipantStatus]?.label ?? s;
  }

  /** Core's status tones are named after PrimeNG severities — pass straight through. */
  protected statusSeverity(s: string): SessionStatusTone {
    return SESSION_PARTICIPANT_STATUSES[s as SessionParticipantStatus]?.tone ?? 'secondary';
  }
}
