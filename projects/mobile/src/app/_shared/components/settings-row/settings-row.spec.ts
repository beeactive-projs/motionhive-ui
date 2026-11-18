import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsRow } from './settings-row';

function build(inputs: Partial<Record<'interactive' | 'disabled' | 'detail', boolean>> = {}) {
  const fixture = TestBed.createComponent(SettingsRow);
  fixture.componentRef.setInput('label', 'Rest between sets');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const row = fixture.componentInstance;
  const selected = vi.fn();
  row.select.subscribe(selected);
  return { row, selected };
}

describe('SettingsRow', () => {
  beforeEach(() => {
    TestBed.overrideComponent(SettingsRow, { set: { template: '', imports: [] } });
  });

  it('is a button with a chevron that reports the tap, by default', () => {
    const { row, selected } = build();

    expect(row.isButton()).toBe(true);
    expect(row.showDetail()).toBe(true);
    row.onClick();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it('drops the chevron alone when asked, still a button', () => {
    const { row } = build({ detail: false });

    expect(row.isButton()).toBe(true);
    expect(row.showDetail()).toBe(false);
  });

  // A value to read (a saved routine's rest): nothing to press, and not
  // greyed out the way a disabled row is.
  it('reads as a plain value when not interactive', () => {
    const { row, selected } = build({ interactive: false });

    expect(row.isButton()).toBe(false);
    expect(row.showDetail()).toBe(false);
    expect(row.disabled()).toBe(false);
    row.onClick();
    expect(selected).not.toHaveBeenCalled();
  });

  it('reports nothing while disabled', () => {
    const { row, selected } = build({ disabled: true });

    expect(row.isButton()).toBe(false);
    row.onClick();
    expect(selected).not.toHaveBeenCalled();
  });
});
