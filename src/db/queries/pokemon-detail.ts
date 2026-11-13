import type { SQLiteDatabase } from 'expo-sqlite';

import type { DexType } from './national-dex';

/** The 18 battle types (PokéAPI ids 1–18); Stellar, Unknown and Shadow are left out. */
const BATTLE_TYPE_MAX_ID = 18;

export type Variety = {
  pokemonId: number;
  /** "Charizard", "Mega Charizard X", "Alolan Raichu"… */
  name: string;
  isDefault: boolean;
};

export type SpeciesInfo = {
  number: number;
  name: string;
  genus: string;
  generationId: number;
  flavorText: string | null;
  flavorVersion: string | null;
  isLegendary: boolean;
  isMythical: boolean;
  isBaby: boolean;
  captureRate: number;
  /** Chance of being female in eighths, or -1 when genderless. */
  genderRate: number;
  eggGroups: string[];
  evolutionChainId: number | null;
  varieties: Variety[];
};

export type Stat = { identifier: string; name: string; value: number };
export type Ability = { name: string; effect: string | null; isHidden: boolean };

export type Matchup = { type: DexType; multiplier: number };

export type PokemonForm = {
  pokemonId: number;
  /** Height in metres and weight in kilograms. */
  height: number;
  weight: number;
  types: DexType[];
  stats: Stat[];
  abilities: Ability[];
  /** Defensive multiplier from every battle type; 1× entries are left out. */
  matchups: Matchup[];
};

export type EvolutionStage = {
  number: number;
  name: string;
  pokemonId: number;
  evolvesFrom: number | null;
  /** How it evolves from the previous stage, e.g. "Level 36" or "Use Thunder Stone". */
  methods: string[];
};

export type Encounter = {
  version: string;
  versionGroupOrder: number;
  location: string;
  minLevel: number;
  maxLevel: number;
};

export type GameOption = { versionGroupId: number; name: string; order: number };

export type LearnedMove = {
  name: string;
  type: DexType;
  /** "Physical", "Special" or "Status". */
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  method: string;
  level: number;
};

export async function loadSpecies(db: SQLiteDatabase, number: number): Promise<SpeciesInfo | null> {
  const species = await db.getFirstAsync<{
    id: number;
    name: string;
    genus: string;
    generation_id: number;
    is_legendary: number;
    is_mythical: number;
    is_baby: number;
    capture_rate: number;
    gender_rate: number;
    evolution_chain_id: number | null;
  }>(
    `SELECT s.id, n.name, n.genus, s.generation_id, s.is_legendary, s.is_mythical, s.is_baby,
            s.capture_rate, s.gender_rate, s.evolution_chain_id
     FROM pokemon_species s JOIN pokemon_species_names n ON n.pokemon_species_id = s.id
     WHERE s.id = ?`,
    number
  );
  if (!species) return null;

  const [flavor, eggGroups, varieties] = await Promise.all([
    // The most recent game's Pokédex entry
    db.getFirstAsync<{ flavor_text: string; version: string }>(
      `SELECT f.flavor_text, vn.name AS version
       FROM pokemon_species_flavor_text f
       JOIN versions v ON v.id = f.version_id
       JOIN version_groups vg ON vg.id = v.version_group_id
       JOIN version_names vn ON vn.version_id = v.id
       WHERE f.species_id = ?
       ORDER BY vg."order" DESC, v.id DESC LIMIT 1`,
      number
    ),
    db.getAllAsync<{ name: string }>(
      `SELECT p.name FROM pokemon_egg_groups eg JOIN egg_group_prose p ON p.egg_group_id = eg.egg_group_id
       WHERE eg.species_id = ? ORDER BY eg.egg_group_id`,
      number
    ),
    db.getAllAsync<{ id: number; is_default: number; name: string | null }>(
      `SELECT p.id, p.is_default, fn.pokemon_name AS name
       FROM pokemon p
       LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
       LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
       WHERE p.species_id = ?
       ORDER BY p.is_default DESC, p."order", p.id`,
      number
    ),
  ]);

  return {
    number: species.id,
    name: species.name,
    genus: species.genus,
    generationId: species.generation_id,
    flavorText: flavor?.flavor_text ?? null,
    flavorVersion: flavor?.version ?? null,
    isLegendary: species.is_legendary === 1,
    isMythical: species.is_mythical === 1,
    isBaby: species.is_baby === 1,
    captureRate: species.capture_rate,
    genderRate: species.gender_rate,
    eggGroups: eggGroups.map((g) => g.name),
    evolutionChainId: species.evolution_chain_id,
    varieties: varieties.map((v) => ({
      pokemonId: v.id,
      name: v.name ?? species.name,
      isDefault: v.is_default === 1,
    })),
  };
}

