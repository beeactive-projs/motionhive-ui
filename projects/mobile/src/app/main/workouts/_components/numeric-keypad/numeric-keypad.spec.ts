import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { KeypadField, KeypadFields } from '../../workouts.config';
import { NumericKeypad } from './numeric-keypad';

/** The pad bound to one cell and seeded, its template blanked (Ionic does not render in jsdom). */
function setup(field: KeypadField, value: string, replaceOnType = true) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
  });
  TestBed.overrideComponent(NumericKeypad, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(NumericKeypad);
  const previews: (string | null)[] = [];
  fixture.componentInstance.preview.subscribe((preview) => previews.push(preview));
  fixture.componentRef.setInput('field', field);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('cell', 'set-1:duration');
  fixture.componentRef.setInput('replaceOnType', replaceOnType);
  fixture.detectChanges();
  const pad = fixture.componentInstance;
  /** Runs the effects, so the preview catches up with the last key. */
  const settle = () => fixture.detectChanges();
  return { fixture, pad, previews, settle };
}

describe('NumericKeypad', () => {
  // A 2:30 hold is stored as 150 seconds. Read as clock digits, "150" is
  // 1:50, and confirming the cell without typing saved 110 seconds.
  it('commits a clock seed as the seconds it was seeded with', () => {
    const { pad } = setup(KeypadFields.Duration, '150');

    expect(pad.display()).toBe('2:30');
    expect(pad.committed()).toBe('150');
  });

  it('steps a clock from the time it was seeded with', () => {
    const { pad } = setup(KeypadFields.Duration, '150');
    pad.step(1);

    expect(pad.display()).toBe('2:45');
    expect(pad.committed()).toBe('165');
  });

  it('builds a new clock from the first digit typed over the seed', () => {
    const { pad } = setup(KeypadFields.Duration, '150');
    pad.press('4');
    pad.press('5');

    expect(pad.display()).toBe('0:45');
    expect(pad.committed()).toBe('45');
  });

  it('seeds an empty clock as nothing', () => {
    const { pad } = setup(KeypadFields.Duration, '');

    expect(pad.committed()).toBe('');
  });

  it('seeds a number as it is', () => {
    const { pad } = setup(KeypadFields.Weight, '82.5');

    expect(pad.committed()).toBe('82.5');
  });

  it('backspaces the seed one character at a time', () => {
    const { pad } = setup(KeypadFields.Weight, '80');
    pad.backspace();

    expect(pad.committed()).toBe('8');
  });

  // A cell in the set grid holds 9999.99 kg and 999 reps and no more: a key
  // or a step past that is ignored rather than overflowing the cell.
  it('ignores a key or a step past the field cap', () => {
    const { pad } = setup(KeypadFields.Reps, '999');
    pad.backspace();
    pad.press('9');
    pad.press('9');
    expect(pad.committed()).toBe('999');

    pad.step(1);
    expect(pad.committed()).toBe('999');
  });

  // The cell keeps its own look (a grey pre-fill stays grey) until a key, and
  // says so with null; a buffer cleared to nothing is '', a different thing.
  it('previews nothing until a key, then what is typed, then a cleared field', () => {
    const { pad, previews, settle } = setup(KeypadFields.Reps, '8');
    expect(previews.at(-1)).toBeNull();

    pad.press('1');
    pad.press('0');
    settle();
    expect(previews.at(-1)).toBe('10');

    pad.clear();
    settle();
    expect(previews.at(-1)).toBe('');
  });
});
