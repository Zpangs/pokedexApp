/**
 * Type badge colors, keyed by PokéAPI `types.identifier`.
 * Each pair passes WCAG AA (4.5:1) for the badge label. Badges always show the type's name,
 * so color is never the only way to tell types apart.
 */
export const TypeColors: Record<string, { background: string; text: string }> = {
  normal: { background: '#6E6E55', text: '#FFFFFF' },
  fire: { background: '#C2410C', text: '#FFFFFF' },
  water: { background: '#1D63C7', text: '#FFFFFF' },
  electric: { background: '#FFD23F', text: '#0B0B0B' },
  grass: { background: '#2F7D32', text: '#FFFFFF' },
  ice: { background: '#7FD3DD', text: '#0B0B0B' },
  fighting: { background: '#A8262E', text: '#FFFFFF' },
  poison: { background: '#8236A6', text: '#FFFFFF' },
  ground: { background: '#C9A15A', text: '#0B0B0B' },
  flying: { background: '#5470C6', text: '#FFFFFF' },
  psychic: { background: '#C8296B', text: '#FFFFFF' },
  bug: { background: '#6B7A12', text: '#FFFFFF' },
  rock: { background: '#8A7529', text: '#FFFFFF' },
  ghost: { background: '#5B4485', text: '#FFFFFF' },
  dragon: { background: '#4B33C9', text: '#FFFFFF' },
  dark: { background: '#4A3B32', text: '#FFFFFF' },
  steel: { background: '#5E7A8A', text: '#FFFFFF' },
  fairy: { background: '#F2A7CF', text: '#0B0B0B' },
};

const Fallback = { background: '#5C5C5C', text: '#FFFFFF' };

export function typeColors(identifier: string) {
  return TypeColors[identifier] ?? Fallback;
}
