import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { ResumeCard } from './resume-card';

describe('ResumeCard', () => {
  function build(paused?: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    TestBed.overrideComponent(ResumeCard, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(ResumeCard);
    fixture.componentRef.setInput('name', 'Push day');
    fixture.componentRef.setInput('elapsed', '23:00');
    if (paused !== undefined) fixture.componentRef.setInput('paused', paused);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('is running unless told it is paused', () => {
    expect(build().paused()).toBe(false);
    TestBed.resetTestingModule();
    expect(build(true).paused()).toBe(true);
  });

  it('holds the name and the clock it is given', () => {
    const card = build();
    expect(card.name()).toBe('Push day');
    expect(card.elapsed()).toBe('23:00');
  });

  it('leads with a clock while running and a pause sign while paused', () => {
    expect(build().icon()).toBe('time-outline');
    TestBed.resetTestingModule();
    expect(build(true).icon()).toBe('pause-outline');
  });
});
