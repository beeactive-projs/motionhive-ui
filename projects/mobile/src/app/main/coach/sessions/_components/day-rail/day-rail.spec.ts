import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionInstance } from 'core';

import { DayRail } from './day-rail';

const DAY = new Date(2026, 10, 21);
/** 14:20 on the rail's day. */
const NOW = new Date(2026, 10, 21, 14, 20).getTime();

function at(hour: number, id: string, day = 21): SessionInstance {
  const start = new Date(2026, 10, day, hour);
  return {
    id,
    status: 'SCHEDULED',
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3_600_000).toISOString(),
    confirmedCount: 0,
    pendingApprovalCount: 0,
    capacityOverride: null,
    titleOverride: null,
    conflictingInstanceIds: null,
    template: { type: 'GROUP', title: 'Yoga', capacity: null },
  } as SessionInstance;
}

describe('DayRail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(DayRail, { set: { template: '', imports: [] } });
  });

  function rail(instances: SessionInstance[], day: Date | null): DayRail {
    const fixture = TestBed.createComponent(DayRail);
    fixture.componentRef.setInput('instances', instances);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  // A tapped hour pre-fills the form, so an hour already begun must not be
  // offered: the session would start in the past.
  it('offers no new session on an hour that has begun', () => {
    const hours = rail([], DAY).hours();
    const started = (hour: number) => hours.find((row) => row.hour === hour)?.started;
    expect(started(9)).toBe(true);
    expect(started(14)).toBe(true);
    expect(started(15)).toBe(false);
    expect(started(20)).toBe(false);
  });

  it('offers every hour of a day ahead', () => {
    const hours = rail([], new Date(2026, 10, 22)).hours();
    expect(hours.every((row) => !row.started)).toBe(true);
  });

  it('mutes a block that has ended, and keeps the type on one ahead', () => {
    const blocks = rail([at(9, 'done'), at(17, 'next')], DAY).blocks();
    expect(blocks.find((block) => block.instance.id === 'done')?.tone).toBe('muted');
    expect(blocks.find((block) => block.instance.id === 'next')?.tone).toBe('honey');
  });
});

/**
 * Where a day opens: the rail scrolls the `ion-content` it sits in. jsdom
 * lays nothing out (every box is at 0), so the scroll lands on the rail's
 * own offset for the hour, which is what is checked.
 */
describe('DayRail, where a day opens', () => {
  /** Stands in for `ion-content`: its scroller and `scrollToPoint`. */
  function content() {
    const host = document.createElement('ion-content');
    const scroller = document.createElement('div');
    const scrollToPoint = vi.fn(async (_x: number, y: number) => {
      scroller.scrollTop = y;
    });
    Object.assign(host, { getScrollElement: async () => scroller, scrollToPoint });
    document.body.appendChild(host);
    return { host, scroller, scrollToPoint };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    // The rail box alone: it is what the scroll is measured from.
    TestBed.overrideComponent(DayRail, {
      set: { template: '<div #rail class="rail"></div>', imports: [] },
    });
  });

  async function shown(instances: SessionInstance[], day: Date) {
    const page = content();
    const fixture = TestBed.createComponent(DayRail);
    page.host.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('instances', instances);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
    await fixture.whenStable();
    return { ...page, fixture };
  }

  it("opens at the day's first session, with half an hour above it", async () => {
    const { scrollToPoint } = await shown([at(17, 'evening', 22)], new Date(2026, 10, 22));
    // The rail starts at 07:00; 16:30 is 9.5 hours down at 44px an hour.
    expect(scrollToPoint).toHaveBeenCalledWith(0, 9.5 * 44, 300);
  });

  it('jumps rather than glides when less motion is asked for', async () => {
    const media = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ matches: true } as MediaQueryList);
    const { scrollToPoint } = await shown([at(17, 'evening', 22)], new Date(2026, 10, 22));
    expect(scrollToPoint).toHaveBeenCalledWith(0, 9.5 * 44, 0);
    media.mockRestore();
  });

  it('opens a quiet today on the hour it is now', async () => {
    const { scrollToPoint } = await shown([], DAY);
    // 14:20 now: 13:30 is 6.5 hours below 07:00.
    expect(scrollToPoint).toHaveBeenCalledWith(0, 6.5 * 44, 300);
  });

  // Moving under someone's thumb is the one thing it must not do.
  it('leaves the day where the person scrolled it', async () => {
    const { scroller, scrollToPoint, fixture } = await shown([], new Date(2026, 10, 23));
    expect(scrollToPoint).toHaveBeenCalledTimes(1);

    scroller.dispatchEvent(new Event('touchmove'));
    fixture.componentRef.setInput('instances', [at(18, 'late', 23)]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrollToPoint).toHaveBeenCalledTimes(1);

    // Another day is opened afresh.
    fixture.componentRef.setInput('day', new Date(2026, 10, 24));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrollToPoint).toHaveBeenCalledTimes(2);
  });
});
