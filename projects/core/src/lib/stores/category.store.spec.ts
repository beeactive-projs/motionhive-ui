import { CategoryKinds } from '../models/onboarding/onboarding.enums';
import type { Category } from '../models/onboarding/onboarding.model';
import { categoryNames, withCategorySpecialties } from './category.store';

const category = (id: string, kind: Category['kind'], displayOrder: number): Category => ({
  id,
  slug: id,
  kind,
  name: `name-${id}`,
  icon: 'barbell-outline',
  displayOrder,
  coachesOnly: false,
});

const byId = new Map(
  [
    category('yoga', CategoryKinds.Activity, 3),
    category('strength', CategoryKinds.Activity, 1),
    category('lose-fat', CategoryKinds.Goal, 2),
  ].map((c) => [c.id, c]),
);

describe('categoryNames', () => {
  it('names the ids in the list order, activities first, skipping unknown ones', () => {
    expect(categoryNames(['lose-fat', 'yoga', 'gone', 'strength'], byId)).toEqual([
      'name-strength',
      'name-yoga',
      'name-lose-fat',
    ]);
    expect(categoryNames(undefined, byId)).toEqual([]);
  });
});

describe('withCategorySpecialties', () => {
  it('keeps the coach own words', () => {
    const coach = { specializations: ['Forță'], categoryIds: ['yoga'] };
    expect(withCategorySpecialties(coach, byId)).toBe(coach);
  });

  it('falls back to the category names when they wrote none', () => {
    const coach = { specializations: [] as string[], categoryIds: ['yoga', 'strength'] };
    expect(withCategorySpecialties(coach, byId).specializations).toEqual([
      'name-strength',
      'name-yoga',
    ]);
  });

  it('leaves a coach with neither alone', () => {
    const coach = { specializations: null, categoryIds: [] };
    expect(withCategorySpecialties(coach, byId)).toBe(coach);
  });
});
