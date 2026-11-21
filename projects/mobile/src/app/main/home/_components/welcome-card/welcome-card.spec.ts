import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { NavModes } from 'core';
import type { OnboardingStep } from 'core';

import { OnboardingStateService } from '../../../../_shared/services/onboarding-state.service';
import { ABOUT_YOU_CARD } from '../../home.config';
import { WelcomeCard } from './welcome-card';

function setup(trainCard: OnboardingStep[], coachCard: OnboardingStep[]) {
  const open = vi.fn();
  const dismiss = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: OnboardingStateService,
        useValue: {
          trainCard: signal(trainCard),
          coachCard: signal(coachCard),
          ensureLoaded: () => Promise.resolve(null),
          open,
          dismiss,
        },
      },
    ],
  });
  TestBed.overrideComponent(WelcomeCard, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(WelcomeCard);
  return { fixture, open, dismiss };
}

describe('WelcomeCard', () => {
  it('opens and closes about you on its own card', () => {
    const { fixture, open, dismiss } = setup(['INTERESTS', 'ABOUT_YOU'], []);
    fixture.componentRef.setInput('kind', NavModes.Train);
    fixture.detectChanges();
    const card = fixture.componentInstance;

    expect(card.cards().map((entry) => entry.steps)).toEqual([['INTERESTS'], ['ABOUT_YOU']]);
    const aboutYou = card.cards()[1];
    expect(aboutYou.copy).toBe(ABOUT_YOU_CARD);

    card.open(aboutYou);
    expect(open).toHaveBeenCalledWith(['ABOUT_YOU']);
    card.dismiss(aboutYou);
    expect(dismiss).toHaveBeenCalledWith(['ABOUT_YOU']);
  });

  it("reads the coach's card in coach mode", () => {
    const { fixture } = setup(['INTERESTS'], ['ABOUT_YOU']);
    fixture.componentRef.setInput('kind', NavModes.Coach);
    fixture.detectChanges();
    expect(fixture.componentInstance.cards().map((entry) => entry.steps)).toEqual([['ABOUT_YOU']]);
  });
});
