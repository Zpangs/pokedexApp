import type { SQLiteDatabase } from 'expo-sqlite';

import { type DexType, normalizeForSearch } from './national-dex';
import { isRegionalForm, isTotemForm } from './pokemon-detail';

export type AbilitySummary = {
  id: number;
  name: string;
  /** One-line mechanical effect, from PokéAPI. */
  effect: string | null;
  /** Lowercase name without accents or punctuation, for search. */
  searchName: string;
  /** The effect, normalized the same way, with a leading space for word-start matching. */
  searchEffect: string;
};

/** Every main-series ability, A to Z (Conquest's abilities are left out). */
export async function loadAbilities(db: SQLiteDatabase): Promise<AbilitySummary[]> {
  const rows = await db.getAllAsync<{ id: number; name: string; effect: string | null }>(`
    SELECT a.id, an.name, ap.short_effect AS effect
    FROM abilities a
    JOIN ability_names an ON an.ability_id = a.id
    LEFT JOIN ability_prose ap ON ap.ability_id = a.id
    WHERE a.is_main_series = 1
    ORDER BY an.name, a.id`);
  return rows.map((r) => ({
    ...r,
    searchName: normalizeForSearch(r.name),
    searchEffect: ` ${normalizeForSearch(r.effect ?? '')}`,
  }));
}

/**
 * Every word must match the name (anywhere) or start a word of the effect, so "sleep"
 * finds Insomnia and "intim" finds Intimidate.
 */
export function matchesAbilityQuery(ability: AbilitySummary, words: string[]) {
  return words.every(
    (word) => ability.searchName.includes(word) || ability.searchEffect.includes(` ${word}`)
  );
}

export type AbilityChange = {
  /** The first game with the current behaviour, e.g. "Black / White". */
  since: string;
  /** What it did before. */
  before: string;
};

export type AbilityHolder = {
  /** National Dex number. */
  number: number;
  pokemonId: number;
  /** "Gyarados", or a form's own name ("Mega Manectric"). */
  name: string;
  types: DexType[];
  isHidden: boolean;
};

export type FormerHolder = AbilityHolder & {
  /** The last generation it had the ability in, as a numeral ("VI"). */
  until: string;
};

export type AbilityDetail = {
  id: number;
  name: string;
  effect: string | null;
  /** Longer explanation, split into paragraphs. */
  details: string[];
  /** The most recent game's in-game description. */
  flavorText: string | null;
  generation: string;
  changes: AbilityChange[];
  holders: AbilityHolder[];
  formerHolders: FormerHolder[];
};

type HolderRow = {
  number: number;
  pokemon_id: number;
  is_default: number;
  form: string | null;
  name: string;
  is_hidden: number;
  type1: string;
  type1_name: string;
  type2: string | null;
  type2_name: string | null;
};

/** Name and types of a Pokémon `p`, with forms under their own name ("Alolan Raichu"). */
const POKEMON_COLUMNS = `
  p.species_id AS number, p.id AS pokemon_id, p.is_default, f.form_identifier AS form,
  COALESCE(CASE WHEN p.is_default = 0 THEN fn.pokemon_name END, sn.name) AS name,
  t1.identifier AS type1, tn1.name AS type1_name, t2.identifier AS type2, tn2.name AS type2_name`;
const POKEMON_JOINS = `
  JOIN pokemon_species_names sn ON sn.pokemon_species_id = p.species_id
  LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
  LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
  JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
  JOIN types t1 ON t1.id = pt1.type_id
  JOIN type_names tn1 ON tn1.type_id = t1.id
  LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
  LEFT JOIN types t2 ON t2.id = pt2.type_id
  LEFT JOIN type_names tn2 ON tn2.type_id = t2.id`;

function toHolder(r: HolderRow): AbilityHolder {
  return {
    number: r.number,
    pokemonId: r.pokemon_id,
    name: r.name,
    isHidden: r.is_hidden === 1,
    types: [
      { identifier: r.type1, name: r.type1_name },
      ...(r.type2 && r.type2_name ? [{ identifier: r.type2, name: r.type2_name }] : []),
    ],
  };
}

