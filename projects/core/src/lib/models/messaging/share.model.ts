/**
 * Public things sent into a chat as a card (API migration 092,
 * `beeactive-api/docs/research/messaging/SHARE_IN_MESSAGES.md`). Only the
 * type and id travel; each reader's card is drawn by the API from the live
 * row, in the reader's language, with public fields only.
 */
export const ShareTargetType = {
  Session: 'SESSION',
  Group: 'GROUP',
  Coach: 'COACH',
  Exercise: 'EXERCISE',
  Program: 'PROGRAM',
} as const;
export type ShareTargetType = (typeof ShareTargetType)[keyof typeof ShareTargetType];

/**
 * AVAILABLE: drawn in full. ENDED: a session that is over. UNAVAILABLE: gone
 * or no longer public; the card never says which.
 */
export const ShareCardState = {
  Available: 'AVAILABLE',
  Ended: 'ENDED',
  Unavailable: 'UNAVAILABLE',
} as const;
export type ShareCardState = (typeof ShareCardState)[keyof typeof ShareCardState];

export interface ShareRef {
  type: ShareTargetType;
  id: string;
}

export interface SessionShareCard {
  type: 'SESSION';
  state: 'AVAILABLE' | 'ENDED';
  name: string;
  startAt: string;
  endAt: string;
  durationMinutes: number | null;
  timezone: string;
  online: boolean;
  placeName: string | null;
  placeCity: string | null;
  /** Null: no limit. */
  capacity: number | null;
  confirmedCount: number;
  priceCents: number | null;
  currency: string | null;
}

export interface GroupShareCard {
  type: 'GROUP';
  state: 'AVAILABLE';
  name: string;
  logoUrl: string | null;
  city: string | null;
  memberCount: number;
  joinPolicy: string;
}

export interface CoachShareCard {
  type: 'COACH';
  state: 'AVAILABLE';
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  handle: string | null;
  city: string | null;
  takingClients: boolean;
  categoryIds: string[];
}

export interface ExerciseShareCard {
  type: 'EXERCISE';
  state: 'AVAILABLE';
  /** In the reader's language; `originalName` keeps the English. */
  name: string;
  originalName?: string;
  thumbnailUrl: string | null;
  level: string | null;
  kind: string | null;
  primaryMuscles: Array<{ commonName: string }>;
}

export interface ProgramShareCard {
  type: 'PROGRAM';
  state: 'AVAILABLE';
  name: string;
  originalName?: string;
  /** A routine (one repeatable workout) rather than a multi-week program. */
  isSingleWorkout: boolean;
  level: string | null;
  durationDays: number | null;
  workoutCount: number;
  coverImageUrl: string | null;
}

export interface UnavailableShareCard {
  type: ShareTargetType;
  state: 'UNAVAILABLE';
  name: null;
}

export type ShareCard =
  | SessionShareCard
  | GroupShareCard
  | CoachShareCard
  | ExerciseShareCard
  | ProgramShareCard
  | UnavailableShareCard;

/** One shared thing on a message, with the card the reader sees. */
export interface MessageAttachment extends ShareRef {
  card: ShareCard;
}

/** `POST /messaging/shares`: how the share to each person went. */
export interface ShareResult {
  recipientId: string;
  /** WAITING: it went as a message request. */
  status: 'SENT' | 'WAITING' | 'REFUSED';
  conversationId: string | null;
  /** For REFUSED: the API's error key (`messaging.connectionsOnly`, ...). */
  reason: string | null;
}
