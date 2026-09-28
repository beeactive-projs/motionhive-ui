import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { ProgramAssignment, ProgramAssignmentStatus, TagSeverity, enumLabel } from 'core';
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
  imports: [DatePipe, ButtonDirective, Card, ProgressBar, Tag, HexAvatar, TranslatePipe],
  templateUrl: './my-plan-row.html',
  styleUrl: './my-plan-row.scss',
  host: {
    role: 'button',
    tabindex: '0',
    '[attr.data-tone]': 'tone()',
    '(click)': 'onOpen()',
    '(keydown)': 'onKey($event)',
  },
})
export class MyPlanRow {
  private readonly _translateService = inject(TranslateService);

  readonly assignment = input.required<ProgramAssignment>();
  /** Mobile viewport flag (from the page's `injectIsMobile()`). */
  readonly mobile = input<boolean>(false);

  readonly open = output<void>();

  // Enum exposed for template comparisons — never compare raw string
  // literals (see CLAUDE.md).
  protected readonly Status = ProgramAssignmentStatus;

  protected readonly status = computed(() => this.assignment().status);

  protected readonly instructor = computed(() => this.assignment().instructor ?? null);

  /** True when you put this on the calendar yourself. */
  protected readonly isSelfScheduled = computed(
    () => this.assignment().assignmentKind === 'SELF',
  );

  /**
   * Where the plan came from. A routine you scheduled is not a coach's
   * work, and labelling it "your coach" put your own name under someone
   * else's job title.
   */
  protected readonly originLabel = computed(() => {
    if (this.isSelfScheduled()) {
      return this._translateService.instant('training.planRow.origin.routine');
    }
    const i = this.instructor();
    const name = i ? `${i.firstName} ${i.lastName}`.trim() : '';
    return name
      ? this._translateService.instant('training.planRow.origin.coach', { name })
      : this._translateService.instant('training.planRow.origin.yourCoach');
  });

  protected readonly instructorName = computed(() => {
    const i = this.instructor();
    const name = i ? `${i.firstName} ${i.lastName}`.trim() : '';
    return name || this._translateService.instant('training.common.yourCoach');
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

  protected readonly statusLabel = computed<string>(() =>
    enumLabel('programAssignmentStatus', this.status()),
  );

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
        return this._translateService.instant('button.continue');
      case ProgramAssignmentStatus.Completed:
        return this._translateService.instant('training.planRow.review');
      default:
        return this._translateService.instant('button.open');
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