export async function loadAbility(db: SQLiteDatabase, id: number): Promise<AbilityDetail | null> {
  const ability = await db.getFirstAsync<{
    id: number;
    name: string;
    effect: string | null;
    details: string | null;
    generation: string;
  }>(
    `SELECT a.id, an.name, ap.short_effect AS effect, ap.effect AS details, g.identifier AS generation
     FROM abilities a
     JOIN ability_names an ON an.ability_id = a.id
     JOIN generations g ON g.id = a.generation_id
     LEFT JOIN ability_prose ap ON ap.ability_id = a.id
     WHERE a.id = ? AND a.is_main_series = 1`,
    id
  );
  if (!ability) return null;

  const [flavor, changes, holders, former] = await Promise.all([
    db.getFirstAsync<{ flavor_text: string }>(
      `SELECT f.flavor_text FROM ability_flavor_text f
       JOIN version_groups vg ON vg.id = f.version_group_id
       WHERE f.ability_id = ? ORDER BY vg."order" DESC LIMIT 1`,
      id
    ),
    db.getAllAsync<{ since: string; effect: string }>(
      `SELECT (SELECT GROUP_CONCAT(vn.name, ' / ') FROM versions v
                JOIN version_names vn ON vn.version_id = v.id WHERE v.version_group_id = vg.id) AS since,
              p.effect
       FROM ability_changelog c
       JOIN ability_changelog_prose p ON p.ability_changelog_id = c.id
       JOIN version_groups vg ON vg.id = c.changed_in_version_group_id
       WHERE c.ability_id = ?
       ORDER BY vg."order" DESC`,
      id
    ),
    db.getAllAsync<HolderRow>(
      `SELECT ${POKEMON_COLUMNS}, pa.is_hidden
       FROM pokemon_abilities pa
       JOIN pokemon p ON p.id = pa.pokemon_id
       ${POKEMON_JOINS}
       WHERE pa.ability_id = ?
       ORDER BY pa.is_hidden, p.species_id, p.is_default DESC, p."order", p.id`,
      id
    ),
    // Each row is an ability a Pokémon had up to and including that generation
    db.getAllAsync<HolderRow & { generation: string }>(
      `SELECT ${POKEMON_COLUMNS}, pap.is_hidden, g.identifier AS generation
       FROM pokemon_abilities_past pap
       JOIN pokemon p ON p.id = pap.pokemon_id
       JOIN generations g ON g.id = pap.generation_id
       ${POKEMON_JOINS}
       WHERE pap.ability_id = ?
         AND NOT EXISTS (SELECT 1 FROM pokemon_abilities pa
                         WHERE pa.pokemon_id = pap.pokemon_id AND pa.ability_id = pap.ability_id)
       ORDER BY p.species_id, p.id`,
      id
    ),
  ]);

  // Forms that have it exactly like their default form (Squawkabilly's plumages) would only
  // repeat it; regional forms stay, since they're Pokémon players look for by name
  const defaults = new Set(
    holders.filter((r) => r.is_default === 1).map((r) => `${r.number}|${r.is_hidden}`)
  );
  const repeats = (r: HolderRow) =>
    isTotemForm(r.form) ||
    (r.is_default === 0 && !isRegionalForm(r.form) && defaults.has(`${r.number}|${r.is_hidden}`));

  return {
    id: ability.id,
    name: ability.name,
    effect: ability.effect,
    details: (ability.details ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    flavorText: flavor?.flavor_text ?? null,
    generation: numeral(ability.generation),
    changes: changes.map((c) => ({ since: c.since, before: c.effect })),
    holders: holders.filter((r) => !repeats(r)).map(toHolder),
    formerHolders: former.filter((r) => !isTotemForm(r.form)).map((r) => ({ ...toHolder(r), until: numeral(r.generation) })),
  };
}

function numeral(generation: string) {
  return generation.replace('generation-', '').toUpperCase();
}
