/**
 * Lead-capture payload for the public "Reach out to <Name>" dialog on
 * the instructor profile. Available to guests — this is the only
 * action that intentionally skips the signup wall.
 *
 * POSTed to `/profile/instructor-leads`. Stores a lead row server-side
 * and notifies the instructor via email / in-app notification.
 */
export interface InstructorLeadPayload {
  instructorUserId: string;
  name: string;
  email: string;
  /** E.164 format if present (use the existing `<mh-phone-input>` for validation). */
  phone?: string;
  goal: LeadGoal;
  level: LeadLevel;
  format: LeadFormat;
  message?: string;
  /** Where the lead originated — useful for analytics and email subject lines. */
  source?: 'profile' | 'share-link' | 'qr';
}

export const LeadGoal = {
  FatLoss: 'fat-loss',
  Muscle: 'muscle',
  Mobility: 'mobility',
  Endurance: 'endurance',
  PrePostNatal: 'pre-post-natal',
  FeelBetter: 'feel-better',
} as const;
export type LeadGoal = typeof LeadGoal[keyof typeof LeadGoal];

export const LeadLevel = {
  New: 'new',
  Casual: 'casual',
  Consistent: 'consistent',
  Athlete: 'athlete',
} as const;
export type LeadLevel = typeof LeadLevel[keyof typeof LeadLevel];

export const LeadFormat = {
  Online: 'online',
  InPerson: 'in-person',
  Hybrid: 'hybrid',
  Either: 'either',
} as const;
export type LeadFormat = typeof LeadFormat[keyof typeof LeadFormat];
