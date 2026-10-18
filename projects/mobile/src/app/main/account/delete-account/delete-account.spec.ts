import { describe, expect, it } from 'vitest';

import { foldWord } from './delete-account';

describe('the word that confirms a deletion', () => {
  it('ignores case, spaces and accents, so a phone keyboard cannot block it', () => {
    expect(foldWord(' delete ')).toBe('DELETE');
    expect(foldWord('sterge')).toBe(foldWord('ȘTERGE'));
  });

  it('still has to be the word', () => {
    expect(foldWord('DELET')).not.toBe(foldWord('DELETE'));
  });
});
