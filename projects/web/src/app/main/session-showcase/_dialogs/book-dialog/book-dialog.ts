import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import {
  BookResponse,
  PublicSessionInstance,
  SessionService,
  showApiError,
} from 'core';

/**
 * `mh-book-dialog` — confirms a booking for a public session instance.
 *
 * Shows the snapshot terms (price, cancel cutoff) so the user
 * acknowledges what they're committing to. Optional `bookingNote`
 * surfaces a text field for instructors who require approval.
 */
@Component({
  selector: 'mh-book-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, ButtonModule, TextareaModule],
  template: `
    <p-dialog
      header="Confirm booking"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '28rem', maxWidth: '95vw' }"
      [closable]="true"
    >
      @let inst = instance();
      @let tpl = inst?.template;
      <div class="mh-book">
        @if (inst && tpl) {
          <div class="mh-book__hero">
            <span class="mh-book__date">
              {{ inst.startAt | date: 'EEE d MMM' }}
            </span>
            <span class="mh-book__time">
              {{ inst.startAt | date: 'HH:mm' }} – {{ inst.endAt | date: 'HH:mm' }}
            </span>
          </div>
          <h3 class="mh-book__title">{{ inst.titleOverride ?? tpl.title }}</h3>

          <dl class="mh-book__terms">
            <div>
              <dt>Price</dt>
              <dd>
                @if (tpl.priceAmountCents > 0) {
                  {{ tpl.priceAmountCents / 100 | number: '1.0-2' }} {{ tpl.priceCurrency }}
                } @else {
                  Free
                }
              </dd>
            </div>
            <div>
              <dt>Cancel up to</dt>
              <dd>{{ tpl.cancellationCutoffHours }}h before start</dd>
            </div>
            @if (tpl.approvalRequired) {
              <div class="mh-book__terms-full">
                <dt>Approval</dt>
                <dd>Instructor will review your request.</dd>
              </div>
            }
          </dl>

          @if (tpl.approvalRequired) {
            <div class="mh-book__field">
              <label for="bookNote">Note for the instructor (optional)</label>
              <textarea
                id="bookNote"
                pTextarea
                rows="3"
                fluid
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
                placeholder="Anything they should know about your goals or experience?"
              ></textarea>
            </div>
          }
        }
      </div>

      <ng-template pTemplate="footer">
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="close()"
        />
        <p-button
          [label]="confirmLabel()"
          icon="pi pi-check"
          [loading]="busy()"
          (onClick)="submit()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .mh-book { display: flex; flex-direction: column; gap: 14px; padding-top: 4px; }
    .mh-book__hero {
      display: flex; align-items: baseline; gap: 10px;
      font-weight: 600;
    }
    .mh-book__date {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.02em; color: var(--p-text-muted-color);
    }
    .mh-book__time { font-size: 16px; color: var(--p-primary-700); }
    .mh-book__title {
      margin: 0; font-size: 18px; font-weight: 700;
      color: var(--p-text-color);
    }
    .mh-book__terms {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0;
    }
    .mh-book__terms div { display: flex; flex-direction: column; gap: 2px; }
    .mh-book__terms-full { grid-column: 1 / -1; }
    .mh-book__terms dt {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
    .mh-book__terms dd {
      margin: 0; font-size: 14px; color: var(--p-text-color); font-weight: 600;
    }
    .mh-book__field { display: flex; flex-direction: column; gap: 4px; }
    .mh-book__field label {
      font-size: 12px; font-weight: 600; color: var(--p-text-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDialog {
  private readonly _svc = inject(SessionService);
  private readonly _msg = inject(MessageService);

  readonly visible = model(false);
  readonly instance = input<PublicSessionInstance | null>(null);
  readonly booked = output<BookResponse>();

  readonly note = signal('');
  readonly busy = signal(false);

  private readonly _reset = effect(() => {
    if (this.visible()) this.note.set('');
  });

  protected confirmLabel(): string {
    const tpl = this.instance()?.template;
    if (!tpl) return 'Confirm';
    return tpl.approvalRequired ? 'Request to join' : 'Confirm booking';
  }

  close(): void {
    this.visible.set(false);
  }

  submit(): void {
    const inst = this.instance();
    if (!inst) return;
    this.busy.set(true);
    this._svc
      .book(inst.id, { bookingNote: this.note().trim() || undefined })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.visible.set(false);
          this.booked.emit(res);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          // BE returns 409 Conflict when the user already has a booking
          // that overlaps this instance. Surface that with a clearer
          // wording than "Could not book — Conflict".
          const status = (err as { status?: number })?.status;
          if (status === 409) {
            this._msg.add({
              severity: 'warn',
              summary: 'Time conflict',
              detail:
                'You already have another booking overlapping this session. Cancel that one first, or pick another time.',
              life: 6000,
            });
            return;
          }
          showApiError(this._msg, 'Could not book', 'Please try again.', err);
        },
      });
  }
}
