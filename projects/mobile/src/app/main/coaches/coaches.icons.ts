import {
  alertCircleOutline,
  chatbubbleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  exitOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';

/**
 * Every icon the coaches screen renders. The page calls `addIcons(COACH_ICONS)`
 * once, so a name in the template can never reference an icon nobody
 * registered — and `coaches.config.spec.ts` fails the build if this drifts
 * from the names the templates actually use, in either direction.
 */
export const COACH_ICONS = {
  alertCircleOutline,
  chatbubbleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  exitOutline,
  peopleOutline,
  personOutline,
};
