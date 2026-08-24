import { SessionType } from '../models/session/session.enums';

/**
 * Session types — the single source of the words, the colour, and the icons.
 *
 * `tone` is the design canvas's abstract hue, not CSS: honey Group, navy
 * 1-on-1, teal Open. Each platform maps a tone to its own paint — Tailwind
 * wash classes and PrimeNG tokens on web, `--ion-color-*` slots and washes on
 * mobile.
 *
 * Icons are plain name strings in both dialects — `piIcon` for web's
 * PrimeIcons, `ionIcon` for mobile's ionicons. Core imports neither icon
 * system, so carrying both names costs nothing and keeps the two apps
 * pointing the same glyph at the same idea.
 */
export type SessionTypeTone = 'honey' | 'navy' | 'teal';

export interface SessionTypeMeta {
  label: string;
  tone: SessionTypeTone;
  /** PrimeIcons class for web surfaces. */
  piIcon: string;
  /** ionicons name for mobile surfaces — must be registered via `addIcons`. */
  ionIcon: string;
}

export const SESSION_TYPES: Record<SessionType, SessionTypeMeta> = {
  [SessionType.Group]: {
    label: 'Group',
    tone: 'honey',
    piIcon: 'pi pi-users',
    ionIcon: 'people-outline',
  },
  [SessionType.Private]: {
    label: '1-on-1',
    tone: 'navy',
    piIcon: 'pi pi-user',
    ionIcon: 'person-outline',
  },
  [SessionType.Open]: {
    label: 'Open',
    tone: 'teal',
    piIcon: 'pi pi-globe',
    ionIcon: 'globe-outline',
  },
};

/** "Group" / "1-on-1" / "Open" — "Session" rather than an enum at a user. */
export function sessionTypeLabel(type: SessionType | null | undefined): string {
  return (type && SESSION_TYPES[type]?.label) || 'Session';
}

/** The type's hue; honey when there is no type to speak of. */
export function sessionTypeTone(
  type: SessionType | null | undefined,
): SessionTypeTone {
  return (type && SESSION_TYPES[type]?.tone) || 'honey';
}
