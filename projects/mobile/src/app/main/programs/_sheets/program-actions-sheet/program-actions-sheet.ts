import { Component, computed, inject, input, model, output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { Program } from 'core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { ProgramActionId, visibleProgramActions } from '../../programs.config';

/**
 * The verbs for one program, behind the ⋮ on the builder, under its name and
 * the line that says how big it is and whether it is published.
 *
 * The sheet only reports which verb was chosen; the page owns what it does.
 */
@Component({
  selector: 'mh-program-actions-sheet',
  imports: [ActionSheet],
  templateUrl: './program-actions-sheet.html',
})
export class ProgramActionsSheet {
  private readonly _translateService = inject(TranslateService);

  readonly open = model(false);
  readonly program = input<Program | null>(null);
  /** "4 weeks · 8 days of work · Draft", the same line the builder shows. */
  readonly subtitle = input('');

  readonly action = output<ProgramActionId>();

  readonly title = computed(
    () => this.program()?.name ?? this._translateService.instant('programs.builder.titleFallback'),
  );

  readonly visibleActions = computed(() => {
    const program = this.program();
    return program ? visibleProgramActions(program) : [];
  });
}
