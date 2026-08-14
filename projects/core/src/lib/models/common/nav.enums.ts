/**
 * Workspace mode — which half of the product the user is currently working in.
 *
 * `coach` surfaces the coaching tools (clients, sessions, programs); `train`
 * surfaces the trainee side (workouts, plans, discover). Only a user who holds
 * the INSTRUCTOR role can switch; everyone else is permanently in `train`.
 *
 * Kept as a const object (not a bare union) so comparisons can go through a
 * named member instead of an inline string literal.
 */
export const NavModes = {
  Coach: 'coach',
  Train: 'train',
} as const;

export type NavMode = (typeof NavModes)[keyof typeof NavModes];
