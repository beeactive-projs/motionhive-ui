export const GROUP_PALETTES = [
  'amber', 'teal', 'rose', 'slate',
  'violet', 'pink', 'sky', 'lime',
] as const;

export type GroupPalette = typeof GROUP_PALETTES[number];

export function paletteFor(groupId: string): GroupPalette {
  const sum = [...groupId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return GROUP_PALETTES[sum % GROUP_PALETTES.length];
}

export function monogramFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
}
