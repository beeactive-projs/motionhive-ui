/**
 * Equipment taxonomy row. Seeded server-side; cached client-side via
 * ExerciseTaxonomyStore (~15 rows).
 */
export interface Equipment {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
}
