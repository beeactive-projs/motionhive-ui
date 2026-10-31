/** Letters NFKD keeps whole that the server's `unaccent` spells in plain Latin. */
const LETTER_FOLDS: Readonly<Record<string, string>> = { ß: 'ss', ł: 'l', đ: 'd', æ: 'ae', ø: 'o', œ: 'oe' };

/**
 * Case and accents fold away, so "sao" finds "São Paulo" and "stefan" finds
 * "Ștefan" (both Romanian forms: comma below and cedilla). The app's side of
 * the API's `fold_for_search()`: a list filtered in memory must match the
 * same things the server search does.
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[ßłđæøœ]/g, (letter) => LETTER_FOLDS[letter]);
}

/** Whether `text` contains `query`, both folded. An empty query matches. */
export function foldedIncludes(text: string | null | undefined, query: string): boolean {
  const term = foldForSearch(query.trim());
  return !term || foldForSearch(text ?? '').includes(term);
}