export async function loadForm(db: SQLiteDatabase, pokemonId: number): Promise<PokemonForm | null> {
  const pokemon = await db.getFirstAsync<{ height: number; weight: number }>(
    'SELECT height, weight FROM pokemon WHERE id = ?',
    pokemonId
  );
  if (!pokemon) return null;

  const [types, stats, abilities, efficacy] = await Promise.all([
    db.getAllAsync<{ id: number; identifier: string; name: string }>(
      `SELECT t.id, t.identifier, tn.name FROM pokemon_types pt
       JOIN types t ON t.id = pt.type_id JOIN type_names tn ON tn.type_id = t.id
       WHERE pt.pokemon_id = ? ORDER BY pt.slot`,
      pokemonId
    ),
    db.getAllAsync<{ identifier: string; name: string; value: number }>(
      `SELECT s.identifier, sn.name, ps.base_stat AS value FROM pokemon_stats ps
       JOIN stats s ON s.id = ps.stat_id JOIN stat_names sn ON sn.stat_id = s.id
       WHERE ps.pokemon_id = ? ORDER BY s.id`,
      pokemonId
    ),
    db.getAllAsync<{ name: string; effect: string | null; is_hidden: number }>(
      `SELECT an.name, ap.short_effect AS effect, pa.is_hidden FROM pokemon_abilities pa
       JOIN ability_names an ON an.ability_id = pa.ability_id
       LEFT JOIN ability_prose ap ON ap.ability_id = pa.ability_id
       WHERE pa.pokemon_id = ? ORDER BY pa.slot`,
      pokemonId
    ),
    db.getAllAsync<{ attacker: number; identifier: string; name: string; target: number; factor: number }>(
      `SELECT e.damage_type_id AS attacker, t.identifier, tn.name, e.target_type_id AS target,
              e.damage_factor AS factor
       FROM type_efficacy e JOIN types t ON t.id = e.damage_type_id JOIN type_names tn ON tn.type_id = t.id
       WHERE e.damage_type_id <= ${BATTLE_TYPE_MAX_ID}
         AND e.target_type_id IN (SELECT type_id FROM pokemon_types WHERE pokemon_id = ?)`,
      pokemonId
    ),
  ]);

  // Multiply each attacking type's effectiveness against every one of this Pokémon's types
  const byAttacker = new Map<number, Matchup>();
  for (const e of efficacy) {
    const m = byAttacker.get(e.attacker) ?? {
      type: { identifier: e.identifier, name: e.name },
      multiplier: 1,
    };
    m.multiplier *= e.factor / 100;
    byAttacker.set(e.attacker, m);
  }

  return {
    pokemonId,
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    types: types.map(({ identifier, name }) => ({ identifier, name })),
    stats: stats.map((s) => ({ ...s, name: shortStatName(s.identifier, s.name) })),
    abilities: abilities.map((a) => ({ name: a.name, effect: a.effect, isHidden: a.is_hidden === 1 })),
    matchups: [...byAttacker.values()]
      .filter((m) => m.multiplier !== 1)
      .sort((a, b) => b.multiplier - a.multiplier),
  };
}

function shortStatName(identifier: string, name: string) {
  return identifier === 'special-attack' ? 'Sp. Atk' : identifier === 'special-defense' ? 'Sp. Def' : name;
}

type EvolutionRow = {
  id: number;
  name: string;
  pokemon_id: number;
  evolves_from: number | null;
  trigger: string | null;
  minimum_level: number | null;
  item: string | null;
  held_item: string | null;
  known_move: string | null;
  known_move_type: string | null;
  location: string | null;
  time_of_day: string | null;
  minimum_happiness: number | null;
  minimum_affection: number | null;
  minimum_beauty: number | null;
  gender_id: number | null;
  party_species: string | null;
  trade_species: string | null;
  needs_overworld_rain: number | null;
  turn_upside_down: number | null;
  relative_physical_stats: number | null;
};

