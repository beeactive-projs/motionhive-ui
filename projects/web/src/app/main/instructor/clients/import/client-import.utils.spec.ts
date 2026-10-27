import { describe, expect, it } from 'vitest';

import {
  buildImportRows,
  decodeText,
  guessMapping,
  normalizeCells,
  parseDelimited,
  toParsedSheet,
} from './client-import.utils';

const sheetOf = (text: string) => toParsedSheet(normalizeCells(parseDelimited(text)));

describe('reading a client list', () => {
  it('reads a Romanian Excel CSV, semicolons and all', () => {
    const sheet = sheetOf('Prenume;Nume;Email;Observații\nAna;Pop;ana@x.ro;Genunchi\n');

    expect(sheet.headers).toEqual(['Prenume', 'Nume', 'Email', 'Observații']);
    // Next to "Prenume", "Nume" is the surname.
    expect(guessMapping(sheet)).toEqual(['firstName', 'lastName', 'email', 'note']);
  });

  it('reads cells pasted from a spreadsheet', () => {
    const sheet = sheetOf('Full name\tE-mail address\nAna Pop\tana@x.com\nDan Ionescu\tdan@x.com');

    expect(guessMapping(sheet)).toEqual(['fullName', 'email']);
    expect(buildImportRows(sheet, guessMapping(sheet))).toEqual([
      { email: 'ana@x.com', firstName: 'Ana Pop' },
      { email: 'dan@x.com', firstName: 'Dan Ionescu' },
    ]);
  });

  it('treats "Nume" on its own as the whole name', () => {
    expect(guessMapping(sheetOf('Nume,Email\nAna Pop,ana@x.com'))).toEqual(['fullName', 'email']);
  });

  it('keeps the first row when it is already a person, and finds the email by content', () => {
    const sheet = sheetOf('Ana Pop,ana@x.com\nDan,dan@x.com');

    expect(sheet.headers).toBeNull();
    expect(sheet.rows).toHaveLength(2);
    expect(guessMapping(sheet)).toEqual(['ignore', 'email']);
  });

  it('gives each field to one column only', () => {
    expect(guessMapping(sheetOf('Email,Mail\na@x.com,b@x.com'))).toEqual(['email', 'ignore']);
  });

  it('skips blank rows and the template samples, and pulls the address out of a display form', () => {
    const sheet = toParsedSheet([
      ['Email', 'First name'],
      ['ana.pop@example.com', 'Ana'],
      ['', ''],
      ['Dan <dan@x.com>', 'Dan'],
      ['mailto:ioana@x.com', ''],
    ]);

    expect(buildImportRows(sheet, ['email', 'firstName'])).toEqual([
      { email: 'dan@x.com', firstName: 'Dan' },
      { email: 'ioana@x.com' },
    ]);
  });

  it('keeps a person with no email, for the review to ask for one', () => {
    const sheet = toParsedSheet([
      ['Email', 'First name'],
      ['', 'Maria'],
    ]);
    expect(buildImportRows(sheet, ['email', 'firstName'])).toEqual([
      { email: '', firstName: 'Maria' },
    ]);
  });

  it('turns spreadsheet values into text', () => {
    expect(normalizeCells([[' a@x.com ', 42, null, new Date('2026-01-05T00:00:00Z')]])).toEqual([
      ['a@x.com', '42', '', '2026-01-05'],
    ]);
  });

  it('reads a Windows-1250 CSV without mangling Romanian letters', () => {
    // 0xBA is Windows-1250 for the cedilla "ş", and not valid UTF-8 on its own.
    const bytes = new Uint8Array([0x50, 0x6f, 0x70, 0x65, 0x73, 0x63, 0x75, 0x20, 0xba]).buffer;
    expect(decodeText(bytes)).toBe('Popescu ș');
  });
});
