import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import type {
  BlockedSessionInstance,
  PublicSessionInstance,
  SessionInstance,
} from '../../models/session/session.model';
import type { SessionAccess } from '../../models/session/session.enums';
import { AccessChip } from '../access-chip/access-chip';
import { TypeChip } from '../type-chip/type-chip';
import { ProviderChip } from '../provider-chip/provider-chip';
import { CapacityBar } from '../capacity-bar/capacity-bar';

/**
 * `mh-session-card` — the single card used across 6+ session surfaces.
 *
 * Variants:
 *   - `list-card`   — day-grouped instructor list (default)
 *   - `mine-row`    — client "My sessions" row (compact, horizontal)
 *   - `showcase`    — public instructor profile card
 *   - `mobile`      — mobile discover / detail summary
 *   - `related`     — related-sessions footer (no CTA)
 *   - `calendar-popover` — small popover from a clicked calendar event
 *
 * Inputs:
 *   - `instance` — full / public / blocked session instance shape
 *   - `variant` — visual layout
 *   - `selectable` / `selected` — bulk-select mode (list-card only)
 *   - `eligibility` — drives the CTA when the caller is not the instructor
 *
 * Outputs: `open`, `select`, `book`.
 *
 * No store, no HTTP. Caller passes data and listens to events.
 */
@Component({
  selector: 'mh-session-card',
  standalone: true,
  imports: [CommonModule, AccessChip, TypeChip, ProviderChip, CapacityBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-card.html',
  styleUrl: './session-card.scss',
})
export class SessionCard {
  @Input({ required: true }) instance!:
    | SessionInstance
    | PublicSessionInstance
    | BlockedSessionInstance;

  @Input() variant:
    | 'list-card'
    | 'mine-row'
    | 'showcase'
    | 'mobile'
    | 'related'
    | 'calendar-popover' = 'list-card';

  @Input() selectable: boolean = false;
  @Input() selected: boolean = false;
  @Input() showCTA: boolean = true;
  @Input() ctaLabel?: string;
  @Input() eligibility?: 'eligible' | 'not-eligible' | 'blocked';

  @Output() open = new EventEmitter<void>();
  @Output() select = new EventEmitter<boolean>();
  @Output() book = new EventEmitter<void>();

  // ─── Type guards / accessors ───────────────────────────────────────

  protected isBlocked(): boolean {
    return (
      this.instance != null &&
      (this.instance as BlockedSessionInstance).isBlocked === true
    );
  }

  protected title(): string {
    if (this.isBlocked()) {
      return (this.instance as BlockedSessionInstance).template.title;
    }
    const inst = this.instance as SessionInstance | PublicSessionInstance;
    return inst.titleOverride ?? inst.template?.title ?? '(untitled)';
  }

  protected access(): SessionAccess {
    if (this.isBlocked()) {
      return (this.instance as BlockedSessionInstance).template.access;
    }
    return (this.instance as SessionInstance | PublicSessionInstance)
      .template!.access;
  }

  protected isOnline(): boolean {
    if (this.isBlocked()) return false;
    const inst = this.instance as SessionInstance | PublicSessionInstance;
    return inst.template?.locationKind === 'ONLINE';
  }

  /**
   * True when the underlying template is a recurring series. The eager-
   * loaded `instance.template` from `/sessions/instances` omits the
   * `isRecurring` flag in V1, so we infer from `occurrenceIndex > 0` —
   * any instance past index 0 is definitionally part of a series.
   * Combined with the explicit flag when present.
   */
  protected isRecurring(): boolean {
    if (this.isBlocked()) return false;
    const inst = this.instance as SessionInstance | PublicSessionInstance;
    if (inst.template && 'isRecurring' in inst.template) {
      return inst.template.isRecurring === true;
    }
    return inst.occurrenceIndex > 0;
  }

  protected startAt(): Date {
    return new Date(this.instance.startAt);
  }

  protected durationMinutes(): number {
    if (this.isBlocked()) {
      return (this.instance as BlockedSessionInstance).template
        .durationMinutes;
    }
    return (this.instance as SessionInstance | PublicSessionInstance).template!
      .durationMinutes;
  }

  protected signups(): number {
    if (this.isBlocked()) return 0;
    return (this.instance as SessionInstance | PublicSessionInstance)
      .confirmedCount;
  }

  protected capacity(): number | null {
    if (this.isBlocked()) return null;
    const inst = this.instance as SessionInstance | PublicSessionInstance;
    return inst.capacityOverride ?? inst.template?.capacity ?? null;
  }

  protected approvalRequired(): boolean {
    if (this.isBlocked()) return false;
    return (this.instance as SessionInstance | PublicSessionInstance).template!
      .approvalRequired;
  }

  /** Color used for the left border stripe (teal = online, primary = in-person). */
  protected stripeColor(): string {
    return this.isOnline() ? 'var(--p-cyan-500, #14B8A6)' : 'var(--p-primary-500)';
  }

  // ─── CTA selection ─────────────────────────────────────────────────

  /**
   * Compute the CTA based on access + eligibility + approvalRequired.
   * If `ctaLabel` was passed in, it overrides this.
   */
  protected ctaText(): string {
    if (this.ctaLabel) return this.ctaLabel;
    if (this.isBlocked()) return 'Members only';
    if (this.eligibility === 'not-eligible') {
      return this.access() === 'CLIENTS_ONLY' ? 'Become a client' : 'Members only';
    }
    if (this.approvalRequired()) return 'Request to book';
    return 'Book';
  }

  protected ctaDisabled(): boolean {
    if (this.isBlocked()) return true;
    return this.eligibility === 'not-eligible' || this.eligibility === 'blocked';
  }

  // ─── Event handlers ────────────────────────────────────────────────

  protected onOpen(): void {
    this.open.emit();
  }

  protected onBook(e: Event): void {
    e.stopPropagation();
    if (this.ctaDisabled()) return;
    this.book.emit();
  }

  protected onSelectToggle(e: Event): void {
    e.stopPropagation();
    const next = !this.selected;
    this.selected = next;
    this.select.emit(next);
  }
}