/** Every species in the chain, in Dex order, with its main evolution method(s). */
export async function loadEvolutionChain(db: SQLiteDatabase, chainId: number): Promise<EvolutionStage[]> {
  const rows = await db.getAllAsync<EvolutionRow>(
    `SELECT s.id, sn.name, p.id AS pokemon_id, s.evolves_from_species_id AS evolves_from,
            tp.name AS trigger, e.minimum_level, i1.name AS item, i2.name AS held_item,
            mn.name AS known_move, ktn.name AS known_move_type, ln.name AS location,
            e.time_of_day, e.minimum_happiness, e.minimum_affection, e.minimum_beauty, e.gender_id,
            psn.name AS party_species, tsn.name AS trade_species, e.needs_overworld_rain,
            e.turn_upside_down, e.relative_physical_stats
     FROM pokemon_species s
     JOIN pokemon_species_names sn ON sn.pokemon_species_id = s.id
     JOIN pokemon p ON p.species_id = s.id AND p.is_default = 1
     LEFT JOIN pokemon_evolution e ON e.evolved_species_id = s.id AND e.is_default = 1
     LEFT JOIN evolution_trigger_prose tp ON tp.evolution_trigger_id = e.evolution_trigger_id
     LEFT JOIN item_names i1 ON i1.item_id = e.trigger_item_id
     LEFT JOIN item_names i2 ON i2.item_id = e.held_item_id
     LEFT JOIN move_names mn ON mn.move_id = e.known_move_id
     LEFT JOIN type_names ktn ON ktn.type_id = e.known_move_type_id
     LEFT JOIN location_names ln ON ln.location_id = e.location_id
     LEFT JOIN pokemon_species_names psn ON psn.pokemon_species_id = e.party_species_id
     LEFT JOIN pokemon_species_names tsn ON tsn.pokemon_species_id = e.trade_species_id
     WHERE s.evolution_chain_id = ?
     ORDER BY s."order", s.id`,
    chainId
  );

  const stages = new Map<number, EvolutionStage>();
  for (const r of rows) {
    const stage = stages.get(r.id) ?? {
      number: r.id,
      name: r.name,
      pokemonId: r.pokemon_id,
      evolvesFrom: r.evolves_from,
      methods: [],
    };
    if (r.evolves_from !== null && r.trigger) {
      const method = describeEvolution(r);
      if (!stage.methods.includes(method)) stage.methods.push(method);
    }
    stages.set(r.id, stage);
  }
  return [...stages.values()];
}

function describeEvolution(r: EvolutionRow) {
  const parts: string[] = [];
  if (r.trigger === 'Level up') {
    parts.push(r.minimum_level ? `Level ${r.minimum_level}` : 'Level up');
  } else if (r.trigger === 'Use item' && r.item) {
    parts.push(`Use ${r.item}`);
  } else if (r.trigger === 'Trade or Linking Cord') {
    parts.push(r.trade_species ? `Trade for ${r.trade_species}` : 'Trade');
  } else if (r.trigger) {
    parts.push(r.trigger);
  }
  if (r.trigger !== 'Level up' && r.minimum_level) parts.push(`from level ${r.minimum_level}`);
  if (r.held_item) parts.push(`holding ${r.held_item}`);
  if (r.minimum_happiness) parts.push('with high friendship');
  if (r.minimum_affection) parts.push('with high affection');
  if (r.minimum_beauty) parts.push('with high beauty');
  if (r.known_move) parts.push(`knowing ${r.known_move}`);
  if (r.known_move_type) parts.push(`knowing a ${r.known_move_type} move`);
  if (r.location) parts.push(`at ${r.location}`);
  if (r.time_of_day) parts.push(r.time_of_day === 'day' ? 'during the day' : `at ${r.time_of_day}`);
  if (r.gender_id === 1) parts.push('(female)');
  if (r.gender_id === 2) parts.push('(male)');
  if (r.party_species) parts.push(`with ${r.party_species} in the party`);
  if (r.needs_overworld_rain) parts.push('while it rains');
  if (r.turn_upside_down) parts.push('with the console upside down');
  if (r.relative_physical_stats === 1) parts.push('if Attack > Defense');
  if (r.relative_physical_stats === -1) parts.push('if Attack < Defense');
  if (r.relative_physical_stats === 0) parts.push('if Attack = Defense');
  return parts.join(' ');
}

