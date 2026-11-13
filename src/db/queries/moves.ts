import type { SQLiteDatabase } from 'expo-sqlite';

import { type DexType, normalizeForSearch } from './national-dex';
import { type GameOption, isRegionalForm } from './pokemon-detail';

/** Shadow moves (Colosseum, XD) have ids above this and a non-battle type; they're left out. */
const SHADOW_MOVE_MIN_ID = 10000;

export type MoveSummary = {
  id: number;
  name: string;
  type: DexType;
  /** "Physical", "Special" or "Status"; "Physical or Special" for Z-Moves. */
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  /** Lowercase name without accents or punctuation, for search. */
  searchName: string;
};

type SummaryRow = {
  id: number;
  identifier: string;
  name: string;
  type: string;
  type_name: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
};

function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Every battle move, A to Z. */
export async function loadMoves(db: SQLiteDatabase): Promise<MoveSummary[]> {
  const rows = await db.getAllAsync<SummaryRow>(`
    SELECT m.id, m.identifier, mn.name, t.identifier AS type, tn.name AS type_name,
           dc.name AS category, m.power, m.accuracy, m.pp
    FROM moves m
    JOIN move_names mn ON mn.move_id = m.id
    JOIN types t ON t.id = m.type_id
    JOIN type_names tn ON tn.type_id = t.id
    JOIN move_damage_class_prose dc ON dc.move_damage_class_id = m.damage_class_id
    WHERE m.id < ${SHADOW_MOVE_MIN_ID}
    ORDER BY mn.name, m.id`);

  // Z-Moves come as a physical and a special copy with the same name; list each once
  return rows
    .filter((r) => !r.identifier.endsWith('--special'))
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: { identifier: r.type, name: r.type_name },
      category: r.identifier.endsWith('--physical') ? 'Physical or Special' : capitalize(r.category),
      power: r.power,
      accuracy: r.accuracy,
      pp: r.pp,
      searchName: normalizeForSearch(r.name),
    }));
}

/**
 * Every word must match: the name (anywhere), a type or a category (from the start),
 * so "fire special" finds Flamethrower and "status ghost" finds Curse.
 */
export function matchesMoveQuery(move: MoveSummary, words: string[]) {
  const category = move.category.toLowerCase();
  return words.every(
    (word) =>
      move.searchName.includes(word) ||
      move.type.identifier.startsWith(word) ||
      category.split(' ').some((c) => c.startsWith(word))
  );
}

export type MoveChange = {
  /** The first game with the current behaviour, e.g. "X / Y". */
  since: string;
  /** What it was before, e.g. "95 power", or an old effect. */
  before: string[];
};

export type MoveDetail = MoveSummary & {
  priority: number;
  /** "Selected Pokémon", "All opponents"… */
  target: string | null;
  /** Short mechanical effect, from PokéAPI. */
  effect: string | null;
  /** Chance of the secondary effect in percent, when the effect text doesn't already say. */
  effectChance: number | null;
  /** The most recent game's in-game description. */
  flavorText: string | null;
  generation: string;
  changes: MoveChange[];
};

