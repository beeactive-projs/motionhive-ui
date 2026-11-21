import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SessionInstance, formatSessionTime, localDayKey, sessionLifecycle } from 'core';

import { prefersReducedMotion } from '../../../../../_shared/utils/motion';
import {
  dayOpenHour,
  hourHasStarted,
  instanceBaseTone,
  instanceMeta,
  railScrollOffset,
} from '../../sessions.config';

/**
 * Pixels per hour. A 30-minute block is 22px of fill plus its border, which
 * still clears the 44px tap target because the block's own padding grows it —
 * anything shorter and a half-hour session becomes a line you cannot press.
 */
const HOUR_HEIGHT = 44;

/** The rail always draws at least this much of the day — a plausible working day. */
const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 20;

/** How long the scroll to where a day opens takes, when motion is welcome. */
const OPEN_SCROLL_MS = 300;

/** Where a day opens: which day, and how far down the rail. */
interface OpenAt {
  key: string;
  offset: number;
}

/**
 * The top of what a person can see of the content: under the page's header
 * when the content runs beneath it (`fullscreen` with a translucent bar).
 */
function visibleTop(content: HTMLElement, scroller: HTMLElement): number {
  const top = scroller.getBoundingClientRect().top;
  const page = content.parentElement;
  if (!page) {
    return top;
  }
  const header = page.querySelector(':scope > ion-header');
  if (!header) {
    return top;
  }
  return Math.max(top, header.getBoundingClientRect().bottom);
}

interface RailBlock {
  instance: SessionInstance;
  top: number;
  height: number;
  /** Overlapping sessions split the width and sit side by side. */
  widthPercent: number;
  leftPercent: number;
  hasConflict: boolean;
  /** What it is, not whether it clashes — the ring carries that. */
  tone: string;
  title: string;
  /** "07:30 · 11/20 · Meet" */
  meta: string;
}

/**
 * One day on an hour rail — the zoomed-in counterpart to the agenda.
 *
 * Overlaps are the point of this view: two sessions at the same time are
 * side-by-side blocks, which a flat list cannot show. The rail only spans the
 * hours that are actually in use (padded by one either side), so an evening-only
 * day does not open on eight empty morning rows.
 *
 * A day opens at its first session, near the top with a little of the hour
 * before it (`dayOpenHour`); a day with none opens on the hour it is now when
 * it is today, else on 08:00. It scrolls the `ion-content` it sits in, and
 * stops placing the day once the person has scrolled it themselves.
 */
@Component({
  selector: 'mh-day-rail',
  imports: [IonIcon, TranslatePipe],
  templateUrl: './day-rail.html',
  styleUrl: './day-rail.scss',
})
export class DayRail {
  private readonly _translateService = inject(TranslateService);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _rail = viewChild<ElementRef<HTMLElement>>('rail');

  readonly instances = input.required<SessionInstance[]>();
  /** The day on the rail, so an hour already begun offers no new session. */
  readonly day = input<Date | null>(null);
  /** Now, as the page's clock last read it. */
  readonly now = input<number>(Date.now());

  readonly select = output<SessionInstance>();
  /** An empty slot was tapped — the hour it represents. */
  readonly pickHour = output<number>();

  readonly hourHeight = HOUR_HEIGHT;

  private readonly _bounds = computed(() => {
    // The working day is the floor, not the fallback. Cropping the rail to the
    // hours in use is right for a packed day and wrong for a quiet one: a single
    // 09:00 session left three gridlines above a page of blank content, which
    // reads as a half-drawn calendar rather than an empty afternoon.
    let first = DEFAULT_FIRST_HOUR;
    let last = DEFAULT_LAST_HOUR;

    for (const instance of this.instances()) {
      const start = new Date(instance.startAt);
      // Padded by an hour either side so an early or late session is never
      // flush against the end of the rail.
      first = Math.min(first, start.getHours() - 1);

      // Measured from the start of the day rather than read off the end time:
      // a session running to midnight has `getHours() === 0`, which would sort
      // as the earliest hour and collapse the rail to nothing.
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const endHours = (new Date(instance.endAt).getTime() - dayStart.getTime()) / 3_600_000;
      // An end exactly on the hour belongs to the hour before it.
      last = Math.max(last, Math.ceil(endHours));
    }

    return { first: Math.max(0, first), last: Math.min(23, last) };
  });

  /**
   * Each hour row, and whether it has begun. A tap on an hour opens the form
   * at that time, so one already under way or gone offers nothing: the form
   * would only be refused.
   */
  readonly hours = computed(() => {
    const { first, last } = this._bounds();
    const day = this.day();
    const now = this.now();
    return Array.from({ length: last - first + 1 }, (_, i) => {
      let started = false;
      if (day) {
        started = hourHasStarted(day, first + i, now);
      }
      return {
        hour: first + i,
        label: `${String(first + i).padStart(2, '0')}:00`,
        started,
      };
    });
  });

