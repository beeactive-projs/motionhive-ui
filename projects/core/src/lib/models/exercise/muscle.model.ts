/**
 * Muscle taxonomy row. Seeded server-side; the FE caches the full
 * list once via ExerciseTaxonomyStore (it's small — ~17 rows).
 */
export interface Muscle {
  id: string;
  slug: string;
  commonName: string;
  latinName: string | null;
  /** 'upper' | 'lower' | 'core' | 'full_body' — free string by design. */
  bodyRegion: string;
  displayOrder: number;
}
