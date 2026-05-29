/**
 * Generic calendar event shape consumed by `mh-calendar-grid` and friends.
 *
 * **Domain-agnostic by design** — the grid renders any event with this
 * shape (sessions today; workouts, group events, office hours tomorrow).
 * Consumers map their domain entity to this shape via a pure function
 * like `instanceToCalendarEvent()` (see the smart wrapper layer).
 *
 * The `payload` field is opaque to the grid — used by consumers to
 * route back to the source entity on `(eventClick)`.
 */
export interface CalendarEvent {
  id: string;
  /** Start of the event (UTC Date object, the grid converts to local for rendering). */
  start: Date;
  /** End of the event. */
  end: Date;
  /** Headline shown on the block. */
  title: string;
  /** Secondary line (e.g. venue name, online provider, instructor name). */
  subtitle?: string;
  /**
   * The accent color used for the left border + tinted background.
   * Pass a CSS color value (hex, `rgb(...)`, or `var(--p-primary-color)`).
   * The grid never imposes a palette — the consumer picks.
   */
  color: string;
  /** Visual emphasis ring around the block — used for conflicts + active states. */
  ring?: 'none' | 'conflict' | 'active';
  /** Badges drawn on the block (icons in the top-right corner). */
  badges?: ('online' | 'recurring' | 'cancelled')[];
  /**
   * Opaque consumer-owned data. Typed by the consumer. The grid never
   * inspects it — only passes it back via `(eventClick)`.
   */
  payload?: unknown;
}

/** View modes supported by `mh-calendar-grid`. */
export type CalendarView = 'week' | 'day' | 'month';

/** Layout variant — standard week grid vs agenda-style horizontal timeline. */
export type CalendarVariant = 'standard' | 'agenda';

/** Range emitted by `mh-calendar-grid` when the user navigates. */
export interface CalendarRange {
  start: Date;
  end: Date;
}

/** Payload of `(cellDrag)` — start/end snapped to hour boundaries. */
export interface CalendarCellDrag {
  start: Date;
  end: Date;
  shiftKey: boolean;
  /** Viewport coords of the pointer when the drag ended — for popover positioning. */
  clientX: number;
  clientY: number;
}

/** Payload of `(cellClick)` — single empty-slot click without drag. */
export interface CalendarCellClick {
  date: Date;
  hour: number;
}
