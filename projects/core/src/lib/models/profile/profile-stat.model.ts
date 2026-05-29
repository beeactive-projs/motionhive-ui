/**
 * A single cell in the `<mh-stat-strip>` strip beneath the hero. Value is
 * pre-formatted so the component renders it verbatim (`'4.9★'`, `'< 2h'`,
 * `'120+'`). The strip displays exactly 4 cells on `≥sm` and 2-up on
 * mobile; the parent decides which 4 stats are most credible for the
 * profile being rendered.
 */
export interface ProfileStat {
  value: string;
  /** Eyebrow label, rendered in small uppercase. */
  label: string;
}
