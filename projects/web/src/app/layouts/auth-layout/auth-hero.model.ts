/** Translation keys for the brand panel hero of an auth page (its route `data.hero`). */
export interface AuthHero {
  line1: string;
  /** Words before the highlight on the second line; absent when the highlight is the whole line. */
  line2?: string;
  highlight: string;
  subtitle: string;
}
