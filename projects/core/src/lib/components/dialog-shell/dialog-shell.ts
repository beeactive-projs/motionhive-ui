import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  booleanAttribute,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';

/**
 * `mh-dialog-shell` — the standard wrapper around `p-dialog`.
 *
 * Solves three pre-existing inconsistencies in the codebase in one place:
 *
 *   1. `[appendTo]="'body'"` — always set. Without it `p-dialog` renders
 *      inside the activating component, which breaks z-index over
 *      `position: fixed` headers and traps focus inside the wrong root.
 *   2. ESC closes — wired via `(visibleChange)` so callers don't have
 *      to manually listen.
 *   3. Submit-disable while pending — every dialog with a primary action
 *      passes `[isSubmitting]="true"` while an HTTP call is in flight;
 *      the shell exposes this to its footer slot so consumers can
 *      disable buttons consistently.
 *
 * Slots:
 *   - `<ng-content select="[header]">` — title and any header chrome.
 *   - `<ng-content>` — body content.
 *   - `<ng-content select="[footer]">` — action buttons.
 *
 * Reusability: zero domain knowledge. Used by every sessions dialog
 * (8 of them) and immediately adoptable by any future module.
 */
@Component({
  selector: 'mh-dialog-shell',
  standalone: true,
  imports: [CommonModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="onVisibleChange($event)"
      [modal]="modal"
      [draggable]="false"
      [resizable]="false"
      [closable]="closable"
      [dismissableMask]="dismissableMask"
      [closeOnEscape]="closeOnEscape"
      [style]="{ width: width, maxWidth: maxWidth }"
      [appendTo]="'body'"
      [styleClass]="'mh-dialog-shell'"
    >
      <ng-template #header>
        <div class="mh-dialog-shell__header">
          <ng-content select="[header]"></ng-content>
        </div>
      </ng-template>

      <div class="mh-dialog-shell__body">
        <ng-content></ng-content>
      </div>

      <ng-template #footer>
        <div class="mh-dialog-shell__footer" [class.is-submitting]="isSubmitting">
          <ng-content select="[footer]"></ng-content>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host { display: contents; }
    .mh-dialog-shell__header { display: flex; align-items: center; gap: 12px; }
    .mh-dialog-shell__body { padding: 4px 0; }
    .mh-dialog-shell__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 12px;
    }
    .mh-dialog-shell__footer.is-submitting {
      opacity: 0.7;
      pointer-events: none;
    }
  `,
})
export class DialogShell {
  @Input({ transform: booleanAttribute }) visible = false;
  @Input({ transform: booleanAttribute }) modal = true;
  @Input({ transform: booleanAttribute }) closable = true;
  @Input({ transform: booleanAttribute }) dismissableMask = true;
  @Input({ transform: booleanAttribute }) closeOnEscape = true;
  @Input({ transform: booleanAttribute }) isSubmitting = false;
  @Input() width = '90vw';
  @Input() maxWidth = '640px';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  protected onVisibleChange(next: boolean): void {
    this.visibleChange.emit(next);
    if (!next) this.closed.emit();
  }

  /**
   * Final safety net — block ESC while a submission is in flight.
   * `[closeOnEscape]="false"` would work too but feels over-restrictive;
   * we only block during pending state.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(e: Event): void {
    if (this.isSubmitting) {
      e.stopPropagation();
      e.preventDefault();
    }
  }
}
