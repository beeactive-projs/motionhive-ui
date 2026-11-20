import { ProgramAssignment, translate } from 'core';

import { SheetAction } from '../../../_shared/components/action-sheet/action-sheet.model';
import { canEditCopy } from '../client-copy/client-copy.config';

/** What a plan's ⋯ on the program's Assignments page offers. */
export const PlanOptionIds = {
  /** This client's copy of the plan: its days still to come. */
  EditCopy: 'editCopy',
  /** Pause, finish or cancel it (the end-plan sheet). */
  ChangeStatus: 'changeStatus',
} as const;
export type PlanOptionId = (typeof PlanOptionIds)[keyof typeof PlanOptionIds];

/**
 * The verbs of a plan's ⋯: edit this client's copy (while the plan runs or
 * is paused) and pause, finish or cancel it. A copy is teal, a pause coral
 * (`lists.md`). Labels are keys, the sheet translates them; the copy's
 * carries the client's name, so it is translated here.
 * @Arguments row, clientName
 */
export function planOptionActions(row: ProgramAssignment, clientName: string): SheetAction<PlanOptionId>[] {
  const actions: SheetAction<PlanOptionId>[] = [];
  if (canEditCopy(row.status)) {
    actions.push({
      id: PlanOptionIds.EditCopy,
      label: translate('programs.clientCopy.editCopy', { name: clientName }),
      icon: 'create-outline',
      color: 'teal',
    });
  }
  actions.push({
    id: PlanOptionIds.ChangeStatus,
    label: 'programs.clientCopy.changeStatus',
    icon: 'pause-outline',
    color: 'coral',
  });
  return actions;
}
