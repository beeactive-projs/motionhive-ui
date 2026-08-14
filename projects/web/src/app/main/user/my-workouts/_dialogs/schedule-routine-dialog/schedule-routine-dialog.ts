import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleButton } from 'primeng/togglebutton';

import { ProgramAssignmentService, Routine, showApiError } from 'core';

/** ISO 8601: 1 = Monday through 7 = Sunday, matching the API. */
const WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

/**
 * `mh-schedule-routine-dialog` — put one of your own routines on the
 * calendar.
 *
 * This is the whole multi-week feature for someone without a coach:
 * which routine, which days, rolling or a fixed block. No periodisation
 * builder — that stays a coach's job, and is most of why you'd hire one.
 */
@Component({
  selector: 'mh-schedule-routine-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonDirective,
    Dialog,
    InputNumber,
    SelectButton,
    ToggleButton,
  ],
  providers: [MessageService],
  templateUrl: './schedule-routine-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleRoutineDialog {
  readonly routine = input.required<Routine | null>();
  readonly visible = model<boolean>(false);
  readonly scheduled = output<void>();

  private readonly _service = inject(ProgramAssignmentService);
  private readonly _messageService = inject(MessageService);

  readonly weekdays = WEEKDAYS;
  readonly selectedDays = signal<number[]>([]);
  readonly repeatMode = signal<'WEEKLY' | 'BLOCK'>('WEEKLY');
  readonly repeatWeeks = signal<number>(4);
  readonly submitting = signal(false);

  readonly repeatOptions = [
    { label: 'Every week', value: 'WEEKLY' as const },
    { label: 'For a block', value: 'BLOCK' as const },
  ];

  readonly canSubmit = computed(
    () => this.selectedDays().length > 0 && !this.submitting(),
  );

  /** Plain-language echo of the choice, so nobody has to infer it. */
  readonly summary = computed(() => {
    const days = this.selectedDays();
    if (!days.length) return 'Pick at least one day.';
    const names = WEEKDAYS.filter((d) => days.includes(d.iso))
      .map((d) => d.label)
      .join(', ');
    return this.repeatMode() === 'BLOCK'
      ? `${names}, for ${this.repeatWeeks()} week${this.repeatWeeks() === 1 ? '' : 's'}.`
      : `${names}, every week.`;
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.selectedDays.set([]);
        this.repeatMode.set('WEEKLY');
        this.repeatWeeks.set(4);
      }
    });
  }

  toggleDay(iso: number, on: boolean): void {
    this.selectedDays.update((cur) =>
      on ? [...cur, iso].sort((a, b) => a - b) : cur.filter((d) => d !== iso),
    );
  }

  isDaySelected(iso: number): boolean {
    return this.selectedDays().includes(iso);
  }

  cancel(): void {
    if (this.submitting()) return;
    this.visible.set(false);
  }

  submit(): void {
    const r = this.routine();
    if (!r || !this.canSubmit()) return;

    this.submitting.set(true);
    this._service
      .scheduleRoutine({
        programId: r.id,
        daysOfWeek: this.selectedDays(),
        repeatMode: this.repeatMode(),
        ...(this.repeatMode() === 'BLOCK'
          ? { repeatWeeks: this.repeatWeeks() }
          : {}),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Added to your week',
            detail: `${r.name} is on your schedule.`,
            life: 3000,
          });
          this.scheduled.emit();
          this.visible.set(false);
        },
        error: (err) => {
          this.submitting.set(false);
          showApiError(
            this._messageService,
            "Couldn't schedule that routine",
            'Please try again.',
            err,
          );
        },
      });
  }
}