export async function loadMove(db: SQLiteDatabase, id: number): Promise<MoveDetail | null> {
  const move = await db.getFirstAsync<
    SummaryRow & {
      priority: number;
      target: string | null;
      effect: string | null;
      effect_chance: number | null;
      generation: string;
    }
  >(
    `SELECT m.id, m.identifier, mn.name, t.identifier AS type, tn.name AS type_name,
            dc.name AS category, m.power, m.accuracy, m.pp, m.priority,
            tp.name AS target, ep.short_effect AS effect, m.effect_chance,
            g.identifier AS generation
     FROM moves m
     JOIN move_names mn ON mn.move_id = m.id
     JOIN types t ON t.id = m.type_id
     JOIN type_names tn ON tn.type_id = t.id
     JOIN move_damage_class_prose dc ON dc.move_damage_class_id = m.damage_class_id
     JOIN generations g ON g.id = m.generation_id
     LEFT JOIN move_target_prose tp ON tp.move_target_id = m.target_id
     LEFT JOIN move_effect_prose ep ON ep.move_effect_id = m.effect_id
     WHERE m.id = ?`,
    id
  );
  if (!move) return null;

  const [flavor, statChanges, effectChanges] = await Promise.all([
    db.getFirstAsync<{ flavor_text: string }>(
      `SELECT f.flavor_text FROM move_flavor_text f
       JOIN version_groups vg ON vg.id = f.version_group_id
       WHERE f.move_id = ?
         -- Scarlet/Violet and Sword/Shield give moves they cut a placeholder text
         AND f.flavor_text NOT LIKE 'This move can%t be used. It%s recommended%'
       ORDER BY vg."order" DESC LIMIT 1`,
      id
    ),
    // Each row holds the values the move had *before* that game
    db.getAllAsync<{
      order: number;
      since: string;
      type_name: string | null;
      power: number | null;
      pp: number | null;
      accuracy: number | null;
      priority: number | null;
      effect_chance: number | null;
    }>(
      `SELECT vg."order", (SELECT GROUP_CONCAT(vn.name, ' / ') FROM versions v
                JOIN version_names vn ON vn.version_id = v.id WHERE v.version_group_id = vg.id) AS since,
              tn.name AS type_name, c.power, c.pp, c.accuracy, c.priority, c.effect_chance
       FROM move_changelog c
       JOIN version_groups vg ON vg.id = c.changed_in_version_group_id
       LEFT JOIN type_names tn ON tn.type_id = c.type_id
       WHERE c.move_id = ?`,
      id
    ),
    db.getAllAsync<{ order: number; since: string; effect: string }>(
      `SELECT vg."order", (SELECT GROUP_CONCAT(vn.name, ' / ') FROM versions v
                JOIN version_names vn ON vn.version_id = v.id WHERE v.version_group_id = vg.id) AS since,
              p.effect
       FROM move_effect_changelog c
       JOIN move_effect_changelog_prose p ON p.move_effect_changelog_id = c.id
       JOIN version_groups vg ON vg.id = c.changed_in_version_group_id
       JOIN moves m ON m.effect_id = c.effect_id
       WHERE m.id = ?`,
      id
    ),
  ]);

  const changes = new Map<number, MoveChange>();
  const add = (order: number, since: string, text: string) => {
    const change = changes.get(order) ?? { since, before: [] };
    change.before.push(text);
    changes.set(order, change);
  };
  for (const c of statChanges) {
    if (c.type_name) add(c.order, c.since, `${c.type_name} type`);
    if (c.power !== null) add(c.order, c.since, `${c.power} power`);
    if (c.accuracy !== null) add(c.order, c.since, `${c.accuracy}% accuracy`);
    if (c.pp !== null) add(c.order, c.since, `${c.pp} PP`);
    if (c.priority !== null) add(c.order, c.since, `priority ${formatPriority(c.priority)}`);
    if (c.effect_chance !== null) add(c.order, c.since, `${c.effect_chance}% effect chance`);
  }
  // Effect changes describe what the move did differently before
  for (const c of effectChanges) add(c.order, c.since, c.effect);

  const filled = fillEffectChance(move.effect, move.effect_chance);
  return {
    id: move.id,
    name: move.name,
    type: { identifier: move.type, name: move.type_name },
    category: move.identifier.endsWith('--physical') || move.identifier.endsWith('--special')
      ? 'Physical or Special'
      : capitalize(move.category),
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    searchName: normalizeForSearch(move.name),
    priority: move.priority,
    target: move.target,
    effect: filled.text,
    effectChance: filled.leftover,
    flavorText: flavor?.flavor_text ?? null,
    generation: move.generation.replace('generation-', '').toUpperCase(),
    // Newest change first, like the rest of the app's per-game data
    changes: [...changes.entries()].sort((a, b) => b[0] - a[0]).map(([, c]) => c),
  };
}

/**
 * "Has a chance to burn" → "Has a 10% chance to burn" when the move says how likely.
 * `leftover` is a chance the text had no place for, worth showing on its own (100% isn't).
 */
function fillEffectChance(effect: string | null, chance: number | null) {
  if (effect && chance !== null && /\b(a|an) chance\b/i.test(effect)) {
    return { text: effect.replace(/\b(a|an) chance\b/i, `a ${chance}% chance`), leftover: null };
  }
  return { text: effect, leftover: chance !== null && chance < 100 ? chance : null };
}

