import type { SQLiteDatabase } from 'expo-sqlite';

import { type DexEntry, normalizeForSearch } from './national-dex';

export const NATIONAL_DEX_ID = 1;

export type PokedexOption = {
  /** `pokedexes.id`. */
  id: number;
  /** "Paldea", "Original Johto", "Isle of Armor"… */
  name: string;
  /** The games that use it, e.g. "Scarlet / Violet". Empty for the National Dex. */
  games: string;
  /** Generation of the first game that uses it (1 for the National Dex). */
  generationId: number;
  size: number;
};

/**
 * Japan-only releases that share a dex with an international one; they'd only repeat it.
 * DLC labels replace their long per-version names ("Sword: The Isle of Armor / Shield: …").
 */
const HIDDEN_VERSION_GROUPS = new Set(['red-green-japan', 'blue-japan']);
const DLC_LABELS: Record<string, string> = {
  'the-isle-of-armor': 'The Isle of Armor',
  'the-crown-tundra': 'The Crown Tundra',
  'the-teal-mask': 'The Teal Mask',
  'the-indigo-disk': 'The Indigo Disk',
  'mega-dimension': 'Mega Dimension',
};

/**
 * Dexes whose games show a species in its regional form: Alolan Raichu in Alola, Galarian
 * Ponyta in Galar and its DLC areas, Hisuian Growlithe in Hisui, Paldean Wooper in Paldea.
 * Kitakami and Blueberry are left alone: they mix forms from several regions.
 */
const REGIONAL_FORMS: Record<string, string> = {
  'original-alola': 'alola',
  'original-melemele': 'alola',
  'original-akala': 'alola',
  'original-ulaula': 'alola',
  'original-poni': 'alola',
  'updated-alola': 'alola',
  'updated-melemele': 'alola',
  'updated-akala': 'alola',
  'updated-ulaula': 'alola',
  'updated-poni': 'alola',
  galar: 'galar',
  'isle-of-armor': 'galar',
  'crown-tundra': 'galar',
  hisui: 'hisui',
  paldea: 'paldea',
};

type PokedexRow = {
  id: number;
  identifier: string;
  name: string;
  size: number;
  version_group: string | null;
  version_group_name: string | null;
  generation_id: number | null;
};

/** The National Dex, then every main-series regional dex in release order. */
export async function loadPokedexes(db: SQLiteDatabase): Promise<PokedexOption[]> {
  // One row per dex and game; names of a game's versions are joined ("Scarlet / Violet")
  const rows = await db.getAllAsync<PokedexRow>(`
    SELECT p.id, p.identifier, pr.name,
           (SELECT COUNT(*) FROM pokemon_dex_numbers d WHERE d.pokedex_id = p.id) AS size,
           vg.identifier AS version_group, vg.generation_id,
           (SELECT GROUP_CONCAT(vn.name, ' / ') FROM versions v
              JOIN version_names vn ON vn.version_id = v.id
             WHERE v.version_group_id = vg.id) AS version_group_name
    FROM pokedexes p
    JOIN pokedex_prose pr ON pr.pokedex_id = p.id
    LEFT JOIN pokedex_version_groups pvg ON pvg.pokedex_id = p.id
    LEFT JOIN version_groups vg ON vg.id = pvg.version_group_id
    WHERE p.is_main_series = 1
    ORDER BY p.id = ${NATIONAL_DEX_ID} DESC, vg."order"`);

  const byId = new Map<number, PokedexRow[]>();
  for (const row of rows) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);

  const options = [...byId.values()].map((games) => {
    const first = games[0];
    const visible = games.filter(
      (g) => g.version_group && !HIDDEN_VERSION_GROUPS.has(g.version_group)
    );
    const dlc = visible.filter((g) => g.version_group! in DLC_LABELS);
    const labels = (dlc.length ? dlc : visible).map(
      (g) => DLC_LABELS[g.version_group!] ?? g.version_group_name ?? ''
    );
    return {
      option: {
        id: first.id,
        name: first.id === NATIONAL_DEX_ID ? 'National' : first.name,
        games: labels.join(' · '),
        generationId: first.generation_id ?? 1,
        size: first.size,
      },
      // Rows come in release order, so the first is the earliest game
      order: rows.indexOf(first),
    };
  });

  return options.sort((a, b) => a.order - b.order || a.option.id - b.option.id).map((o) => o.option);
}

type EntryRow = {
  dex_number: number;
  number: number;
  name: string;
  pokemon_id: number;
  generation_id: number;
  type1: string;
  type1_name: string;
  type2: string | null;
  type2_name: string | null;
};

/**
 * A regional dex in its own order. `dexNumber` is the regional number; `number` stays the
 * National Dex number, which the Pokémon page uses. Where the games show a regional form,
 * the entry is that form (name, types and sprite).
 */
export async function loadRegionalDex(db: SQLiteDatabase, pokedexId: number): Promise<DexEntry[]> {
  const dex = await db.getFirstAsync<{ identifier: string }>(
    'SELECT identifier FROM pokedexes WHERE id = ?',
    pokedexId
  );
  const region = dex ? REGIONAL_FORMS[dex.identifier] : undefined;

  // The form to show: the region's own form when there is one ("paldea" or
  // "paldea-combat-breed", not Pikachu's "alola-cap"), otherwise the default form
  const rows = await db.getAllAsync<EntryRow>(
    `
    WITH chosen AS (
      SELECT d.pokedex_number, d.species_id,
             COALESCE(
               (SELECT p.id FROM pokemon p
                  JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
                 WHERE p.species_id = d.species_id AND p.is_default = 0
                   AND (f.form_identifier = ?1 OR f.form_identifier LIKE ?1 || '-%')
                   AND f.form_identifier NOT LIKE '%-cap'
                 ORDER BY p."order", p.id LIMIT 1),
               (SELECT p.id FROM pokemon p WHERE p.species_id = d.species_id AND p.is_default = 1)
             ) AS pokemon_id
      FROM pokemon_dex_numbers d
      WHERE d.pokedex_id = ?2
    )
    SELECT c.pokedex_number AS dex_number, s.id AS number,
           COALESCE(CASE WHEN p.is_default = 0 THEN fn.pokemon_name END, n.name) AS name,
           p.id AS pokemon_id, s.generation_id,
           t1.identifier AS type1, tn1.name AS type1_name,
           t2.identifier AS type2, tn2.name AS type2_name
    FROM chosen c
    JOIN pokemon_species s ON s.id = c.species_id
    JOIN pokemon_species_names n ON n.pokemon_species_id = s.id
    JOIN pokemon p ON p.id = c.pokemon_id
    LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
    LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
    JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
    JOIN types t1 ON t1.id = pt1.type_id
    JOIN type_names tn1 ON tn1.type_id = t1.id
    LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
    LEFT JOIN types t2 ON t2.id = pt2.type_id
    LEFT JOIN type_names tn2 ON tn2.type_id = t2.id
    ORDER BY c.pokedex_number`,
    region ?? '',
    pokedexId
  );

  return rows.map((r) => ({
    number: r.number,
    dexNumber: r.dex_number,
    name: r.name,
    pokemonId: r.pokemon_id,
    generationId: r.generation_id,
    types: [
      { identifier: r.type1, name: r.type1_name },
      ...(r.type2 && r.type2_name ? [{ identifier: r.type2, name: r.type2_name }] : []),
    ],
    searchName: normalizeForSearch(r.name),
  }));
}
