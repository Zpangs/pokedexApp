import type { SQLiteDatabase } from 'expo-sqlite';

import type { DexType } from './national-dex';
import { isRegionalForm, isTotemForm } from './pokemon-detail';
import { type BattleType, loadNatures, loadTypeData, type Nature, type TypeChart } from './types';

/**
 * Everything the team builder needs, for one game (version group) at a time: which Pokémon,
 * moves, abilities and items exist there, and which battle gimmicks the game has. Older games
 * get their own types, base stats, abilities, move stats and type chart where they differed.
 */

// ── Games and their rules ─────────────────────────────────────────────────────────────────

export type TeamGame = {
  versionGroupId: number;
  identifier: string;
  /** "Scarlet / Violet" */
  name: string;
  generation: number;
  order: number;
};

/** What a game lets you set on a team member. */
export type GameRules = {
  abilities: boolean;
  hiddenAbilities: boolean;
  heldItems: boolean;
  natures: boolean;
  /** EVs and IVs as Gen III onward has them (0–252 / 0–31). */
  spreads: boolean;
  mega: boolean;
  zMoves: boolean;
  dynamax: boolean;
  tera: boolean;
};

/** Japanese-only releases and the GameCube side games aren't offered. */
const SKIPPED_GAMES = new Set(['red-green-japan', 'blue-japan', 'colosseum', 'xd']);
/** No abilities or held items, and their own stat systems (AVs, effort levels). */
const SIMPLIFIED_GAMES = new Set(['lets-go-pikachu-lets-go-eevee', 'legends-arceus']);
const MEGA_GAMES = new Set([
  'x-y',
  'omega-ruby-alpha-sapphire',
  'sun-moon',
  'ultra-sun-ultra-moon',
  'champions',
  'legends-za',
]);
const Z_GAMES = new Set(['sun-moon', 'ultra-sun-ultra-moon']);

export function rulesFor(game: Pick<TeamGame, 'identifier' | 'generation'>): GameRules {
  const simplified = SIMPLIFIED_GAMES.has(game.identifier);
  return {
    abilities: game.generation >= 3 && !simplified,
    hiddenAbilities: game.generation >= 5 && !simplified,
    heldItems: game.generation >= 2 && !simplified,
    natures: game.generation >= 3,
    spreads: game.generation >= 3 && !simplified,
    mega: MEGA_GAMES.has(game.identifier),
    zMoves: Z_GAMES.has(game.identifier),
    dynamax: game.identifier === 'sword-shield',
    tera: game.identifier === 'scarlet-violet',
  };
}

let gamesCache: Promise<TeamGame[]> | null = null;

/** Games a team can be built for (those with learnsets), newest first. */
export function loadTeamGames(db: SQLiteDatabase): Promise<TeamGame[]> {
  gamesCache ??= db
    .getAllAsync<{ id: number; identifier: string; generation: number; order: number; names: string }>(
      `SELECT vg.id, vg.identifier, vg.generation_id AS generation, vg."order",
              GROUP_CONCAT(vn.name, ' / ') AS names
       FROM version_groups vg
       JOIN versions v ON v.version_group_id = vg.id
       JOIN version_names vn ON vn.version_id = v.id
       WHERE EXISTS (SELECT 1 FROM pokemon_moves pm WHERE pm.version_group_id = vg.id)
       GROUP BY vg.id
       ORDER BY vg."order" DESC`
    )
    .then((rows) =>
      rows
        .filter((r) => !SKIPPED_GAMES.has(r.identifier))
        .map((r) => ({
          versionGroupId: r.id,
          identifier: r.identifier,
          name: r.names.replace(/’/g, "'"),
          generation: r.generation,
          order: r.order,
        }))
    );
  return gamesCache;
}

// ── Stats ─────────────────────────────────────────────────────────────────────────────────

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type StatSpread = Record<StatKey, number>;

/** Showdown's abbreviations, also used on screen. */
export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

const STAT_BY_ID: Record<number, StatKey> = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe' };
const STAT_BY_IDENTIFIER: Record<string, StatKey> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
};

