import { describe, expect, it } from 'vitest';

import { ChoiceOption, foldForSearch, matchChoices } from './choice-sheet';

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
