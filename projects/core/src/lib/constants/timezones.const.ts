export interface TimezoneOption {
  label: string;
  value: string;
}

function getOffsetMinutes(tz: string): number {
  const now = new Date();
  const offsetStr =
    new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2]) * 60 + parseInt(match[3] ?? '0'));
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = Intl.supportedValuesOf('timeZone')
  .map((tz) => {
    const off = getOffsetMinutes(tz);
    return { label: `(UTC${formatOffset(off)}) ${tz.replace(/_/g, ' ')}`, value: tz, off };
  })
  .sort((a, b) => a.off - b.off || a.label.localeCompare(b.label))
  .map(({ label, value }) => ({ label, value }));
