import type { SQLiteDatabase } from 'expo-sqlite';

import type { DexType } from './national-dex';
import { isRegionalForm, isTotemForm } from './pokemon-detail';
import {
  type ListedPokemon,
  POKEMON_COLUMNS,
  POKEMON_JOINS,
  type PokemonListRow,
  toListedPokemon,
} from './pokemon-list';

/** Normal to Fairy; Stellar (Tera only), Unknown and Shadow aren't battle types. */
const BATTLE_TYPE_MAX_ID = 18;

export type BattleType = DexType & {
  id: number;
  /** Generation it was introduced in, as a numeral ("VI"). */
  generation: string;
  /** "Physical" or "Special": before Gen IV, every move of a type had the same category. */
  oldCategory: string | null;
};

/** How hard each attacking type hits each defending type, keyed `attacker id` → `target id`. */
export type TypeChart = Map<number, Map<number, number>>;

export type TypeData = { types: BattleType[]; chart: TypeChart };

let cache: Promise<TypeData> | null = null;

/** The 18 battle types and today's type chart. Loaded once; it never changes. */
export function loadTypeData(db: SQLiteDatabase): Promise<TypeData> {
  cache ??= Promise.all([
    db.getAllAsync<{
      id: number;
      identifier: string;
      name: string;
      generation: string;
      category: string | null;
    }>(
      `SELECT t.id, t.identifier, tn.name, g.identifier AS generation, dc.name AS category
       FROM types t
       JOIN type_names tn ON tn.type_id = t.id
       JOIN generations g ON g.id = t.generation_id
       LEFT JOIN move_damage_class_prose dc ON dc.move_damage_class_id = t.damage_class_id
       WHERE t.id <= ${BATTLE_TYPE_MAX_ID}
       ORDER BY t.id`
    ),
    db.getAllAsync<{ attacker: number; target: number; factor: number }>(
      `SELECT damage_type_id AS attacker, target_type_id AS target, damage_factor AS factor
       FROM type_efficacy
       WHERE damage_type_id <= ${BATTLE_TYPE_MAX_ID} AND target_type_id <= ${BATTLE_TYPE_MAX_ID}`
    ),
  ]).then(([types, efficacy]) => {
    const chart: TypeChart = new Map();
    for (const e of efficacy) {
      const row = chart.get(e.attacker) ?? new Map<number, number>();
      row.set(e.target, e.factor / 100);
      chart.set(e.attacker, row);
    }
    return {
      types: types.map((t) => ({
        id: t.id,
        identifier: t.identifier,
        name: t.name,
        generation: numeral(t.generation),
        oldCategory: t.category ? t.category[0].toUpperCase() + t.category.slice(1) : null,
      })),
      chart,
    };
  });
  return cache;
}

/** Damage multiplier of an `attacker` move against a Pokémon with the `defenders` types. */
export function effectiveness(chart: TypeChart, attacker: number, defenders: number[]) {
  return defenders.reduce((m, d) => m * (chart.get(attacker)?.get(d) ?? 1), 1);
}

export type ChartChange = {
  attacker: DexType;
  target: DexType;
  /** The multiplier it had up to and including `until`. */
  factor: number;
  /** Last generation with the old multiplier, as a numeral ("V"). */
  until: string;
};

/** Older type charts that differ from today's, where `typeId` attacks or defends. */
export async function loadChartChanges(db: SQLiteDatabase, typeId: number): Promise<ChartChange[]> {
  const rows = await db.getAllAsync<{
    attacker: string;
    attacker_name: string;
    target: string;
    target_name: string;
    factor: number;
    generation: string;
  }>(
    `SELECT a.identifier AS attacker, an.name AS attacker_name, t.identifier AS target,
            tn.name AS target_name, p.damage_factor AS factor, g.identifier AS generation
     FROM type_efficacy_past p
     JOIN types a ON a.id = p.damage_type_id
     JOIN type_names an ON an.type_id = a.id
     JOIN types t ON t.id = p.target_type_id
     JOIN type_names tn ON tn.type_id = t.id
     JOIN generations g ON g.id = p.generation_id
     WHERE p.damage_type_id = ? OR p.target_type_id = ?
     ORDER BY p.generation_id DESC, a.id, t.id`,
    typeId,
    typeId
  );
  return rows.map((r) => ({
    attacker: { identifier: r.attacker, name: r.attacker_name },
    target: { identifier: r.target, name: r.target_name },
    factor: r.factor / 100,
    until: numeral(r.generation),
  }));
}