/** Where a form can be caught, per game. Only covers games up to Sword/Shield (PokéAPI's data). */
export async function loadEncounters(db: SQLiteDatabase, pokemonId: number): Promise<Encounter[]> {
  const rows = await db.getAllAsync<{
    version: string;
    versionGroupOrder: number;
    location: string;
    area: string | null;
    minLevel: number;
    maxLevel: number;
  }>(
    `SELECT vn.name AS version, vg."order" AS versionGroupOrder,
            COALESCE(ln.name, l.identifier) AS location, lap.name AS area,
            MIN(e.min_level) AS minLevel, MAX(e.max_level) AS maxLevel
     FROM encounters e
     JOIN versions v ON v.id = e.version_id
     JOIN version_groups vg ON vg.id = v.version_group_id
     JOIN version_names vn ON vn.version_id = v.id
     JOIN location_areas la ON la.id = e.location_area_id
     JOIN locations l ON l.id = la.location_id
     LEFT JOIN location_names ln ON ln.location_id = l.id
     LEFT JOIN location_area_prose lap ON lap.location_area_id = la.id
     WHERE e.pokemon_id = ?
     GROUP BY v.id, la.id
     ORDER BY vg."order" DESC, v.id, location`,
    pokemonId
  );
  // Areas that end up with the same label (two parts of one route) become one line
  const merged = new Map<string, Encounter>();
  for (const { area, ...r } of rows) {
    const location = locationLabel(r.location, area);
    const key = `${r.version}\u0000${location}`;
    const seen = merged.get(key);
    if (seen) {
      seen.minLevel = Math.min(seen.minLevel, r.minLevel);
      seen.maxLevel = Math.max(seen.maxLevel, r.maxLevel);
    } else {
      merged.set(key, { ...r, location });
    }
  }
  return [...merged.values()];
}

/**
 * Area names usually repeat their location ("Challenge Beach (Max Den B)" in Challenge Beach,
 * "Road 2 (south)" on Route 2), so keep only the part that tells areas apart.
 */
function locationLabel(location: string, area: string | null) {
  if (!area) return location;
  const route = /^Route (\d+)$/.exec(location);
  const prefixes = route ? [location, `Road ${route[1]}`] : [location];
  let detail = area;
  for (const p of prefixes) {
    if (detail.startsWith(p)) detail = detail.slice(p.length);
  }
  detail = detail.trim().replace(/^\((.*)\)$/, '$1').trim();
  return detail ? `${location} (${detail})` : location;
}

/** Games this form has a learnset in, newest first. */
export async function loadLearnsetGames(db: SQLiteDatabase, pokemonId: number): Promise<GameOption[]> {
  const rows = await db.getAllAsync<{ id: number; order: number; names: string }>(
    `SELECT vg.id, vg."order", GROUP_CONCAT(vn.name, '/') AS names
     FROM version_groups vg
     JOIN versions v ON v.version_group_id = vg.id
     JOIN version_names vn ON vn.version_id = v.id
     WHERE vg.id IN (SELECT DISTINCT version_group_id FROM pokemon_moves WHERE pokemon_id = ?)
     GROUP BY vg.id
     ORDER BY vg."order" DESC`,
    pokemonId
  );
  return rows.map((r) => ({ versionGroupId: r.id, order: r.order, name: r.names }));
}

export async function loadLearnset(
  db: SQLiteDatabase,
  pokemonId: number,
  versionGroupId: number
): Promise<LearnedMove[]> {
  const rows = await db.getAllAsync<{
    name: string;
    type: string;
    type_name: string;
    category: string;
    power: number | null;
    accuracy: number | null;
    pp: number | null;
    method: string;
    level: number;
  }>(
    `SELECT mn.name, t.identifier AS type, tn.name AS type_name, dc.name AS category,
            m.power, m.accuracy, m.pp, mp.name AS method, MIN(pm.level) AS level
     FROM pokemon_moves pm
     JOIN moves m ON m.id = pm.move_id
     JOIN move_names mn ON mn.move_id = m.id
     JOIN types t ON t.id = m.type_id
     JOIN type_names tn ON tn.type_id = t.id
     JOIN move_damage_class_prose dc ON dc.move_damage_class_id = m.damage_class_id
     JOIN pokemon_move_method_prose mp ON mp.pokemon_move_method_id = pm.pokemon_move_method_id
     WHERE pm.pokemon_id = ? AND pm.version_group_id = ?
     GROUP BY pm.move_id, pm.pokemon_move_method_id
     ORDER BY pm.pokemon_move_method_id, level, mn.name`,
    pokemonId,
    versionGroupId
  );
  return rows.map((r) => ({
    name: r.name,
    type: { identifier: r.type, name: r.type_name },
    category: r.category[0].toUpperCase() + r.category.slice(1),
    power: r.power,
    accuracy: r.accuracy,
    pp: r.pp,
    method: r.method,
    level: r.level,
  }));
}

/** "×4", "×2", "×½", "×¼", "×0" */
export function formatMultiplier(m: number) {
  if (m === 0.5) return '×½';
  if (m === 0.25) return '×¼';
  return `×${m}`;
}
