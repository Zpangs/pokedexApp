import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizeForSearch } from './national-dex';
import { isRegionalForm, isTotemForm } from './pokemon-detail';
import {
  type ListedPokemon,
  POKEMON_COLUMNS,
  POKEMON_JOINS,
  type PokemonListRow,
  toListedPokemon,
} from './pokemon-list';

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

export type AbilityHolder = ListedPokemon & { isHidden: boolean };

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
    formerHolders: former
      .filter((r) => !isTotemForm(r.form))
      .map((r) => ({ ...toHolder(r), until: numeral(r.generation) })),
  };
}

type HolderRow = PokemonListRow & { is_hidden: number };

function toHolder(r: HolderRow): AbilityHolder {
  return { ...toListedPokemon(r), isHidden: r.is_hidden === 1 };
}

function numeral(generation: string) {
  return generation.replace('generation-', '').toUpperCase();
}