export function statKey(identifier: string): StatKey | null {
  return STAT_BY_IDENTIFIER[identifier] ?? null;
}

export const MAX_EV = 252;
export const MAX_EV_TOTAL = 510;
export const MAX_IV = 31;

/**
 * A stat's value at `level`. Gen I–II have no natures, and their DVs and stat experience are
 * taken at their maximum, as Showdown does.
 */
export function calcStat(
  key: StatKey,
  base: number,
  level: number,
  ev: number,
  iv: number,
  natureMultiplier: number,
  shedinja = false
) {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (key === 'hp') return shedinja ? 1 : core + level + 10;
  return Math.floor((core + 5) * natureMultiplier);
}

/**
 * All six stats for a spread. Without EVs and IVs in the game, Gen I–II take the best DVs and
 * full stat experience (as Showdown does) and later games the maximum IVs.
 */
export function spreadStats(
  base: StatSpread,
  spread: { level: number; evs: StatSpread; ivs: StatSpread; natureId: number | null },
  data: Pick<GameData, 'rules' | 'game' | 'natures'>,
  shedinja = false
): StatSpread {
  const { rules, game } = data;
  const nature = data.natures.find((n) => n.id === spread.natureId);
  const up = nature?.raisesId ? statKey(nature.raisesId) : null;
  const down = nature?.lowersId ? statKey(nature.lowersId) : null;
  const out = { ...base };
  for (const k of STAT_KEYS) {
    const ev = rules.spreads ? spread.evs[k] : game.generation <= 2 ? MAX_EV : 0;
    const iv = rules.spreads ? spread.ivs[k] : game.generation <= 2 ? 30 : MAX_IV;
    const mult = k === up ? 1.1 : k === down ? 0.9 : 1;
    out[k] = calcStat(k, base[k], spread.level, ev, iv, mult, shedinja);
  }
  return out;
}

// ── Per-game data ─────────────────────────────────────────────────────────────────────────

export type TeamPokemon = {
  pokemonId: number;
  /** National Dex number. */
  number: number;
  identifier: string;
  /** The species' identifier ("urshifu"), for Showdown names. */
  speciesIdentifier: string;
  speciesName: string;
  /** "Alolan Ninetales" for forms. */
  name: string;
  isDefault: boolean;
  types: DexType[];
  typeIds: number[];
  /** Lowercase name without accents, for search. */
  searchName: string;
};

export type HeldItem = {
  id: number;
  identifier: string;
  name: string;
  effect: string | null;
  /** The form it turns its holder into (Mega Stones and the Primal orbs). */
  megaFor?: { basePokemonId: number; megaPokemonId: number };
};

export type GameData = {
  game: TeamGame;
  rules: GameRules;
  /** Battle types that exist in this game (Fairy from Gen VI…). */
  types: BattleType[];
  /** Tera types: the battle types plus Stellar. */
  teraTypes: BattleType[];
  chart: TypeChart;
  natures: Nature[];
  pokemon: TeamPokemon[];
  pokemonById: Map<number, TeamPokemon>;
  items: HeldItem[];
  itemById: Map<number, HeldItem>;
};

const gameDataCache = new Map<number, Promise<GameData>>();

export function loadGameData(db: SQLiteDatabase, game: TeamGame): Promise<GameData> {
  let cached = gameDataCache.get(game.versionGroupId);
  if (!cached) {
    cached = buildGameData(db, game);
    cached.catch(() => gameDataCache.delete(game.versionGroupId));
    gameDataCache.set(game.versionGroupId, cached);
  }
  return cached;
}

