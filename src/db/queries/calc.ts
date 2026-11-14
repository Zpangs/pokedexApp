import type { SQLiteDatabase } from 'expo-sqlite';

import { type GameData, loadAbilitiesFor, loadBaseStats, type StatSpread, type TeamAbility } from './team-builder';

/** What the damage calculator needs beyond the team builder's data. */

export type MoveInfo = {
  identifier: string;
  flags: Set<string>;
  minHits: number;
  maxHits: number;
  /** Hits both opponents (or everyone) in a double battle. */
  spread: boolean;
  /** A chance of a side effect on the target, or of raising the user's stats (Sheer Force). */
  secondary: boolean;
  recoil: boolean;
};

const moveCache = new Map<number, Promise<MoveInfo | null>>();

export function loadMoveInfo(db: SQLiteDatabase, moveId: number) {
  let cached = moveCache.get(moveId);
  if (!cached) {
    cached = db
      .getFirstAsync<{
        identifier: string;
        target_id: number;
        min_hits: number | null;
        max_hits: number | null;
        drain: number | null;
        category: number | null;
        ailment_chance: number | null;
        flinch_chance: number | null;
        stat_chance: number | null;
        drops: number;
        flags: string | null;
      }>(
        `SELECT m.identifier, m.target_id, mm.min_hits, mm.max_hits, mm.drain,
                mm.meta_category_id AS category, mm.ailment_chance, mm.flinch_chance, mm.stat_chance,
                (SELECT COUNT(*) FROM move_meta_stat_changes s WHERE s.move_id = m.id AND s.change < 0) AS drops,
                (SELECT GROUP_CONCAT(f.identifier) FROM move_flag_map fm
                 JOIN move_flags f ON f.id = fm.move_flag_id WHERE fm.move_id = m.id) AS flags
         FROM moves m LEFT JOIN move_meta mm ON mm.move_id = m.id
         WHERE m.id = ?`,
        moveId
      )
      .then((r) => {
        if (!r) return null;
        // Lowering the target's stats counts, lowering the user's own (Close Combat) doesn't
        const statEffect = (r.stat_chance ?? 0) > 0 && (r.category === 6 || (r.category === 7 && r.drops === 0));
        return {
          identifier: r.identifier,
          flags: new Set(r.flags ? r.flags.split(',') : []),
          minHits: r.min_hits ?? 1,
          maxHits: r.max_hits ?? 1,
          spread: r.target_id === 9 || r.target_id === 11,
          secondary: (r.ailment_chance ?? 0) > 0 || (r.flinch_chance ?? 0) > 0 || statEffect,
          recoil: (r.drain ?? 0) < 0,
        };
      });
    cached.catch(() => moveCache.delete(moveId));
    moveCache.set(moveId, cached);
  }
  return cached;
}

/** A Pokémon as it battles: Mega Evolved when it holds its Mega Stone (or Primal orb). */
export type BattlePokemon = {
  pokemonId: number;
  name: string;
  /** Species identifier, for species-only items (Light Ball…). */
  species: string;
  types: number[];
  baseStats: StatSpread;
  /** A Mega's ability is fixed; null means the chosen one applies. */
  forcedAbility: TeamAbility | null;
  weightKg: number;
  nfe: boolean;
  shedinja: boolean;
  /** "Mega Charizard Y" while Mega Evolved. */
  megaName: string | null;
};

const battleCache = new Map<string, Promise<BattlePokemon | null>>();

export function loadBattlePokemon(db: SQLiteDatabase, data: GameData, pokemonId: number, itemId: number | null) {
  const item = itemId !== null ? data.itemById.get(itemId) : undefined;
  const mega = item?.megaFor && item.megaFor.basePokemonId === pokemonId ? item.megaFor.megaPokemonId : null;
  const key = `${data.game.versionGroupId}:${pokemonId}:${mega ?? ''}`;
  let cached = battleCache.get(key);
  if (!cached) {
    cached = buildBattlePokemon(db, data, pokemonId, mega);
    cached.catch(() => battleCache.delete(key));
    battleCache.set(key, cached);
  }
  return cached;
}

async function buildBattlePokemon(
  db: SQLiteDatabase,
  data: GameData,
  pokemonId: number,
  megaId: number | null
): Promise<BattlePokemon | null> {
  const base = data.pokemonById.get(pokemonId);
  if (!base) return null;
  const id = megaId ?? pokemonId;
  const gen = data.game.generation;
  const [row, baseStats, megaTypes, megaAbilities] = await Promise.all([
    db.getFirstAsync<{ weight: number; species: string; identifier: string; nfe: number; name: string | null }>(
      `SELECT p.weight, s.identifier AS species, p.identifier,
              EXISTS (SELECT 1 FROM pokemon_species e WHERE e.evolves_from_species_id = s.id) AS nfe,
              (SELECT fn.pokemon_name FROM pokemon_forms f
               JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id WHERE f.pokemon_id = p.id) AS name
       FROM pokemon p JOIN pokemon_species s ON s.id = p.species_id WHERE p.id = ?`,
      id
    ),
    loadBaseStats(db, id, gen),
    megaId !== null
      ? db.getAllAsync<{ type_id: number }>(`SELECT type_id FROM pokemon_types WHERE pokemon_id = ? ORDER BY slot`, megaId)
      : Promise.resolve(null),
    megaId !== null ? loadAbilitiesFor(db, megaId, gen, { ...data.rules, hiddenAbilities: true }) : Promise.resolve([]),
  ]);
  if (!row) return null;
  return {
    pokemonId: id,
    name: megaId !== null ? (row.name ?? base.name) : base.name,
    species: row.species,
    types: megaTypes ? megaTypes.map((t) => t.type_id) : base.typeIds,
    baseStats,
    forcedAbility: megaAbilities[0] ?? null,
    weightKg: row.weight / 10,
    nfe: row.nfe === 1,
    shedinja: row.identifier === 'shedinja',
    megaName: megaId !== null ? (row.name ?? null) : null,
  };
}
