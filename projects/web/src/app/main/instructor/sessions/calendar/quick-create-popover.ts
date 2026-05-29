import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { VenueService } from 'core';
import type { CreateTemplateRequest, SessionKind, Venue } from 'core';

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
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    Select,
  ],
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

        <!-- Location: segmented toggle ONLINE/IN_PERSON. In-person opens
             a venue picker right below — the instructor's saved venues
             only; "Add new" is left to the full form. -->
        <div class="mh-qcp__where">
          <div class="mh-qcp__seg" role="radiogroup" aria-label="Location">
            <button
              type="button"
              class="mh-qcp__seg-btn"
              [class.is-active]="locationKind() === 'ONLINE'"
              (click)="selectLocation('ONLINE')"
            >
              <i class="pi pi-video" aria-hidden="true"></i> Online
            </button>
            <button
              type="button"
              class="mh-qcp__seg-btn"
              [class.is-active]="locationKind() === 'IN_PERSON'"
              (click)="selectLocation('IN_PERSON')"
            >
              <i class="pi pi-map-marker" aria-hidden="true"></i> In-person
            </button>
          </div>

          @if (locationKind() === 'IN_PERSON') {
            <p-select
              [options]="venues()"
              optionLabel="name"
              optionValue="id"
              [ngModel]="selectedVenueId()"
              (ngModelChange)="selectedVenueId.set($event)"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Pick a venue"
              [showClear]="true"
              appendTo="body"
              styleClass="mh-qcp__venue"
              fluid
            />
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

    /* Location segmented toggle + (conditional) venue picker below. */
    .mh-qcp__where {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mh-qcp__seg {
      display: inline-flex;
      background: var(--p-surface-100);
      border-radius: 8px;
      padding: 2px;
      gap: 2px;
    }
    .mh-qcp__seg-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: var(--p-text-muted-color);
      i { font-size: 11px; }
      &.is-active {
        background: var(--p-content-background);
        color: var(--p-text-color);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
    }
  `,
})
export class QuickCreatePopover implements OnInit {
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

  /** Location toggle — ONLINE skips the venue picker; IN_PERSON shows it. */
  protected readonly locationKind = signal<'ONLINE' | 'IN_PERSON'>('ONLINE');
  /** Instructor's saved venues — loaded once on init. */
  protected readonly venues = signal<Venue[]>([]);
  protected readonly selectedVenueId = signal<string | null>(null);

  private readonly _fb = inject(FormBuilder);
  private readonly _venueService = inject(VenueService);
  protected readonly form = this._fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    // Best-effort venue list — on error we just hide the dropdown.
    this._venueService.list().subscribe({
      next: (vs) => this.venues.set(vs),
      error: () => this.venues.set([]),
    });
  }

  protected selectLocation(kind: 'ONLINE' | 'IN_PERSON'): void {
    this.locationKind.set(kind);
    if (kind === 'ONLINE') this.selectedVenueId.set(null);
  }

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
    const kind = this.locationKind();
    const venueId = this.selectedVenueId();
    return {
      title,
      type: this.selectedType(),
      // Default access depends on type — Open type → OPEN, Group/Private
      // start CLIENTS_ONLY (more conservative; user can change in full form).
      access: this.selectedType() === 'OPEN' ? 'OPEN' : 'CLIENTS_ONLY',
      locationKind: kind,
      // For IN_PERSON we pass through the picked venue; the BE still
      // requires `meetingUrl` for ONLINE so the full form catches that.
      ...(venueId ? { venueId } : {}),
      durationMinutes: this.minutes(),
      timezone: this.defaultTimezone,
      isRecurring: false,
      firstStartAt: this.range.start.toISOString(),
    };
  }
}
