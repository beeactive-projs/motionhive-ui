import { enumLabel } from 'core';
import {
  alertCircleOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  locationOutline,
  mailOutline,
  ribbonOutline,
  starOutline,
  timeOutline,
} from 'ionicons/icons';

/** Every icon this screen renders, registered in one place. */
export const PERSON_ICONS = {
  alertCircleOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  locationOutline,
  mailOutline,
  ribbonOutline,
  starOutline,
  timeOutline,
};

/**
 * A role as the profile screens name it — `INSTRUCTOR` is "Coach".
 * `displayRoles` arrives as raw role names, with USER already filtered out
 * server-side.
 */
export function roleLabel(role: string): string {
  return enumLabel('userRole', role);
}
