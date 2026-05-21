import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  InputSignal,
  OutputEmitterRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * `mh-bottom-sheet` — the mobile-first overlay primitive used for
 * create / cancel / filter / month-picker flows on phones.
 *
 * Shape (from "MotionHive – Sessions on mobile" design):
 *   ┌──── drag handle ────┐
 *   │  Title    [x close] │  ← sticky head
 *   ├─────────────────────┤
 *   │   body scrolls       │
 *   ├─────────────────────┤
 *   │  Cancel    Primary  │  ← sticky foot
 *   └─────────────────────┘
 *
 * Three slots:
 *   - `[head-actions]`  — extra controls on the right of the title row
 *                          (Reset link, ⋮ menu, etc.). Optional.
 *   - default            — body (scrollable).
 *   - `[foot]`           — sticky footer row (Cancel + primary CTA).
 *                          Optional. If omitted no foot bar renders.
 *
 * Sizing: 'small'=40% / 'medium'=60% / 'large'=90% of viewport.
 * The body grows as needed inside that envelope.
 *
 * Dismiss paths:
 *   - tap backdrop (unless [closeOnBackdrop]="false")
 *   - press Esc    (unless [closeOnEscape]="false")
 *   - tap close button in the head (built-in)
 *   - drag the handle down past ~80px (TODO — first cut uses backdrop)
 *
 * The component never renders unless `open` is true. Body-scroll
 * is locked while a sheet is open so the page underneath doesn't
 * scroll when the user pans inside the sheet.
 */
@Component({
  selector: 'mh-bottom-sheet',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="mh-bs"
        [class.mh-bs--small]="size() === 'small'"
        [class.mh-bs--medium]="size() === 'medium'"
        [class.mh-bs--large]="size() === 'large'"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || 'Bottom sheet'"
      >
        <div
          class="mh-bs__backdrop"
          (click)="onBackdrop()"
          aria-hidden="true"
        ></div>
        <div class="mh-bs__sheet">
          @if (showHandle()) {
            <div class="mh-bs__handle" aria-hidden="true"></div>
          }
          @if (title() || subtitle() || showClose()) {
            <header class="mh-bs__head" [class.mh-bs__head--no-text]="!title() && !subtitle()">
              <div class="mh-bs__head-text">
                @if (title()) {
                  <h3>{{ title() }}</h3>
                }
                @if (subtitle()) {
                  <p class="mh-bs__sub">{{ subtitle() }}</p>
                }
              </div>
              <div class="mh-bs__head-actions">
                <ng-content select="[head-actions]"></ng-content>
                @if (showClose()) {
                  <button
                    type="button"
                    class="mh-bs__close"
                    (click)="dismissNow()"
                    aria-label="Close"
                  >
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                }
              </div>
            </header>
          }
          <div class="mh-bs__body">
            <ng-content></ng-content>
          </div>
          <footer class="mh-bs__foot">
            <ng-content select="[foot]"></ng-content>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    .mh-bs {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      pointer-events: auto;
    }

    .mh-bs__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(20, 18, 12, 0.45);
      animation: mh-bs-fade-in 180ms ease-out;
    }

    .mh-bs__sheet {
      position: relative;
      background: var(--p-content-background);
      color: var(--p-text-color);
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      animation: mh-bs-slide-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
      max-height: 90vh;
      padding-bottom: env(safe-area-inset-bottom, 0);
      width: 100%;
    }
    /* Desktop: cap width and center so the sheet doesnt stretch the
       full viewport when accidentally triggered. Mobile sheets are
       the primary use; desktop should usually be a p-dialog instead. */
    @media (min-width: 601px) {
      .mh-bs__sheet {
        max-width: 520px;
        align-self: center;
        border-radius: 16px;
        margin-bottom: 24px;
      }
      .mh-bs { justify-content: center; }
    }
    .mh-bs--small .mh-bs__sheet  { max-height: 50vh; }
    .mh-bs--medium .mh-bs__sheet { max-height: 70vh; }
    .mh-bs--large .mh-bs__sheet  { max-height: 92vh; }

    .mh-bs__handle {
      width: 36px;
      height: 4px;
      border-radius: 999px;
      background: var(--p-surface-300);
      margin: 8px auto 4px;
      flex-shrink: 0;
    }

    .mh-bs__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 16px 12px;
      border-bottom: 1px solid var(--p-content-border-color);
      flex-shrink: 0;
    }
    .mh-bs__head-text { min-width: 0; flex: 1; }
    .mh-bs__head-text h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--p-text-color);
    }
    .mh-bs__sub {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--p-text-muted-color);
    }
    .mh-bs__head-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .mh-bs__close {
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 50%;
      background: var(--p-surface-100);
      color: var(--p-text-muted-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      i { font-size: 12px; }
      &:hover { background: var(--p-surface-200); }
    }

    .mh-bs__body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 14px 16px;
      min-height: 0;
    }

    .mh-bs__foot {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
      flex-shrink: 0;
    }
    /* Auto-hide foot when nothing is projected. Saves callers from
       having to pass [hasFoot]="false" — the slot is its own source
       of truth. */
    .mh-bs__foot:empty { display: none; }
    /* Variant: head without text — only the close × shows, anchored right. */
    .mh-bs__head--no-text { padding-bottom: 8px; border-bottom: none; }
    .mh-bs__head--no-text .mh-bs__head-text { display: none; }

    @keyframes mh-bs-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes mh-bs-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `,
})
export class BottomSheet {
  /** Controls the sheet's visibility. Two-way via `openChange`. */
  readonly open: InputSignal<boolean> = input.required<boolean>();

  /** Sheet height envelope. */
  readonly size: InputSignal<'small' | 'medium' | 'large'> = input<
    'small' | 'medium' | 'large'
  >('large');

  /** Optional title rendered in the head. Omit for action-sheet mode. */
  readonly title = input<string>('');
  readonly subtitle = input<string>('');

  /** Visual drag handle on top. Default true. */
  readonly showHandle = input(true);

  /** Tap-outside-to-dismiss. Default true. */
  readonly closeOnBackdrop = input(true);

  /** Press-Esc-to-dismiss. Default true. */
  readonly closeOnEscape = input(true);

  /** Built-in close × button in the head. Default true. */
  readonly showClose = input(true);

  /** Emits when the sheet wants to close (backdrop, Esc, close button). */
  readonly openChange: OutputEmitterRef<boolean> = output<boolean>();
  readonly dismiss = output<void>();

  private readonly _doc = inject(DOCUMENT);

  constructor() {
    // Body-scroll lock while open. Restores on close + on destroy.
    effect((onCleanup) => {
      const isOpen = this.open();
      if (!isOpen) return;
      const prev = this._doc.body.style.overflow;
      this._doc.body.style.overflow = 'hidden';
      onCleanup(() => {
        this._doc.body.style.overflow = prev;
      });
    });
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (!this.open() || !this.closeOnEscape()) return;
    this.dismissNow();
  }

  protected onBackdrop(): void {
    if (!this.closeOnBackdrop()) return;
    this.dismissNow();
  }

  protected dismissNow(): void {
    this.dismiss.emit();
    this.openChange.emit(false);
  }
}
