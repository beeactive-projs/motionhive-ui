import { describe, expect, it } from 'vitest';

import { ChipNotices, addChips, canAddChip, chipKey, splitChipText } from './chip-input.config';

const rules = { max: 4, maxLength: 12, exclude: [] as string[] };

describe('chipKey and splitChipText', () => {
  it('compares blind to case, accents and spacing', () => {
    expect(chipKey(' Forță ')).toBe(chipKey('forta'));
    expect(chipKey('Ștefan  cel Mare')).toBe(chipKey('stefan cel mare'));
  });

  it('splits a pasted list and drops what is empty', () => {
    expect(splitChipText(' boxing, tennis ;; \n  hot   yoga ,')).toEqual([
      'boxing',
      'tennis',
      'hot yoga',
    ]);
    expect(splitChipText(' , ')).toEqual([]);
  });
});

describe('addChips', () => {
  it('turns what was typed into chips and empties the field', () => {
    const result = addChips(['Kettlebells'], 'boxing, tennis', rules);
    expect(result.values).toEqual(['Kettlebells', 'boxing', 'tennis']);
    expect(result.added).toEqual(['boxing', 'tennis']);
    expect(result.rest).toBe('');
    expect(result.notice).toBeNull();
  });

  it('never adds a chip twice, case and accents aside', () => {
    const result = addChips(['Forță'], 'forta, Boxing, boxing', rules);
    expect(result.values).toEqual(['Forță', 'Boxing']);
    // Said as the chip spells it.
    expect(result.duplicates).toEqual(['Forță']);
    expect(result.notice).toBe(ChipNotices.Duplicate);
  });

  it('leaves out what only repeats an excluded name, and says which', () => {
    const result = addChips([], 'yoga, kettlebells', { ...rules, exclude: ['Yoga', 'Pilates'] });
    expect(result.values).toEqual(['kettlebells']);
    // Said as the list spells it.
    expect(result.excluded).toEqual(['Yoga']);
    expect(result.notice).toBe(ChipNotices.Excluded);
  });

  it('keeps an entry over the length in the field to be shortened', () => {
    const result = addChips([], 'boxing, a very long speciality', rules);
    expect(result.values).toEqual(['boxing']);
    expect(result.rest).toBe('a very long speciality');
    expect(result.notice).toBe(ChipNotices.TooLong);
  });

  it('stops at the cap and keeps what had no room', () => {
    const result = addChips(['a', 'b', 'c'], 'd, e, f', rules);
    expect(result.values).toEqual(['a', 'b', 'c', 'd']);
    expect(result.rest).toBe('e, f');
    expect(result.notice).toBe(ChipNotices.Full);
  });

  it('puts the cap first when several things went wrong', () => {
    const result = addChips(['a', 'b', 'c', 'd'], 'a, much too long to fit, e', rules);
    expect(result.duplicates).toEqual(['a']);
    expect(result.notice).toBe(ChipNotices.Full);
    expect(result.rest).toBe('much too long to fit, e');
  });

  it('leaves the list it was given untouched', () => {
    const values = ['a'];
    addChips(values, 'b', rules);
    expect(values).toEqual(['a']);
  });
});

describe('canAddChip', () => {
  it('needs something typed and room under the cap', () => {
    expect(canAddChip('boxing', 0, 4)).toBe(true);
    expect(canAddChip('  ,  ', 0, 4)).toBe(false);
    expect(canAddChip('', 0, 4)).toBe(false);
    expect(canAddChip('boxing', 4, 4)).toBe(false);
  });
});
