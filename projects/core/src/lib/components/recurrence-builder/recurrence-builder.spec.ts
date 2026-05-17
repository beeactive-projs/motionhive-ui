import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RecurrenceBuilder } from './recurrence-builder';
import type { RecurrenceRule } from '../../models/session/session.model';

function setup(initial: RecurrenceRule): RecurrenceBuilder {
  TestBed.configureTestingModule({ imports: [RecurrenceBuilder] });
  const fixture = TestBed.createComponent(RecurrenceBuilder);
  fixture.componentRef.setInput('rule', initial);
  fixture.componentRef.setInput('firstStartAt', '2026-05-18T09:00:00Z'); // Monday
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('RecurrenceBuilder', () => {
  it('switching to WEEKLY seeds daysOfWeek from firstStartAt (Monday → [1])', () => {
    const c = setup({ frequency: 'DAILY', interval: 1 });
    let emitted: RecurrenceRule | null = null;
    c.ruleChange.subscribe((r) => (emitted = r));
    (c as unknown as { setFrequency: (f: 'WEEKLY') => void }).setFrequency('WEEKLY');
    expect(emitted!.frequency).toBe('WEEKLY');
    expect(emitted!.daysOfWeek).toEqual([1]);
  });

  it('toggleDow() adds & sorts day numbers based on current rule input', () => {
    const c = setup({ frequency: 'WEEKLY', interval: 1, daysOfWeek: [1] });
    let emitted: RecurrenceRule | null = null;
    c.ruleChange.subscribe((r) => (emitted = r));
    (c as unknown as { toggleDow: (n: number) => void }).toggleDow(3);
    expect(emitted!.daysOfWeek).toEqual([1, 3]);
  });

  it('toggleDow() refuses to emit if it would empty the set (only day)', () => {
    const c = setup({ frequency: 'WEEKLY', interval: 1, daysOfWeek: [1] });
    let emitted: RecurrenceRule | null = null;
    c.ruleChange.subscribe((r) => (emitted = r));
    (c as unknown as { toggleDow: (n: number) => void }).toggleDow(1); // would empty
    expect(emitted).toBeNull();
  });

  it('setEndMode("count") seeds endAfterOccurrences and clears endDate', () => {
    const c = setup({ frequency: 'WEEKLY', interval: 1, daysOfWeek: [1], endDate: '2026-12-31' });
    let emitted: RecurrenceRule | null = null;
    c.ruleChange.subscribe((r) => (emitted = r));
    (c as unknown as { setEndMode: (m: 'count') => void }).setEndMode('count');
    expect(emitted!.endAfterOccurrences).toBeGreaterThan(0);
    expect(emitted!.endDate).toBeUndefined();
  });

  it('plainEnglish: WEEKLY interval=2 days=[1,3] reads "Every 2 weeks on Mon, Wed"', () => {
    const c = setup({ frequency: 'WEEKLY', interval: 2, daysOfWeek: [1, 3] });
    const s = (c as unknown as { plainEnglish: () => string }).plainEnglish();
    expect(s.toLowerCase()).toContain('every 2 weeks');
    expect(s).toContain('Mon');
    expect(s).toContain('Wed');
  });
});
