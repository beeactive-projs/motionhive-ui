import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import type { CreateTemplateRequest, SessionKind } from 'core';

/**
 * Drag-to-create popover.
 *
 * Rendered when the user drags across empty calendar cells. Holds a
 * minimal form (title + type + location summary) — the full create
 * dialog (Phase E) handles every other field.
 *
 * Inputs:
 *   - `range` — start/end times from the drag
 *   - `anchor` — pixel coordinates near the drag-end for positioning
 *
 * Outputs:
 *   - `openFullForm(payload)` — quick-create only collects title + type;
 *     the caller opens the full form dialog with the partial pre-filled
 *     so the user can complete meeting URL / venue / approval rules
 *   - `dismiss()` — close without action
 *
 * Note: we intentionally do NOT expose an Output named `submit` —
 * Angular's host-binding for `(submit)` would also catch the native
 * form submit event bubbling from `<form>`, causing the parent to
 * receive a SubmitEvent instead of the typed payload.
 */
@Component({
  selector: 'mh-quick-create-popover',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mh-qcp"
      [style.left.px]="anchor.x"
      [style.top.px]="anchor.y"
      role="dialog"
      aria-label="Quick create session"
    >
      <div class="mh-qcp__head">
        <span class="mh-qcp__eyebrow">
          {{ range.start | date: 'EEE d MMM · HH:mm' : '' : 'en-GB' }}
          –
          {{ range.end | date: 'HH:mm' : '' : 'en-GB' }}
          ·
          {{ minutes() }} min
        </span>
        <button
          type="button"
          class="mh-qcp__close"
          (click)="dismiss.emit()"
          aria-label="Dismiss"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="mh-qcp__form">
        <input
          pInputText
          type="text"
          formControlName="title"
          placeholder="Session title"
          autofocus
          maxlength="255"
          aria-label="Session title"
        />

        <div class="mh-qcp__types" role="radiogroup" aria-label="Type">
          @for (opt of typeOptions; track opt.value) {
            <button
              type="button"
              role="radio"
              class="mh-qcp__type"
              [class.is-active]="selectedType() === opt.value"
              [attr.aria-checked]="selectedType() === opt.value"
              (click)="selectType(opt.value)"
            >
              <i [class]="opt.icon" aria-hidden="true"></i>
              <span>{{ opt.label }}</span>
            </button>
          }
        </div>

        <div class="mh-qcp__footer">
          <p-button
            label="Open full form"
            [text]="true"
            size="small"
            icon="pi pi-arrow-up-right"
            (click)="onOpenFull()"
          />
          <p-button
            label="Cancel"
            severity="secondary"
            [outlined]="true"
            size="small"
            (click)="dismiss.emit()"
          />
          <p-button
            type="submit"
            label="Create"
            size="small"
            icon="pi pi-check"
            [disabled]="form.invalid"
          />
        </div>
      </form>
    </div>
  `,
  styles: `
    .mh-qcp {
      /* AUDIT FIX (Phase C Bug 6): use position:fixed so the anchor */
      /* coords (clientX/Y, viewport-relative) resolve correctly even */
      /* when the calendar sits inside a scrollable parent. */
      position: fixed;
      width: 320px;
      padding: 14px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      z-index: 100;
    }
    .mh-qcp__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .mh-qcp__eyebrow {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .mh-qcp__close {
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      color: var(--p-text-muted-color);
      cursor: pointer;
      border-radius: 4px;
      &:hover { background: var(--p-surface-100); }
    }
    .mh-qcp__form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mh-qcp__form input[pInputText] {
      width: 100%;
    }
    .mh-qcp__types {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .mh-qcp__type {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      border: 1px solid var(--p-content-border-color);
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      color: var(--p-text-muted-color);
      transition: all 120ms ease;
      i { font-size: 14px; }
      &:hover { background: color-mix(in srgb, var(--p-text-color) 4%, transparent); }
      &.is-active {
        background: var(--p-primary-50);
        border-color: var(--p-primary-500);
        color: var(--p-primary-700);
      }
    }
    .mh-qcp__footer {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 4px;
    }
  `,
})
export class QuickCreatePopover {
  @Input({ required: true }) range!: { start: Date; end: Date };
  @Input() anchor: { x: number; y: number } = { x: 0, y: 0 };
  @Input() defaultTimezone: string = 'Europe/Bucharest';

  @Output() openFullForm = new EventEmitter<CreateTemplateRequest>();
  @Output() dismiss = new EventEmitter<void>();

  protected readonly selectedType = signal<SessionKind>('GROUP');
  protected readonly typeOptions: { value: SessionKind; label: string; icon: string }[] = [
    { value: 'GROUP', label: 'Group', icon: 'pi pi-users' },
    { value: 'PRIVATE', label: '1-on-1', icon: 'pi pi-user' },
    { value: 'OPEN', label: 'Open', icon: 'pi pi-globe' },
  ];

  private readonly _fb = inject(FormBuilder);
  protected readonly form = this._fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
  });

  protected minutes(): number {
    return Math.max(
      0,
      Math.round((this.range.end.getTime() - this.range.start.getTime()) / 60_000),
    );
  }

  protected selectType(t: SessionKind): void {
    this.selectedType.set(t);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    // Quick-create is intentionally hand-off only: the popover does not
    // collect the meeting URL / venue / approval rules the BE requires.
    // Route through the same "open full form pre-filled" path as the
    // explicit secondary button so the user gets a usable form.
    this.openFullForm.emit(this._buildPayload());
  }

  protected onOpenFull(): void {
    // Pass whatever the user typed so far — even if invalid, Phase E
    // dialog re-validates.
    this.openFullForm.emit(this._buildPayload());
  }

  private _buildPayload(): CreateTemplateRequest {
    const title = (this.form.value.title ?? '').trim();
    return {
      title,
      type: this.selectedType(),
      // Default access depends on type — Open type → OPEN, Group/Private
      // start CLIENTS_ONLY (more conservative; user can change in full form).
      access: this.selectedType() === 'OPEN' ? 'OPEN' : 'CLIENTS_ONLY',
      // Quick-create can't capture a meeting URL or a venue — both are
      // required by the BE depending on locationKind. The full form
      // collects them. The "Save" button is therefore a hand-off that
      // emits the partial payload; the parent must open the full form
      // to complete it.
      locationKind: 'ONLINE',
      durationMinutes: this.minutes(),
      timezone: this.defaultTimezone,
      isRecurring: false,
      firstStartAt: this.range.start.toISOString(),
    };
  }
}