export function formatPriority(priority: number) {
  return priority > 0 ? `+${priority}` : String(priority);
}

/** Games where any Pokémon learns the move, newest first. */
export async function loadMoveGames(db: SQLiteDatabase, moveId: number): Promise<GameOption[]> {
  const rows = await db.getAllAsync<{ id: number; order: number; names: string }>(
    `SELECT vg.id, vg."order", GROUP_CONCAT(vn.name, '/') AS names
     FROM version_groups vg
     JOIN versions v ON v.version_group_id = vg.id
     JOIN version_names vn ON vn.version_id = v.id
     WHERE vg.id IN (SELECT DISTINCT version_group_id FROM pokemon_moves WHERE move_id = ?)
     GROUP BY vg.id
     ORDER BY vg."order" DESC`,
    moveId
  );
  return rows.map((r) => ({ versionGroupId: r.id, order: r.order, name: r.names }));
}

export type MoveLearner = {
  /** National Dex number. */
  number: number;
  pokemonId: number;
  /** "Raichu", or a form's own name ("Alolan Raichu"). */
  name: string;
  types: DexType[];
  /** "Level up", "Machine", "Egg", "Tutor"… */
  method: string;
  /** Level for level-up moves (0 = on evolution). */
  level: number;
};

/** Every Pokémon (and form) that learns the move in a game, by method then Dex number. */
export async function loadMoveLearners(
  db: SQLiteDatabase,
  moveId: number,
  versionGroupId: number
): Promise<MoveLearner[]> {
  const rows = await db.getAllAsync<{
    number: number;
    pokemon_id: number;
    is_default: number;
    form: string | null;
    name: string;
    method: string;
    level: number;
    type1: string;
    type1_name: string;
    type2: string | null;
    type2_name: string | null;
  }>(
    `SELECT p.species_id AS number, p.id AS pokemon_id, p.is_default, f.form_identifier AS form,
            COALESCE(CASE WHEN p.is_default = 0 THEN fn.pokemon_name END, sn.name) AS name,
            mp.name AS method, MIN(pm.level) AS level,
            t1.identifier AS type1, tn1.name AS type1_name,
            t2.identifier AS type2, tn2.name AS type2_name
     FROM pokemon_moves pm
     JOIN pokemon p ON p.id = pm.pokemon_id
     JOIN pokemon_species_names sn ON sn.pokemon_species_id = p.species_id
     LEFT JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
     LEFT JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
     JOIN pokemon_move_method_prose mp ON mp.pokemon_move_method_id = pm.pokemon_move_method_id
     JOIN pokemon_types pt1 ON pt1.pokemon_id = p.id AND pt1.slot = 1
     JOIN types t1 ON t1.id = pt1.type_id
     JOIN type_names tn1 ON tn1.type_id = t1.id
     LEFT JOIN pokemon_types pt2 ON pt2.pokemon_id = p.id AND pt2.slot = 2
     LEFT JOIN types t2 ON t2.id = pt2.type_id
     LEFT JOIN type_names tn2 ON tn2.type_id = t2.id
     WHERE pm.move_id = ? AND pm.version_group_id = ?
     GROUP BY p.id, pm.pokemon_move_method_id
     ORDER BY pm.pokemon_move_method_id, p.species_id, p.is_default DESC, p."order", p.id`,
    moveId,
    versionGroupId
  );
  // Forms that learn it exactly like their default form (Pikachu in a cap, Totem forms) would
  // only repeat it; regional forms stay, since they're Pokémon players look for by name
  const defaults = new Set(
    rows.filter((r) => r.is_default === 1).map((r) => `${r.number}|${r.method}|${r.level}`)
  );
  const repeats = (r: (typeof rows)[number]) =>
    r.is_default === 0 &&
    !isRegionalForm(r.form) &&
    defaults.has(`${r.number}|${r.method}|${r.level}`);

  return rows.filter((r) => !repeats(r)).map((r) => ({
    number: r.number,
    pokemonId: r.pokemon_id,
    name: r.name,
    method: r.method,
    level: r.level,
    types: [
      { identifier: r.type1, name: r.type1_name },
      ...(r.type2 && r.type2_name ? [{ identifier: r.type2, name: r.type2_name }] : []),
    ],
  }));
}
