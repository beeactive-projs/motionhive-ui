import { TagSeverity } from '../common/ui.enums';
import { ProgramStatus } from './workout.enums';

/**
 * Maps a program status to the PrimeNG Tag severity colour. Single
 * source of truth so the programs list and the program detail render
 * identical colours for the same state (mirrors the payment
 * status-severity pattern).
 *
 * Per the brand rules: statuses are neutral or semantic, never brand
 * amber — Draft is a neutral "still authoring" state, Published is
 * success, Archived is the dark contrast chip.
 */
export function getProgramStatusSeverity(status: ProgramStatus): TagSeverity {
  switch (status) {
    case ProgramStatus.Published:
      return TagSeverity.Success;
    case ProgramStatus.Archived:
      return TagSeverity.Contrast;
    case ProgramStatus.Draft:
    default:
      return TagSeverity.Secondary;
  }
}