  readonly blocks = computed<RailBlock[]>(() => {
    const { first } = this._bounds();
    const ordered = [...this.instances()].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

    // Runs of overlapping sessions share the width evenly. A and C that do not
    // touch still get thirds if B overlaps both.
    const columns = new Map<string, { index: number; total: number }>();
    let run: SessionInstance[] = [];
    let runEnd = 0;

    const flush = () => {
      run.forEach((instance, index) =>
        columns.set(instance.id, { index, total: run.length }),
      );
      run = [];
    };

    for (const instance of ordered) {
      const start = new Date(instance.startAt).getTime();
      if (run.length > 0 && start >= runEnd) flush();
      run.push(instance);
      runEnd = Math.max(runEnd, new Date(instance.endAt).getTime());
    }
    flush();

    return ordered.map((instance) => {
      const start = new Date(instance.startAt);
      const end = new Date(instance.endAt);
      const startOffset = start.getHours() + start.getMinutes() / 60 - first;
      const durationHours = Math.max(
        0.5,
        (end.getTime() - start.getTime()) / 3_600_000,
      );
      const column = columns.get(instance.id) ?? { index: 0, total: 1 };
      const hasConflict = (instance.conflictingInstanceIds?.length ?? 0) > 0;
      const template = instance.template;

      return {
        instance,
        top: startOffset * HOUR_HEIGHT,
        height: durationHours * HOUR_HEIGHT - 4,
        widthPercent: 100 / column.total,
        leftPercent: (100 / column.total) * column.index,
        hasConflict,
        // Base tone, so an overlapping pair still reads as "1-on-1 against a
        // group class" while the ring says they clash. Two facts, two channels.
        // Once it has ended it is the record, muted like the agenda's row.
        tone: this._blockTone(instance),
        title:
          instance.titleOverride ??
          template?.title ??
          this._translateService.instant('common.session'),
        meta: `${formatSessionTime(instance.startAt)} · ${instanceMeta(instance)}`,
      };
    });
  });

  // The conflict count moved to the page header, where it sits next to the
  // day's totals instead of floating above the rail on its own line.

  readonly railHeight = computed(() => this.hours().length * HOUR_HEIGHT);

  /** The day on the rail and where it opens, equal while neither moves. */
  private readonly _openAt = computed<OpenAt | null>(
    () => {
      const day = this.day();
      if (!day) {
        return null;
      }
      const hour = dayOpenHour(this.instances(), day, this.now());
      return {
        key: localDayKey(day),
        offset: railScrollOffset(hour, this._bounds().first, HOUR_HEIGHT),
      };
    },
    {
      equal: (a, b) => {
        if (a === null || b === null) {
          return a === b;
        }
        return a.key === b.key && a.offset === b.offset;
      },
    },
  );

  /** The day the rail last opened, so another day is placed afresh. */
  private _openedKey: string | null = null;
  /** The person scrolled this day themselves: the rail leaves it where they put it. */
  private _userScrolled = false;
  /** The scroller listened to for the person's own scrolling. */
  private _scroller: HTMLElement | null = null;
  private readonly _onUserScroll = (): void => {
    this._userScrolled = true;
  };

  constructor() {
    // After the render that drew the rail at its new height. Runs again when
    // the sessions land or the day changes, but not after a hand scroll.
    afterRenderEffect(() => {
      const openAt = this._openAt();
      untracked(() => {
        void this._open(openAt);
      });
    });
    inject(DestroyRef).onDestroy(() => this._unwatch());
  }

  /** Scroll the content so the day shows from where it opens. */
  private async _open(openAt: OpenAt | null): Promise<void> {
    if (!openAt) {
      return;
    }
    if (openAt.key !== this._openedKey) {
      this._openedKey = openAt.key;
      this._userScrolled = false;
    }
    if (this._userScrolled) {
      return;
    }

    const railRef = this._rail();
    const content = this._elementRef.nativeElement.closest('ion-content');
    if (!railRef || !content) {
      return;
    }
    const scroller = await content.getScrollElement();
    this._watch(scroller);
    // A finger may have landed while the scroller was being found.
    if (this._userScrolled) {
      return;
    }

    let top = 0;
    if (openAt.offset > 0) {
      const railTop = railRef.nativeElement.getBoundingClientRect().top;
      const below = railTop + openAt.offset - visibleTop(content, scroller);
      top = Math.max(0, scroller.scrollTop + below);
    }
    if (Math.abs(top - scroller.scrollTop) < 1) {
      return;
    }
    let duration = OPEN_SCROLL_MS;
    if (prefersReducedMotion()) {
      duration = 0;
    }
    await content.scrollToPoint(0, top, duration);
  }

  /**
   * A drag or a wheel is the person's own scroll; the rail's `scrollToPoint`
   * fires neither, so it never reads as theirs.
   */
  private _watch(scroller: HTMLElement): void {
    if (this._scroller === scroller) {
      return;
    }
    this._unwatch();
    this._scroller = scroller;
    scroller.addEventListener('touchmove', this._onUserScroll, { passive: true });
    scroller.addEventListener('wheel', this._onUserScroll, { passive: true });
  }

  private _unwatch(): void {
    if (!this._scroller) {
      return;
    }
    this._scroller.removeEventListener('touchmove', this._onUserScroll);
    this._scroller.removeEventListener('wheel', this._onUserScroll);
    this._scroller = null;
  }

  /** Muted once over, else what the session is (`instanceBaseTone`). */
  private _blockTone(instance: SessionInstance): string {
    if (sessionLifecycle(instance.startAt, instance.endAt, this.now()) === 'past') {
      return 'muted';
    }
    return instanceBaseTone(instance);
  }
}