async function buildGameData(db: SQLiteDatabase, game: TeamGame): Promise<GameData> {
  const rules = rulesFor(game);
  const gen = game.generation;
  const [typeData, natures, pokemon, items, stellar] = await Promise.all([
    loadTypeData(db),
    rules.natures ? loadNatures(db) : Promise.resolve([] as Nature[]),
    loadGamePokemon(db, game),
    rules.heldItems ? loadHeldItems(db, game, rules) : Promise.resolve([] as HeldItem[]),
    db.getFirstAsync<{ name: string }>(`SELECT name FROM type_names WHERE type_id = 19`),
  ]);
  // A Mega whose usual form isn't in this game comes from another of its forms there
  // (Mega Floette from Eternal Floette)
  const pokemonIds = new Set(pokemon.map((p) => p.pokemonId));
  for (const item of items) {
    const mega = item.megaFor;
    if (!mega || pokemonIds.has(mega.basePokemonId)) continue;
    const species = await db.getFirstAsync<{ species_id: number }>(
      `SELECT species_id FROM pokemon WHERE id = ?`,
      mega.basePokemonId
    );
    const other = pokemon.find((p) => p.number === species?.species_id);
    if (other) mega.basePokemonId = other.pokemonId;
  }
  const genOf = (numeral: string) => ROMAN.indexOf(numeral) + 1;
  const types = typeData.types.filter((t) => genOf(t.generation) <= gen);
  return {
    game,
    rules,
    types,
    teraTypes: rules.tera
      ? [...types, { id: 19, identifier: 'stellar', name: stellar?.name ?? 'Stellar', generation: 'IX', oldCategory: null }]
      : [],
    chart: await chartForGeneration(db, typeData.chart, gen),
    natures,
    pokemon,
    pokemonById: new Map(pokemon.map((p) => [p.pokemonId, p])),
    items,
    itemById: new Map(items.map((i) => [i.id, i])),
  };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Today's chart with the older factors put back for games before each change. */
async function chartForGeneration(db: SQLiteDatabase, current: TypeChart, gen: number) {
  const past = await db.getAllAsync<{ attacker: number; target: number; factor: number; generation: number }>(
    `SELECT damage_type_id AS attacker, target_type_id AS target, damage_factor AS factor,
            generation_id AS generation
     FROM type_efficacy_past
     WHERE generation_id >= ?
     ORDER BY generation_id DESC`,
    gen
  );
  const chart: TypeChart = new Map([...current].map(([a, row]) => [a, new Map(row)]));
  // Descending, so the change nearest this game is applied last and wins
  for (const p of past) chart.get(p.attacker)?.set(p.target, p.factor / 100);
  return chart;
}

/**
 * The Pokémon you can have in this game: those with a learnset there. Battle-only forms (Megas,
 * Gigantamax, Primal…) come from items and toggles instead, and Totems and forms that only look
 * different are left out.
 */
async function loadGamePokemon(db: SQLiteDatabase, game: TeamGame): Promise<TeamPokemon[]> {
  const [rows, pastTypes, typeNames] = await Promise.all([
    db.getAllAsync<{
      pokemon_id: number;
      number: number;
      identifier: string;
      species_identifier: string;
      species_name: string;
      form_name: string | null;
      form: string | null;
      is_default: number;
      battle_only: number;
      types: string;
      stats: string;
    }>(
      `SELECT p.id AS pokemon_id, p.species_id AS number, p.identifier,
              ps.identifier AS species_identifier, sn.name AS species_name,
              fn.pokemon_name AS form_name, f.form_identifier AS form, p.is_default,
              COALESCE(f.is_battle_only, 0) AS battle_only,
              (SELECT GROUP_CONCAT(type_id) FROM
                 (SELECT type_id FROM pokemon_types WHERE pokemon_id = p.id ORDER BY slot)) AS types,
              (SELECT GROUP_CONCAT(base_stat) FROM
                 (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id ORDER BY stat_id)) AS stats
       FROM pokemon p
       JOIN pokemon_species ps ON ps.id = p.species_id
       JOIN pokemon_species_names sn ON sn.pokemon_species_id = p.species_id
       LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
       LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
       WHERE p.id IN (SELECT DISTINCT pokemon_id FROM pokemon_moves WHERE version_group_id = ?)
       ORDER BY p.species_id, p.is_default DESC, p."order", p.id`,
      game.versionGroupId
    ),
    loadPastTypes(db, game.generation),
    db.getAllAsync<{ id: number; identifier: string; name: string }>(
      `SELECT t.id, t.identifier, tn.name FROM types t JOIN type_names tn ON tn.type_id = t.id`
    ),
  ]);
  const typeById = new Map(typeNames.map((t) => [t.id, { identifier: t.identifier, name: t.name }]));
  const defaults = new Map(rows.filter((r) => r.is_default === 1).map((r) => [r.number, r]));

  return rows
    .filter((r) => {
      if (r.battle_only || isTotemForm(r.form)) return false;
      if (r.is_default === 1 || isRegionalForm(r.form)) return true;
      // A form that only looks different (Pikachu in a cap) adds nothing to a team
      const base = defaults.get(r.number);
      return !base || base.types !== r.types || base.stats !== r.stats;
    })
    .map((r) => {
      const typeIds = pastTypes.get(r.pokemon_id) ?? r.types.split(',').map(Number);
      const name = r.is_default === 1 ? r.species_name : (r.form_name ?? r.species_name);
      return {
        pokemonId: r.pokemon_id,
        number: r.number,
        identifier: r.identifier,
        speciesIdentifier: r.species_identifier,
        speciesName: r.species_name,
        name,
        isDefault: r.is_default === 1,
        typeIds,
        types: typeIds.map((id) => typeById.get(id) ?? { identifier: 'unknown', name: '?' }),
        searchName: normalize(name),
      };
    });
}

/** Pokémon whose types were different in generation `gen` (Clefairy was Normal before VI). */
async function loadPastTypes(db: SQLiteDatabase, gen: number) {
  const rows = await db.getAllAsync<{ pokemon_id: number; generation: number; type_id: number }>(
    `SELECT pokemon_id, generation_id AS generation, type_id FROM pokemon_types_past
     WHERE generation_id >= ? ORDER BY pokemon_id, generation_id, slot`,
    gen
  );
  // Each row set holds the types up to and including its generation; the nearest one applies
  const nearest = new Map<number, { generation: number; types: number[] }>();
  for (const r of rows) {
    const n = nearest.get(r.pokemon_id);
    if (!n) nearest.set(r.pokemon_id, { generation: r.generation, types: [r.type_id] });
    else if (n.generation === r.generation) n.types.push(r.type_id);
  }
  return new Map([...nearest].map(([id, n]) => [id, n.types]));
}

/** Categories of items that do something when held in battle (berries are added separately). */
const HELD_CATEGORIES = [
  'held-items',
  'choice',
  'bad-held-items',
  'type-enhancement',
  'species-specific',
  'plates',
  'memories',
  'jewels',
  'mega-stones',
  'z-crystals',
  'effort-training',
  'training',
];
/** Items from other categories that change their holder in battle. */
const EXTRA_HELD = ['red-orb', 'blue-orb', 'griseous-core', 'adamant-crystal', 'lustrous-globe'];
const PRIMAL: Record<string, string> = { 'red-orb': 'groudon-primal', 'blue-orb': 'kyogre-primal' };

/**
 * Held items that exist in this game. An item's first game comes from its in-game descriptions
 * and Serebii's locations; newer items with neither are dated by their neighbors in item order.
 * Mega Stones and Z-Crystals only show in games that have those mechanics.
 */
async function loadHeldItems(db: SQLiteDatabase, game: TeamGame, rules: GameRules): Promise<HeldItem[]> {
  const [rows, gameNames, megas] = await Promise.all([
    db.getAllAsync<{
      id: number;
      identifier: string;
      name: string;
      category: string;
      effect: string | null;
      flavor_gen: number | null;
      location_games: string | null;
    }>(
      `SELECT i.id, i.identifier, n.name, c.identifier AS category, p.short_effect AS effect,
              (SELECT MIN(vg.generation_id) FROM item_flavor_text f
                 JOIN version_groups vg ON vg.id = f.version_group_id WHERE f.item_id = i.id) AS flavor_gen,
              (SELECT GROUP_CONCAT(l.games, ' / ') FROM item_locations l WHERE l.item_id = i.id) AS location_games
       FROM items i
       JOIN item_names n ON n.item_id = i.id
       JOIN item_categories c ON c.id = i.category_id
       LEFT JOIN item_prose p ON p.item_id = i.id
       WHERE c.identifier IN (${HELD_CATEGORIES.map(() => '?').join(',')})
          OR i.identifier IN (${EXTRA_HELD.map(() => '?').join(',')})
          OR EXISTS (SELECT 1 FROM berries b WHERE b.item_id = i.id)
       ORDER BY i.id`,
      ...HELD_CATEGORIES,
      ...EXTRA_HELD
    ),
    db.getAllAsync<{ name: string; generation: number }>(
      `SELECT vn.name, vg.generation_id AS generation FROM versions v
       JOIN version_names vn ON vn.version_id = v.id
       JOIN version_groups vg ON vg.id = v.version_group_id`
    ),
    rules.mega || game.generation >= 6 ? loadMegaForms(db, game) : Promise.resolve([]),
  ]);

  const genByGame = new Map<string, number>();
  for (const g of gameNames) {
    genByGame.set(gameKey(g.name), g.generation);
    const dlc = g.name.split(': ')[1];
    if (dlc && !g.name.startsWith('Legends')) genByGame.set(gameKey(dlc), g.generation);
  }
  const firstGen = rows.map((r) => {
    const fromLocations = (r.location_games ?? '')
      .split(' / ')
      .map((name) => genByGame.get(gameKey(name)))
      .filter((g): g is number => g !== undefined);
    const known = [r.flavor_gen, ...fromLocations].filter((g): g is number => g != null);
    return known.length > 0 ? Math.min(...known) : null;
  });
  // Undated items take the generation of the nearest dated item before them
  let previous = 1;
  for (let i = 0; i < firstGen.length; i++) {
    if (firstGen[i] === null) firstGen[i] = previous;
    else previous = Math.max(previous, firstGen[i]!);
  }

  const stones = matchMegaStones(
    rows.filter((r) => r.category === 'mega-stones' || PRIMAL[r.identifier]),
    megas
  );

  return rows
    .filter((r, i) => {
      if (firstGen[i]! > game.generation) return false;
      if (r.category === 'z-crystals') return rules.zMoves;
      if (r.category === 'mega-stones' || PRIMAL[r.identifier]) return rules.mega && stones.has(r.id);
      return true;
    })
    .map((r) => ({
      id: r.id,
      identifier: r.identifier,
      name: r.name,
      effect: r.effect,
      megaFor: stones.get(r.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type MegaForm = { pokemonId: number; identifier: string; baseIdentifier: string; basePokemonId: number };

/** Mega and Primal forms with a learnset in this game, with the form they come from. */
async function loadMegaForms(db: SQLiteDatabase, game: TeamGame): Promise<MegaForm[]> {
  const rows = await db.getAllAsync<{
    pokemon_id: number;
    identifier: string;
    base_identifier: string;
    base_id: number;
  }>(
    `SELECT p.id AS pokemon_id, p.identifier, b.identifier AS base_identifier, b.id AS base_id
     FROM pokemon p
     JOIN pokemon_forms f ON f.pokemon_id = p.id
     JOIN pokemon b ON b.species_id = p.species_id AND b.is_default = 1
     WHERE (f.is_mega = 1 OR f.form_identifier = 'primal')
       AND (EXISTS (SELECT 1 FROM pokemon_moves pm WHERE pm.pokemon_id = p.id AND pm.version_group_id = ?)
            OR EXISTS (SELECT 1 FROM pokemon_moves pm WHERE pm.pokemon_id = b.id AND pm.version_group_id = ?))`,
    game.versionGroupId,
    game.versionGroupId
  );
  return rows.map((r) => ({
    pokemonId: r.pokemon_id,
    identifier: r.identifier,
    baseIdentifier: r.base_identifier,
    basePokemonId: r.base_id,
  }));
}

/**
 * Pairs each Mega Stone with its Mega form. There's no table linking them, so the stone's name
 * is matched to the species it's named after (Abomasite → Abomasnow, Charizardite X →
 * Mega Charizard X): the longest shared beginning wins, and an X/Y/Z suffix must agree.
 */
function matchMegaStones(stones: { id: number; identifier: string }[], megas: MegaForm[]) {
  const result = new Map<number, { basePokemonId: number; megaPokemonId: number }>();
  for (const stone of stones) {
    const primal = PRIMAL[stone.identifier];
    if (primal) {
      const form = megas.find((m) => m.identifier === primal);
      if (form) result.set(stone.id, { basePokemonId: form.basePokemonId, megaPokemonId: form.pokemonId });
      continue;
    }
    const [, stem, suffix = ''] = stone.identifier.match(/^(.*?)(?:-([xyz]))?$/) ?? [];
    let best: MegaForm | null = null;
    let bestLength = 3;
    for (const m of megas) {
      const megaSuffix = m.identifier.match(/-mega-([xyz])$/)?.[1] ?? '';
      if (megaSuffix !== suffix || !m.identifier.includes('-mega')) continue;
      const species = m.baseIdentifier.split('-')[0];
      let n = 0;
      while (n < species.length && n < stem.length && species[n] === stem[n]) n++;
      if (n > bestLength) {
        best = m;
        bestLength = n;
      }
    }
    if (best) result.set(stone.id, { basePokemonId: best.basePokemonId, megaPokemonId: best.pokemonId });
  }
  return result;
}

// ── One team member's options ─────────────────────────────────────────────────────────────

export type TeamAbility = { id: number; identifier: string; name: string; effect: string | null; isHidden: boolean };

export type TeamMove = {
  id: number;
  name: string;
  type: DexType;
  typeId: number;
  /** "Physical", "Special" or "Status", as it was in this game. */
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  searchName: string;
};

export type MemberOptions = {
  baseStats: StatSpread;
  abilities: TeamAbility[];
  moves: TeamMove[];
  moveById: Map<number, TeamMove>;
  /** The Gigantamax form, in Sword/Shield. */
  gigantamax: { pokemonId: number; name: string } | null;
};

const memberCache = new Map<string, Promise<MemberOptions>>();

export function loadMemberOptions(db: SQLiteDatabase, data: GameData, pokemonId: number) {
  const key = `${data.game.versionGroupId}:${pokemonId}`;
  let cached = memberCache.get(key);
  if (!cached) {
    cached = buildMemberOptions(db, data, pokemonId);
    cached.catch(() => memberCache.delete(key));
    memberCache.set(key, cached);
  }
  return cached;
}

async function buildMemberOptions(db: SQLiteDatabase, data: GameData, pokemonId: number): Promise<MemberOptions> {
  const { game, rules } = data;
  const [baseStats, abilities, moves, gmax] = await Promise.all([
    loadBaseStats(db, pokemonId, game.generation),
    rules.abilities ? loadAbilitiesFor(db, pokemonId, game.generation, rules) : Promise.resolve([]),
    loadMovesFor(db, data, pokemonId),
    rules.dynamax
      ? db.getFirstAsync<{ id: number; name: string | null }>(
          `SELECT g.id, fn.pokemon_name AS name FROM pokemon p
           JOIN pokemon g ON g.identifier = p.identifier || '-gmax'
           LEFT JOIN pokemon_forms f ON f.pokemon_id = g.id
           LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
           WHERE p.id = ?`,
          pokemonId
        )
      : Promise.resolve(null),
  ]);
  return {
    baseStats,
    abilities,
    moves,
    moveById: new Map(moves.map((m) => [m.id, m])),
    gigantamax: gmax ? { pokemonId: gmax.id, name: gmax.name ?? 'Gigantamax' } : null,
  };
}

/** Base stats as they were in generation `gen` (several were raised in Gen VI and VII). */
export async function loadBaseStats(db: SQLiteDatabase, pokemonId: number, gen: number): Promise<StatSpread> {
  const [current, past] = await Promise.all([
    db.getAllAsync<{ stat_id: number; base_stat: number }>(
      `SELECT stat_id, base_stat FROM pokemon_stats WHERE pokemon_id = ?`,
      pokemonId
    ),
    db.getAllAsync<{ stat_id: number; base_stat: number }>(
      `SELECT stat_id, base_stat FROM pokemon_stats_past
       WHERE pokemon_id = ? AND generation_id >= ? ORDER BY generation_id DESC`,
      pokemonId,
      gen
    ),
  ]);
  const stats: StatSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  // Descending, so the nearest past value is written last
  for (const s of [...current, ...past]) {
    const key = STAT_BY_ID[s.stat_id];
    if (key) stats[key] = s.base_stat;
    // Gen I's single Special stat
    if (s.stat_id === 9) stats.spa = stats.spd = s.base_stat;
  }
  return stats;
}

export async function loadAbilitiesFor(
  db: SQLiteDatabase,
  pokemonId: number,
  gen: number,
  rules: GameRules
): Promise<TeamAbility[]> {
  const [current, past] = await Promise.all([
    db.getAllAsync<{ slot: number; id: number | null; generation: number | null }>(
      `SELECT pa.slot, pa.ability_id AS id, NULL AS generation
       FROM pokemon_abilities pa WHERE pa.pokemon_id = ?`,
      pokemonId
    ),
    db.getAllAsync<{ slot: number; id: number | null; generation: number }>(
      `SELECT slot, ability_id AS id, generation_id AS generation FROM pokemon_abilities_past
       WHERE pokemon_id = ? AND generation_id >= ? ORDER BY generation_id DESC`,
      pokemonId,
      gen
    ),
  ]);
  const bySlot = new Map<number, number | null>();
  for (const a of [...current, ...past]) bySlot.set(a.slot, a.id);
  const slots = [...bySlot]
    .filter(([slot, id]) => id !== null && (slot !== 3 || rules.hiddenAbilities))
    .sort(([a], [b]) => a - b);
  if (slots.length === 0) return [];
  const ids = slots.map(([, id]) => id!);
  const info = await db.getAllAsync<{
    id: number;
    identifier: string;
    name: string;
    effect: string | null;
    generation: number;
  }>(
    `SELECT a.id, a.identifier, n.name, p.short_effect AS effect, a.generation_id AS generation
     FROM abilities a JOIN ability_names n ON n.ability_id = a.id
     LEFT JOIN ability_prose p ON p.ability_id = a.id
     WHERE a.id IN (${ids.map(() => '?').join(',')})`,
    ...ids
  );
  const byId = new Map(info.map((i) => [i.id, i]));
  const seen = new Set<number>();
  return slots.flatMap(([slot, id]) => {
    const a = byId.get(id!);
    if (!a || a.generation > gen || seen.has(a.id)) return [];
    seen.add(a.id);
    return [{ id: a.id, identifier: a.identifier, name: a.name, effect: a.effect, isHidden: slot === 3 }];
  });
}

/**
 * This Pokémon and the ones it evolves from (Clefable, Clefairy, Cleffa), so moves learned
 * before evolving count. A regional form's line stays regional (Alolan Ninetales, Alolan Vulpix).
 */
async function evolutionLine(db: SQLiteDatabase, pokemonId: number): Promise<number[]> {
  const start = await db.getFirstAsync<{ identifier: string; species: string; from: number | null }>(
    `SELECT p.identifier, s.identifier AS species, s.evolves_from_species_id AS "from"
     FROM pokemon p JOIN pokemon_species s ON s.id = p.species_id WHERE p.id = ?`,
    pokemonId
  );
  if (!start) return [pokemonId];
  const suffix = start.identifier.slice(start.species.length);
  const ids = [pokemonId];
  let from = start.from;
  while (from !== null && ids.length < 4) {
    const prev = await db.getFirstAsync<{ id: number; from: number | null }>(
      `SELECT p.id, s.evolves_from_species_id AS "from"
       FROM pokemon p JOIN pokemon_species s ON s.id = p.species_id
       WHERE p.species_id = ? AND (p.identifier = s.identifier || ? OR p.is_default = 1)
       ORDER BY p.identifier = s.identifier || ? DESC
       LIMIT 1`,
      from,
      suffix,
      suffix
    );
    if (!prev) break;
    ids.push(prev.id);
    from = prev.from;
  }
  return ids;
}

/**
 * Every move it can learn in this game, its pre-evolutions' included, with that game's type,
 * power and category.
 */
async function loadMovesFor(db: SQLiteDatabase, data: GameData, pokemonId: number): Promise<TeamMove[]> {
  const { game } = data;
  const line = await evolutionLine(db, pokemonId);
  const inLine = line.map(() => '?').join(',');
  const [rows, changes] = await Promise.all([
    db.getAllAsync<{
      id: number;
      name: string;
      type_id: number;
      damage_class: string;
      power: number | null;
      accuracy: number | null;
      pp: number | null;
    }>(
      `SELECT m.id, mn.name, m.type_id, dc.identifier AS damage_class, m.power, m.accuracy, m.pp
       FROM moves m
       JOIN move_names mn ON mn.move_id = m.id
       JOIN move_damage_classes dc ON dc.id = m.damage_class_id
       WHERE m.id IN (SELECT move_id FROM pokemon_moves
                      WHERE pokemon_id IN (${inLine}) AND version_group_id = ?)
       ORDER BY mn.name`,
      ...line,
      game.versionGroupId
    ),
    db.getAllAsync<{
      move_id: number;
      type_id: number | null;
      power: number | null;
      accuracy: number | null;
      pp: number | null;
    }>(
      // Each row holds the values before its game changed them; later changes are applied first
      `SELECT c.move_id, c.type_id, c.power, c.accuracy, c.pp
       FROM move_changelog c JOIN version_groups vg ON vg.id = c.changed_in_version_group_id
       WHERE vg."order" > ?
         AND c.move_id IN (SELECT move_id FROM pokemon_moves
                           WHERE pokemon_id IN (${inLine}) AND version_group_id = ?)
       ORDER BY vg."order" DESC`,
      game.order,
      ...line,
      game.versionGroupId
    ),
  ]);
  const old = new Map<number, { type_id?: number; power?: number; accuracy?: number; pp?: number }>();
  for (const c of changes) {
    const o = old.get(c.move_id) ?? {};
    if (c.type_id !== null) o.type_id = c.type_id;
    if (c.power !== null) o.power = c.power;
    if (c.accuracy !== null) o.accuracy = c.accuracy;
    if (c.pp !== null) o.pp = c.pp;
    old.set(c.move_id, o);
  }
  const typeById = new Map(data.types.map((t) => [t.id, t]));
  return rows.map((r) => {
    const o = old.get(r.id) ?? {};
    const typeId = o.type_id ?? r.type_id;
    const type = typeById.get(typeId);
    // Before Gen IV a damaging move's category came from its type
    const category =
      r.damage_class === 'status'
        ? 'Status'
        : game.generation <= 3 && type?.oldCategory
          ? type.oldCategory
          : r.damage_class === 'physical'
            ? 'Physical'
            : 'Special';
    return {
      id: r.id,
      name: r.name,
      typeId,
      type: type ? { identifier: type.identifier, name: type.name } : { identifier: 'unknown', name: '?' },
      category,
      power: o.power ?? r.power,
      accuracy: o.accuracy ?? r.accuracy,
      pp: o.pp ?? r.pp,
      searchName: normalize(r.name),
    };
  });
}

/** The Mega or Primal form a held item gives, with its types and ability in this game. */
export async function loadMegaDetails(db: SQLiteDatabase, data: GameData, megaPokemonId: number) {
  const [row, abilities] = await Promise.all([
    db.getFirstAsync<{ name: string; types: string }>(
      `SELECT COALESCE(fn.pokemon_name, p.identifier) AS name,
              (SELECT GROUP_CONCAT(type_id) FROM
                 (SELECT type_id FROM pokemon_types WHERE pokemon_id = p.id ORDER BY slot)) AS types
       FROM pokemon p
       LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id
       LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
       WHERE p.id = ?`,
      megaPokemonId
    ),
    loadAbilitiesFor(db, megaPokemonId, data.game.generation, { ...data.rules, hiddenAbilities: true }),
  ]);
  if (!row) return null;
  const typeById = new Map(data.types.map((t) => [t.id, t]));
  return {
    name: row.name,
    types: row.types
      .split(',')
      .map((id) => typeById.get(Number(id)))
      .filter((t): t is BattleType => t !== undefined),
    ability: abilities[0]?.name ?? null,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────

function gameKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '');
}
