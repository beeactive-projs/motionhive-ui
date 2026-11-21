import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { foldForSearch } from 'core';

import { CHOICE_PAGE_SIZE, ChoiceOption, ChoiceSheet, matchChoices } from './choice-sheet';

const zones: ChoiceOption[] = [
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) America/São Paulo' },
  { value: 'Europe/London', label: '(UTC+01:00) Europe/London' },
  { value: 'Europe/Bucharest', label: '(UTC+03:00) Europe/Bucharest' },
];

describe('matchChoices', () => {
  it('ignores case and accents', () => {
    expect(foldForSearch('São Paulo')).toBe('sao paulo');
    expect(matchChoices(zones, 'SAO', null).map((z) => z.value)).toEqual(['America/Sao_Paulo']);
  });

  it('puts the current choice first while nothing is typed', () => {
    // 400 time zones: the one you came to check should not be a scroll away.
    expect(matchChoices(zones, '', 'Europe/Bucharest').map((z) => z.value)).toEqual([
      'Europe/Bucharest',
      'America/Sao_Paulo',
      'Europe/London',
    ]);
  });

  it('keeps the original order with nothing pinned', () => {
    expect(matchChoices(zones, '  ', null)).toEqual(zones);
  });

  it('keeps search order once something is typed', () => {
    expect(matchChoices(zones, 'europe', 'Europe/Bucharest').map((z) => z.value)).toEqual([
      'Europe/London',
      'Europe/Bucharest',
    ]);
  });
});

describe('ChoiceSheet', () => {
  const many: ChoiceOption[] = Array.from({ length: CHOICE_PAGE_SIZE + 5 }, (_, i) => ({
    value: String(i),
    label: `Option ${i}`,
  }));

  beforeEach(() => {
    TestBed.overrideComponent(ChoiceSheet, { set: { template: '', imports: [] } });
  });

  function sheet(searchPlaceholder = ''): ChoiceSheet {
    const fixture = TestBed.createComponent(ChoiceSheet);
    fixture.componentRef.setInput('title', 'Rest');
    fixture.componentRef.setInput('options', many);
    fixture.componentRef.setInput('searchPlaceholder', searchPlaceholder);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  // A routine's nine rests opened at half height with five showing.
  it('is as tall as its rows, all of them, without a search field', () => {
    const choice = sheet();

    expect(choice.fit()).toBe(true);
    expect(choice.rows()).toHaveLength(many.length);
    expect(choice.hasMore()).toBe(false);
  });

  it('opens tall and draws a page at a time with a search field', () => {
    const choice = sheet('Search');

    expect(choice.fit()).toBe(false);
    expect(choice.initialBreakpoint).toBe(0.9);
    expect(choice.rows()).toHaveLength(CHOICE_PAGE_SIZE);
    expect(choice.hasMore()).toBe(true);
  });
});

describe('ChoiceSheet, taking a choice back', () => {
  beforeEach(() => {
    TestBed.overrideComponent(ChoiceSheet, { set: { template: '', imports: [] } });
  });

  function sheet(selected: string | null, clearLabel = 'Remove gender'): ChoiceSheet {
    const fixture = TestBed.createComponent(ChoiceSheet);
    fixture.componentRef.setInput('title', 'Gender');
    fixture.componentRef.setInput('options', zones);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('clearLabel', clearLabel);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('offers the clear row only while something is picked', () => {
    expect(sheet('Europe/London').canClear()).toBe(true);
    expect(sheet(null).canClear()).toBe(false);
    expect(sheet('Europe/London', '').canClear()).toBe(false);
  });

  it('closes and reports the clear', () => {
    const choice = sheet('Europe/London');
    let cleared = 0;
    choice.cleared.subscribe(() => cleared++);

    choice.clear();

    expect(cleared).toBe(1);
    expect(choice.open()).toBe(false);
  });
});
