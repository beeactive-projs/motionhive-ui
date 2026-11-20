import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  IonIcon,
  IonItem,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonTextarea,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';

import {
  ASSIGNMENT_STATUS_MESSAGE_MAX,
  ProgramAssignment,
  ProgramAssignmentStatus,
} from 'core';

import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import {
  EndPlanChoice,
  EndPlanChoices,
  endPlanChoices,
  endPlanClientName,
  endPlanStatus,
  endPlanSubtitle,
  isDestructiveChoice,
} from './end-plan.config';

/** What the sheet asks its page to send. */
export interface EndPlanRequest {
  status: ProgramAssignmentStatus;
  /** The coach's words for the client, trimmed; absent when they wrote none. */
  message?: string;
}

/** The i18n keys of one choice: its row and its confirm button. */
const CHOICE_KEYS: Record<EndPlanChoice, { title: string; detail: string; confirm: string }> = {
  [EndPlanChoices.Pause]: {
    title: 'programs.endPlan.pause.title',
    detail: 'programs.endPlan.pause.detail',
    confirm: 'programs.endPlan.pause.confirm',
  },
  [EndPlanChoices.Finish]: {
    title: 'programs.endPlan.finish.title',
    detail: 'programs.endPlan.finish.detail',
    confirm: 'programs.endPlan.finish.confirm',
  },
  [EndPlanChoices.Cancel]: {
    title: 'programs.endPlan.cancel.title',
    detail: 'programs.endPlan.cancel.detail',
    confirm: 'programs.endPlan.cancel.confirm',
  },
};

/**
 * Stop a client's plan: pause it, mark it finished, or cancel it (design
 * EndPlan). Each row says what happens to the client's days, the coach can
 * add a message, and the sheet says the client is told: the API sends the
 * notification once the change is saved.
 *
 * The confirm button names the choice and turns red for Cancel, the one
 * that cannot be undone. The page sends the request and closes the sheet
 * when it succeeds; on a failure everything stays filled in.
 */
@Component({
  selector: 'mh-end-plan-sheet',
  imports: [
    IonIcon,
    IonItem,
    IonList,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonTextarea,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './end-plan-sheet.html',
  styleUrl: './end-plan-sheet.scss',
})
export class EndPlanSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly assignment = input<ProgramAssignment | null>(null);
  /** True while the page's request is out. */
  readonly saving = input(false);

  readonly confirm = output<EndPlanRequest>();

  readonly messageMax = ASSIGNMENT_STATUS_MESSAGE_MAX;
  readonly choice = signal<EndPlanChoice | null>(null);
  readonly message = signal('');

  /** "Anna", the name every line of the sheet uses. */
  readonly clientName = computed(() => {
    const row = this.assignment();
    const fallback = this._translateService.instant('programs.common.clientFallback');
    if (!row) {
      return fallback;
    }
    return endPlanClientName(row, fallback);
  });

  readonly title = computed(() =>
    this._translateService.instant('programs.endPlan.title', { name: this.clientName() }),
  );

  readonly subtitle = computed(() => {
    const row = this.assignment();
    if (!row) {
      return '';
    }
    return endPlanSubtitle(row, new Date());
  });

  readonly options = computed(() => {
    const row = this.assignment();
    if (!row) {
      return [];
    }
    const params = { name: this.clientName(), percent: row.completionPercent };
    return endPlanChoices(row.status).map((value) => ({
      value,
      title: this._translateService.instant(CHOICE_KEYS[value].title),
      detail: this._translateService.instant(CHOICE_KEYS[value].detail, params),
      danger: isDestructiveChoice(value),
    }));
  });

  readonly confirmLabel = computed(() => {
    const choice = this.choice();
    if (!choice) {
      return '';
    }
    return this._translateService.instant(CHOICE_KEYS[choice].confirm);
  });

  readonly confirmColor = computed(() => {
    const choice = this.choice();
    if (choice && isDestructiveChoice(choice)) {
      return 'danger';
    }
    return 'primary';
  });

  readonly messageLabel = computed(
    () =>
      this._translateService.instant('programs.endPlan.message', { name: this.clientName() }) +
      ' ' +
      this._translateService.instant('form.hint.optional'),
  );

  readonly notice = computed(() =>
    this._translateService.instant('programs.endPlan.notice', { name: this.clientName() }),
  );

  constructor() {
    addIcons({ notificationsOutline });
    // Every opening starts on the first choice with an empty message: the
    // last plan's words must never go to the next client.
    effect(() => {
      if (!this.open()) {
        return;
      }
      const first = this.options()[0];
      if (first) {
        this.choice.set(first.value);
      } else {
        this.choice.set(null);
      }
      this.message.set('');
    });
  }

  pick(value: unknown): void {
    const allowed = this.options().map((option) => option.value);
    const match = allowed.find((option) => option === value);
    if (match) {
      this.choice.set(match);
    }
  }

  submit(): void {
    const choice = this.choice();
    if (!choice || this.saving()) {
      return;
    }
    const message = this.message().trim();
    const request: EndPlanRequest = { status: endPlanStatus(choice) };
    if (message) {
      request.message = message;
    }
    this.confirm.emit(request);
  }
}
