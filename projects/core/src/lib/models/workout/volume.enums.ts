/**
 * The unit a volume figure is in, as the API sends it beside the number:
 * kg × reps for a loaded exercise, total reps for a bodyweight one, total
 * seconds for a hold, total metres for a distance.
 */
export const VolumeUnits = {
  Kg: 'kg',
  Reps: 'reps',
  Seconds: 'seconds',
  Meters: 'meters',
} as const;

export type VolumeUnit = (typeof VolumeUnits)[keyof typeof VolumeUnits];
