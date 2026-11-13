import type { SQLiteDatabase } from 'expo-sqlite';

export type DexType = { identifier: string; name: string };

export type DexEntry = {
  /** National Dex number (`pokemon_species.id`). */
  number: number;
  /** The number shown in the list: the National number, or the regional one in a regional dex. */
  dexNumber: number;
  name: string;
  /** Default form's `pokemon.id`, used for sprites. */
  pokemonId: number;
  types: DexType[];
  generationId: number;
  /** Lowercase name without accents or punctuation, for search ("flabebe" finds Flabébé). */
  searchName: string;
};

export type DexGeneration = {
  id: number;
  /** Roman numeral, e.g. "IX". */
  numeral: string;
  /** Main region, e.g. "Paldea". */
  region: string;
  first: number;
  last: number;
};

type Row = {
  number: number;
  name: string;
  pokemon_id: number;
  generation_id: number;
  type1: string;
  type1_name: string;
  type2: string | null;
  type2_name: string | null;
};

type GenerationRow = {
  id: number;
  identifier: string;
  region: string;
  first: number;
  last: number;
};

/**
 * Lowercase, without accents or punctuation, so "flabebe", "farfetchd", "mr mime" and
 * "ho-oh" all match. Spaces are kept so a query can still be split into words.
 */
export function normalizeForSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, '');
}

/** Every species in National Dex order, with its default form's types. */
export async function loadNationalDex(db: SQLiteDatabase) {
  const [rows, generations] = await Promise.all([
    db.getAllAsync<Row>(`
      SELECT s.id AS number, n.name, p.id AS pokemon_id, s.generation_id,
             t1.identifier AS type1, tn1.name AS type1_name,
             t2.identifier AS type2, tn2.name AS type2_name
      FROM pokemon_species s
      JOIN pokemon_species_names n ON n.pokemon_species_id = s.id
      JOIN pokemon p ON p.species_id = s.id AND p.is_default = 1
      JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
      JOIN types t1 ON t1.id = pt1.type_id
      JOIN type_names tn1 ON tn1.type_id = t1.id
      LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
      LEFT JOIN types t2 ON t2.id = pt2.type_id
      LEFT JOIN type_names tn2 ON tn2.type_id = t2.id
      ORDER BY s.id`),
    db.getAllAsync<GenerationRow>(`
      SELECT g.id, g.identifier, rn.name AS region, MIN(s.id) AS first, MAX(s.id) AS last
      FROM generations g
      JOIN region_names rn ON rn.region_id = g.main_region_id
      JOIN pokemon_species s ON s.generation_id = g.id
      GROUP BY g.id
      ORDER BY g.id`),
  ]);

  const entries: DexEntry[] = rows.map((r) => ({
    number: r.number,
    dexNumber: r.number,
    name: r.name,
    pokemonId: r.pokemon_id,
    generationId: r.generation_id,
    types: [
      { identifier: r.type1, name: r.type1_name },
      ...(r.type2 && r.type2_name ? [{ identifier: r.type2, name: r.type2_name }] : []),
    ],
    searchName: normalizeForSearch(r.name),
  }));

  const gens: DexGeneration[] = generations.map((g) => ({
    id: g.id,
    numeral: g.identifier.replace('generation-', '').toUpperCase(),
    region: g.region,
    first: g.first,
    last: g.last,
  }));

  return { entries, generations: gens };
}

/**
 * Matches a search query against an entry. Every word must match:
 * a number matches list numbers (National or regional) starting with it ("25", "#025"), and a word matches
 * the name (anywhere) or a type (from the start), so "fire fly" finds Charizard.
 */
export function matchesQuery(entry: DexEntry, words: string[]) {
  return words.every((word) => {
    const digits = word.replace(/^#/, '');
    if (/^\d+$/.test(digits)) {
      return String(entry.dexNumber).startsWith(String(Number(digits)));
    }
    return (
      entry.searchName.includes(word) ||
      entry.types.some((t) => t.identifier.startsWith(word))
    );
  });
}

export function queryWords(query: string) {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

/** National numbers have four digits (0025); regional ones three, as in the games (025). */
export function formatDexNumber(n: number, digits = 4) {
  return String(n).padStart(digits, '0');
}