/**
 * Every Pokémon with all of `typeIds` (one type, or a pair in either slot), by Dex number.
 * Forms that only repeat their default form's types (Pikachu in a cap, most Megas) and
 * Totems are left out; regional forms stay.
 */
export async function loadPokemonOfTypes(
  db: SQLiteDatabase,
  typeIds: number[]
): Promise<ListedPokemon[]> {
  const rows = await db.getAllAsync<PokemonListRow & { type_ids: string }>(
    `SELECT ${POKEMON_COLUMNS},
            (SELECT GROUP_CONCAT(type_id) FROM pokemon_types WHERE pokemon_id = p.id) AS type_ids
     FROM pokemon p
     ${POKEMON_JOINS}
     WHERE ${typeIds
       .map(() => 'EXISTS (SELECT 1 FROM pokemon_types x WHERE x.pokemon_id = p.id AND x.type_id = ?)')
       .join(' AND ')}
     ORDER BY p.species_id, p.is_default DESC, p."order", p.id`,
    ...typeIds
  );
  const typesOf = (r: (typeof rows)[number]) => r.type_ids.split(',').sort().join(',');
  const defaults = new Set(rows.filter((r) => r.is_default === 1).map((r) => `${r.number}|${typesOf(r)}`));
  return rows
    .filter(
      (r) =>
        !isTotemForm(r.form) &&
        (r.is_default === 1 || isRegionalForm(r.form) || !defaults.has(`${r.number}|${typesOf(r)}`))
    )
    .map(toListedPokemon);
}

export type Nature = {
  id: number;
  name: string;
  /** Short stat names ("Atk", "Sp. Atk"); null for the five neutral natures. */
  raises: string | null;
  lowers: string | null;
  /** The stat it raises, for grouping ("attack"…); null when neutral. */
  raisesId: string | null;
  lowersId: string | null;
  /** Berry flavors, for berries that confuse a Pokémon that dislikes them. */
  likes: string | null;
  dislikes: string | null;
};

/** PokéAPI's berry flavor ids (its flavor names table isn't imported). */
const FLAVORS: Record<number, string> = { 1: 'Spicy', 2: 'Dry', 3: 'Sweet', 4: 'Bitter', 5: 'Sour' };

const STAT_SHORT: Record<string, string> = {
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
};

/** Order the stats appear in on a summary screen. */
export const NATURE_STAT_ORDER = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];

export function statLabel(identifier: string) {
  return STAT_SHORT[identifier] ?? identifier;
}

/** All 25 natures, A to Z. */
export async function loadNatures(db: SQLiteDatabase): Promise<Nature[]> {
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    raises: string;
    lowers: string;
    likes: number;
    hates: number;
  }>(
    `SELECT n.id, nn.name, si.identifier AS raises, sd.identifier AS lowers,
            n.likes_flavor_id AS likes, n.hates_flavor_id AS hates
     FROM natures n
     JOIN nature_names nn ON nn.nature_id = n.id
     JOIN stats si ON si.id = n.increased_stat_id
     JOIN stats sd ON sd.id = n.decreased_stat_id
     ORDER BY nn.name`
  );
  return rows.map((r) => {
    const neutral = r.raises === r.lowers;
    return {
      id: r.id,
      name: r.name,
      raises: neutral ? null : statLabel(r.raises),
      lowers: neutral ? null : statLabel(r.lowers),
      raisesId: neutral ? null : r.raises,
      lowersId: neutral ? null : r.lowers,
      likes: neutral ? null : (FLAVORS[r.likes] ?? null),
      dislikes: neutral ? null : (FLAVORS[r.hates] ?? null),
    };
  });
}

function numeral(generation: string) {
  return generation.replace('generation-', '').toUpperCase();
}
