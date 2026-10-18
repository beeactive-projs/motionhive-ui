import { Component, model, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ActionSheet } from '../../../../_shared/components/action-sheet/action-sheet';
import { CREATE_OPTIONS, CreateChoice } from '../../programs.config';

/**
 * The one place anything gets created in the library.
 *
 * Three verbs behind a single button rather than three competing controls in
 * the header — see `CREATE_OPTIONS`. The parent navigates on the choice, which
 * is safe because the action sheet only reports it once it has actually gone.
 */
@Component({
  selector: 'mh-create-sheet',
  imports: [ActionSheet, TranslatePipe],
  templateUrl: './create-sheet.html',
})
export class CreateSheet {
  readonly open = model(false);

  readonly choose = output<CreateChoice>();

  readonly options = CREATE_OPTIONS;
}
