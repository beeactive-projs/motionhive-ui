import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { BirthdayField } from './birthday-field';

describe('BirthdayField', () => {
  beforeEach(() => {
    TestBed.overrideComponent(BirthdayField, { set: { template: '', imports: [] } });
  });

  function field(value: string | null): BirthdayField {
    const fixture = TestBed.createComponent(BirthdayField);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('says the saved day, or invites one', () => {
    expect(field('1992-03-14').label()).toBe('14 March 1992');
    expect(field(null).label()).toBeNull();
  });

  it('runs the picker from 1900 to today', () => {
    const birthday = field(null);
    expect(birthday.min).toBe('1900-01-01');
    expect(birthday.max).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the picker and takes the day picked', () => {
    const birthday = field(null);
    birthday.openPicker();
    expect(birthday.pickerOpen()).toBe(true);

    birthday.onPicked('1992-03-14');
    expect(birthday.value()).toBe('1992-03-14');
  });

  it('keeps the day when the picker hands back none', () => {
    const birthday = field('1992-03-14');
    birthday.onPicked(null);
    birthday.onPicked(['1990-01-01']);
    expect(birthday.value()).toBe('1992-03-14');
  });
});
