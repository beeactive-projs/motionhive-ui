import { describe, expect, it } from 'vitest';

import { inSentenceCase, sentenceCase } from './text.utils';

describe('sentenceCase', () => {
  it('lifts the first letter of a Romanian date, with its diacritics', () => {
    expect(sentenceCase('miercuri, 28 octombrie', 'ro-RO')).toBe('Miercuri, 28 octombrie');
    expect(sentenceCase('sâmbătă, 31 oct.', 'ro-RO')).toBe('Sâmbătă, 31 oct.');
    expect(sentenceCase('ștafetă', 'ro-RO')).toBe('Ștafetă');
  });

  it('leaves the rest as written and passes empty text through', () => {
    expect(sentenceCase('Wednesday, October 28', 'en-US')).toBe('Wednesday, October 28');
    expect(sentenceCase('motionHive', 'en-US')).toBe('MotionHive');
    expect(sentenceCase('', 'en-US')).toBe('');
  });
});

describe('inSentenceCase', () => {
  it('lowers only the first letter', () => {
    expect(inSentenceCase('Today', 'en-US')).toBe('today');
    expect(inSentenceCase('Ieri', 'ro-RO')).toBe('ieri');
    expect(inSentenceCase('', 'en-US')).toBe('');
  });
});
