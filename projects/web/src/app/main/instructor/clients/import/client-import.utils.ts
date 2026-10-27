import Papa from 'papaparse';
import { ClientImportRow } from 'core';

/**
 * Reading a coach's client list, whatever it came from: an .xlsx, a CSV in
 * any of the delimiters Excel writes (Romanian Excel uses `;`), or cells
 * pasted straight from a spreadsheet (tab separated). Pure functions over
 * a grid of strings; the page only adds the file picker and the API calls.
 */

/** Same cap as the API (`CLIENT_IMPORT_MAX_ROWS`): checked here first, so a long list never reaches it. */
export const CLIENT_IMPORT_MAX_ROWS = 200;

/** The API's per-field limits. Values past them are cut, not rejected. */
const LIMITS = { email: 320, name: 100, note: 1000 } as const;

/** What a column of the sheet becomes. */
export type ImportField = 'email' | 'firstName' | 'lastName' | 'fullName' | 'note' | 'ignore';

export const IMPORT_FIELDS: readonly ImportField[] = [
  'email',
  'firstName',
  'lastName',
  'fullName',
  'note',
  'ignore',
];

export interface ParsedSheet {
  /** Column titles, or null when the first row is already a person. */
  headers: string[] | null;
  /** Data rows, each padded to `columnCount`. */
  rows: string[][];
  columnCount: number;
}

const EMAIL_LIKE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Header words per field, compared after `normalizeHeader`. English and
 * Romanian, plus what the common coaching apps put in their exports.
 * "Nume" alone is ambiguous in Romanian: next to a "Prenume" column it is
 * the last name, on its own it is the whole name (see `guessMapping`).
 */
const HEADER_WORDS: Record<Exclude<ImportField, 'ignore'>, readonly string[]> = {
  email: ['email', 'emailaddress', 'mail', 'adresaemail', 'adresademail', 'adresadeemail'],
  firstName: ['firstname', 'first', 'givenname', 'forename', 'prenume'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'numedefamilie'],
  fullName: [
    'name',
    'fullname',
    'client',
    'clientname',
    'contact',
    'numecomplet',
    'numesiprenume',
    'numeprenume',
    'persoana',
  ],
  note: [
    'note',
    'notes',
    'comment',
    'comments',
    'details',
    'nota',
    'notita',
    'notite',
    'observatie',
    'observatii',
    'comentarii',
    'mentiuni',
    'detalii',
  ],
};

/** "E-mail address" → "emailaddress", "Observații" → "observatii". */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function looksLikeEmail(value: string): boolean {
  return EMAIL_LIKE.test(value.trim());
}

/**
 * Text to a grid. Papa Parse guesses the delimiter, which covers commas,
 * semicolons and the tabs a paste from Excel or Google Sheets produces.
 */
export function parseDelimited(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), {
    skipEmptyLines: 'greedy',
  });
  return result.data;
}

/**
 * Bytes to text. A CSV saved by Excel on a Romanian Windows is often
 * Windows-1250 rather than UTF-8, and reading it as UTF-8 turns every
 * "ș" into "�". Try UTF-8 strictly, fall back to 1250.
 *
 * Windows-1250 has no "ș" or "ț", only the cedilla look-alikes "ş" and
 * "ţ" that stood in for them, so text read that way gets the real letters.
 */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1250')
      .decode(bytes)
      .replace(/ş/g, 'ș')
      .replace(/Ş/g, 'Ș')
      .replace(/ţ/g, 'ț')
      .replace(/Ţ/g, 'Ț');
  }
}

/** Every cell to a trimmed string, fully blank rows dropped. */
export function normalizeCells(raw: readonly (readonly unknown[])[]): string[][] {
  return raw
    .map((row) =>
      row.map((cell) => {
        if (cell == null) return '';
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell).trim();
      }),
    )
    .filter((row) => row.some((cell) => cell !== ''));
}

/**
 * Decide whether the first row is a header: it is, unless it already holds
 * an email address. A list with no emails anywhere keeps its first row as
 * the header too, and the mapping step then asks for the email column.
 */
