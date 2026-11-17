import { NATIONAL_DEX_ID } from '@/db/queries/pokedexes';

export type DexPalette = {
  /** The sign band gradient, left to right: usually the dex's two paired versions. */
  gradient: readonly [string, string];
  /** A light tint of the left colour for panel titles on black (≥ 6:1 on the panel). */
  accent: string;
};

/**
 * Each Pokédex paints the sign bands in its games' colours. Every stop, and the gradient's
 * midpoint, holds AA (≥ 4.5:1) for white text. Keyed by `pokedexes.id`.
 */
const NATIONAL: DexPalette = { gradient: ['#C8102E', '#1D4ED8'], accent: '#FF7A85' };

const SUN_MOON: DexPalette = { gradient: ['#B45309', '#6D28D9'], accent: '#CC8A58' };
const ULTRA_SUN_MOON: DexPalette = { gradient: ['#C2410C', '#4C1D95'], accent: '#D78461' };
const X_Y: DexPalette = { gradient: ['#1D4ED8', '#B91C1C'], accent: '#7A97E8' };

const PALETTES: Record<number, DexPalette> = {
  [NATIONAL_DEX_ID]: NATIONAL,
  // Kanto: FireRed → LeafGreen
  2: { gradient: ['#C8102E', '#15803D'], accent: '#E0798A' },
  // Johto: Gold → Silver
  3: { gradient: ['#8A6100', '#5B6675'], accent: '#B19554' },
  // Hoenn: Ruby → Sapphire
  4: { gradient: ['#B0123A', '#1E40AF'], accent: '#D47F95' },
  // Sinnoh: Diamond → Pearl
  5: { gradient: ['#2F5DA8', '#B0457A'], accent: '#7C99C8' },
  // Platinum: platinum → Giratina's red-gold
  6: { gradient: ['#4B5563', '#9A3412'], accent: '#9399A1' },
  // HeartGold → SoulSilver
  7: { gradient: ['#9A6700', '#475569'], accent: '#B7934A' },
  // Unova: Black → White (a grey, so white text still reads)
  8: { gradient: ['#1F1F1F', '#6B7280'], accent: '#989898' },
  // Black 2 → White 2
  9: { gradient: ['#1E3A5F', '#B45309'], accent: '#8C9BAD' },
  12: X_Y,
  13: X_Y,
  14: X_Y,
  // Omega Ruby → Alpha Sapphire
  15: { gradient: ['#9F1239', '#1E3A8A'], accent: '#CD8498' },
  16: SUN_MOON,
  17: SUN_MOON,
  18: SUN_MOON,
  19: SUN_MOON,
  20: SUN_MOON,
  21: ULTRA_SUN_MOON,
  22: ULTRA_SUN_MOON,
  23: ULTRA_SUN_MOON,
  24: ULTRA_SUN_MOON,
  25: ULTRA_SUN_MOON,
  // Let's Go Pikachu → Eevee
  26: { gradient: ['#A16207', '#7C4A1E'], accent: '#BD9151' },
  // Galar: Sword → Shield
  27: { gradient: ['#0369A1', '#BE185D'], accent: '#60A1C4' },
  // The Isle of Armor
  28: { gradient: ['#4D7C0F', '#0369A1'], accent: '#82A357' },
  // The Crown Tundra
  29: { gradient: ['#0E7490', '#4338CA'], accent: '#5EA2B5' },
  // Hisui: Arceus gold → night sky
  30: { gradient: ['#854D0E', '#1E3A8A'], accent: '#B5926C' },
  // Paldea: Scarlet → Violet
  31: { gradient: ['#C2122F', '#6D28D9'], accent: '#DD7D8D' },
  // Kitakami (The Teal Mask)
  32: { gradient: ['#0F766E', '#B45309'], accent: '#61A59F' },
  // Blueberry Academy (The Indigo Disk)
  33: { gradient: ['#3730A3', '#0E7490'], accent: '#9793CF' },
  // Lumiose City (Legends: Z-A)
  34: { gradient: ['#15803D', '#155E75'], accent: '#5EA779' },
  // Hyperspace Lumiose (Mega Dimension)
  35: { gradient: ['#6D28D9', '#BE185D'], accent: '#AC84E9' },
};

export function dexPalette(pokedexId: number): DexPalette {
  return PALETTES[pokedexId] ?? NATIONAL;
}
