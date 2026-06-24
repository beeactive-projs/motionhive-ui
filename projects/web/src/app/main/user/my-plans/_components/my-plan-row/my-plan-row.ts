import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { ProgramAssignment, ProgramAssignmentStatus, TagSeverity } from 'core';
import { HexAvatar } from '../../../../../_shared/components/hex-avatar/hex-avatar';

/**
 * Left-edge accent of a plan row. Answers one question at a glance —
 * *"where is this plan in its lifecycle?"* — on a single axis, honey-free
 * (honey/amber is reserved for actions, never status — see CLAUDE.md):
 *
 *   - `Active`   (teal)  — in progress, the client should be training.
 *   - `Done`     (green) — completed.
 *   - `Inactive` (muted) — pending / paused / cancelled; not actively running.
 *
 * The precise status word lives in the status `p-tag`; the stripe only
 * names the lifecycle band.
 */
const PlanRowTone = {
  Active: 'active',
  Done: 'done',
  Inactive: 'inactive',
} as const;
type PlanRowTone = (typeof PlanRowTone)[keyof typeof PlanRowTone];

/**
 * `mh-my-plan-row` — a single program-assignment row on the client
 * "My plans" page. Presentational: takes one `ProgramAssignment` (with the
 * eager-loaded `instructor` the list response embeds) and emits `open`; the
 * page owns the Router.
 *
 * Layout mirrors `mh-my-session-row`:
 *
 *  ┌──────┬────┬───────────────────────────────────┬────────────┐
 *  │Starts│ ⬡  │ Fat Loss Circuit        [Pending] │ [Continue] │
 *  │ 24   │avtr│ 👤 Coach · 📅 Starts 24 Jun        │            │
 *  │ Jun  │    │ ▓▓▓░░ 0%                            │            │
 *  │      │    │ 💬 Starts next week.                │            │
 *  └──────┴────┴───────────────────────────────────┴────────────┘
 *
 * The coach line / date range are desktop-only; on mobile the status tag +
 * CTA collapse inline under the title.
 */
@Component({
  selector: 'mh-my-plan-row',
  standalone: true,
  imports: [DatePipe, Button, Card, ProgressBar, Tag, HexAvatar],
  templateUrl: './my-plan-row.html',
  styleUrl: './my-plan-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.data-tone]': 'tone()',
    '(click)': 'onOpen()',
    '(keydown)': 'onKey($event)',
  },
})
export class MyPlanRow {
  readonly assignment = input.required<ProgramAssignment>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);

  readonly open = output<void>();

  // Enum exposed for template comparisons — never compare raw string
  // literals (see CLAUDE.md).
  protected readonly Status = ProgramAssignmentStatus;

  protected readonly status = computed(() => this.assignment().status);

  protected readonly instructor = computed(() => this.assignment().instructor ?? null);

  protected readonly instructorName = computed(() => {
    const i = this.instructor();
    if (!i) return 'your coach';
    return `${i.firstName} ${i.lastName}`.trim() || 'your coach';
  });

  protected readonly isPending = computed(() => this.status() === ProgramAssignmentStatus.Pending);

  protected readonly showProgress = computed(
    () =>
      this.assignment().completionPercent > 0 ||
      this.status() === ProgramAssignmentStatus.Completed,
  );

  /** Coach notes — trimmed, null when blank. */
  protected readonly notes = computed(() => this.assignment().notes?.trim() || null);

  // ─── Status tag (neutral/semantic — never honey for status) ───────────

  protected readonly statusSeverity = computed<TagSeverity>(() => {
    switch (this.status()) {
      case ProgramAssignmentStatus.Active:
        return TagSeverity.Info;
      case ProgramAssignmentStatus.Completed:
        return TagSeverity.Success;
      case ProgramAssignmentStatus.Cancelled:
        return TagSeverity.Danger;
      default:
        return TagSeverity.Secondary;
    }
  });

  protected readonly statusIcon = computed<string>(() => {
    switch (this.status()) {
      case ProgramAssignmentStatus.Active:
        return 'pi pi-bolt';
      case ProgramAssignmentStatus.Completed:
        return 'pi pi-check-circle';
      case ProgramAssignmentStatus.Paused:
        return 'pi pi-pause';
      case ProgramAssignmentStatus.Cancelled:
        return 'pi pi-times-circle';
      default:
        return 'pi pi-clock';
    }
  });

  protected readonly statusLabel = computed<string>(() => {
    const s = this.status();
    return s.charAt(0) + s.slice(1).toLowerCase();
  });

  // ─── Left-edge tone ───────────────────────────────────────────────────

  protected readonly tone = computed<PlanRowTone>(() => {
    switch (this.status()) {
      case ProgramAssignmentStatus.Active:
        return PlanRowTone.Active;
      case ProgramAssignmentStatus.Completed:
        return PlanRowTone.Done;
      default:
        return PlanRowTone.Inactive;
    }
  });

  // ─── Primary CTA (action = honey, brand-compliant) ────────────────────

  protected readonly ctaLabel = computed<string>(() => {
    switch (this.status()) {
      case ProgramAssignmentStatus.Active:
        return 'Continue';
      case ProgramAssignmentStatus.Completed:
        return 'Review';
      default:
        return 'Open';
    }
  });

  protected readonly ctaIcon = computed<string>(() => {
    switch (this.status()) {
      case ProgramAssignmentStatus.Active:
        return 'pi pi-play';
      case ProgramAssignmentStatus.Completed:
        return 'pi pi-eye';
      default:
        return 'pi pi-arrow-right';
    }
  });

  // ─── Events ───────────────────────────────────────────────────────────

  protected onOpen(): void {
    this.open.emit();
  }

  /** CTA button — same action as the row, but don't let it bubble to the host. */
  protected onCta(event: MouseEvent): void {
    event.stopPropagation();
    this.open.emit();
  }

  /** Keyboard activation — Enter/Space open the plan (like a button). */
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    }
  }
}