export function toParsedSheet(grid: string[][]): ParsedSheet {
  const columnCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const pad = (row: string[]) =>
    row.length < columnCount ? [...row, ...Array(columnCount - row.length).fill('')] : row;

  const first = grid[0] ?? [];
  const firstIsData = first.some(looksLikeEmail);
  const headers = firstIsData || grid.length === 0 ? null : pad(first);
  const rows = (firstIsData ? grid : grid.slice(1)).map(pad);
  return { headers, rows, columnCount };
}

/**
 * A first guess at what each column is, from its title, then from its
 * content for the one field that can be told apart by content: a column
 * that is mostly addresses is the email. Each field goes to one column at
 * most; whatever is left is "don't import".
 */
export function guessMapping(sheet: ParsedSheet): ImportField[] {
  const mapping: ImportField[] = Array(sheet.columnCount).fill('ignore');
  const taken = new Set<ImportField>();
  const assign = (column: number, field: ImportField) => {
    if (taken.has(field) || mapping[column] !== 'ignore') return;
    mapping[column] = field;
    taken.add(field);
  };

  const normalized = (sheet.headers ?? []).map(normalizeHeader);
  const hasPrenume = normalized.includes('prenume');

  normalized.forEach((header, column) => {
    if (!header) return;
    if (header === 'nume') {
      assign(column, hasPrenume ? 'lastName' : 'fullName');
      return;
    }
    for (const field of Object.keys(HEADER_WORDS) as (keyof typeof HEADER_WORDS)[]) {
      if (HEADER_WORDS[field].includes(header)) {
        assign(column, field);
        return;
      }
    }
    if (header.includes('mail')) assign(column, 'email');
  });

  if (!taken.has('email')) {
    const best = bestEmailColumn(sheet);
    if (best !== null) assign(best, 'email');
  }
  return mapping;
}

function bestEmailColumn(sheet: ParsedSheet): number | null {
  let best: number | null = null;
  let bestShare = 0.5;
  for (let column = 0; column < sheet.columnCount; column++) {
    const values = sheet.rows.map((row) => row[column]).filter(Boolean);
    if (values.length === 0) continue;
    const share = values.filter(looksLikeEmail).length / values.length;
    if (share > bestShare) {
      best = column;
      bestShare = share;
    }
  }
  return best;
}

/** "Ana Pop <ana@x.com>" or "mailto:ana@x.com" → "ana@x.com". */
function cleanEmail(value: string): string {
  const bracketed = /<([^<>]+@[^<>]+)>/.exec(value);
  const address = (bracketed ? bracketed[1] : value).replace(/^mailto:/i, '');
  return address.trim().slice(0, LIMITS.email);
}

/**
 * The template's sample rows use example.com, which RFC 2606 reserves:
 * nobody can receive mail there. A coach who fills the template in and
 * forgets to delete the samples should not invite them.
 */
function isTemplateSample(email: string): boolean {
  return /@example\.(com|org|net)$/i.test(email);
}

/**
 * The rows the API gets. A full-name column is kept whole as the first
 * name rather than split: "Popescu Ana" and "Ana Popescu" are both common
 * in Romania, and a wrong split greets someone by their surname.
 */
export function buildImportRows(sheet: ParsedSheet, mapping: ImportField[]): ClientImportRow[] {
  const column = (field: ImportField) => mapping.indexOf(field);
  const read = (row: string[], field: ImportField) => {
    const i = column(field);
    return i >= 0 ? (row[i] ?? '').trim() : '';
  };

  const rows: ClientImportRow[] = [];
  for (const row of sheet.rows) {
    const email = cleanEmail(read(row, 'email'));
    const firstName = (read(row, 'firstName') || read(row, 'fullName')).slice(0, LIMITS.name);
    const lastName = read(row, 'lastName').slice(0, LIMITS.name);
    const note = read(row, 'note').slice(0, LIMITS.note);

    if (!email && !firstName && !lastName && !note) continue;
    if (isTemplateSample(email)) continue;

    rows.push({
      email,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(note ? { note } : {}),
    });
  }
  return rows;
}
