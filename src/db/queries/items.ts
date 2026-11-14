import type { SQLiteDatabase } from 'expo-sqlite';

import { type DexType, normalizeForSearch } from './national-dex';
import { isTotemForm } from './pokemon-detail';
import {
  type ListedPokemon,
  POKEMON_COLUMNS,
  POKEMON_JOINS,
  type PokemonListRow,
  toListedPokemon,
} from './pokemon-list';

/**
 * Left out of the item list: items the games never use, and Dynamax Crystals (300 raid-den
 * keys for one feature). Items with no text at all (TM materials, curry ingredients…) are too.
 */
const HIDDEN_CATEGORIES = `'unused', 'dynamax-crystals'`;

/** Bag pockets in the order the list shows them: the everyday ones first. */
const POCKET_ORDER = ['misc', 'medicine', 'pokeballs', 'berries', 'battle', 'machines', 'key', 'mail'];

export type ItemSummary = {
  id: number;
  /** For the bag icon. */
  identifier: string;
  name: string;
  /** "Held items", "Evolution"… */
  category: string;
  /** The bag pocket: "Items", "Medicine", "Poké Balls"… */
  pocket: string;
  /** One-line effect, or the in-game description when there's none. */
  effect: string | null;
  searchName: string;
  /** Category, pocket and effect, normalized, with a leading space for word-start matching. */
  searchText: string;
};

/** Every item worth looking up, by bag pocket, then A to Z (TM02 before TM10). */
export async function loadItems(db: SQLiteDatabase): Promise<ItemSummary[]> {
  const rows = await db.getAllAsync<{
    id: number;
    identifier: string;
    name: string;
    category: string;
    pocket_identifier: string;
    pocket: string;
    short_effect: string | null;
    flavor: string | null;
  }>(`
    SELECT * FROM (
      SELECT i.id, i.identifier, n.name, cp.name AS category, ip.identifier AS pocket_identifier,
             pn.name AS pocket, p.short_effect,
             (SELECT f.flavor_text FROM item_flavor_text f
              JOIN version_groups vg ON vg.id = f.version_group_id
              WHERE f.item_id = i.id ORDER BY vg."order" DESC LIMIT 1) AS flavor
      FROM items i
      JOIN item_names n ON n.item_id = i.id
      JOIN item_categories c ON c.id = i.category_id
      JOIN item_category_prose cp ON cp.item_category_id = c.id
      JOIN item_pockets ip ON ip.id = c.pocket_id
      JOIN item_pocket_names pn ON pn.item_pocket_id = ip.id
      LEFT JOIN item_prose p ON p.item_id = i.id
      WHERE c.identifier NOT IN (${HIDDEN_CATEGORIES})
    )
    WHERE short_effect IS NOT NULL OR flavor IS NOT NULL`);

  const taught = await loadMachineSummaries(db);
  const items = rows.map((r) => {
    // A machine's own text is from one old game; what it teaches now says more
    const machine = taught.get(r.id);
    const effect = machine?.summary ?? cleanText(r.short_effect ?? r.flavor);
    return {
      id: r.id,
      identifier: r.identifier,
      name: r.name,
      category: r.category,
      pocket: r.pocket,
      pocketOrder: POCKET_ORDER.indexOf(r.pocket_identifier),
      effect,
      searchName: normalizeForSearch(r.name),
      searchText: ` ${normalizeForSearch(
        `${r.category} ${r.pocket} ${effect ?? ''} ${machine?.search ?? ''}`
      )}`,
    };
  });
  items.sort((a, b) => a.pocketOrder - b.pocketOrder || naturalCompare(a.name, b.name));
  return items.map(({ pocketOrder: _, ...item }) => item);
}

/**
 * What each TM and HM teaches in the two newest games that have it, e.g.
 * "Ice Punch in Legends: Z-A · Fire Spin in Scarlet/Violet".
 */
async function loadMachineSummaries(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ item_id: number; move: string; game: string }>(
    `SELECT m.item_id, mn.name AS move,
            (SELECT GROUP_CONCAT(vn.name, '/') FROM versions v
             JOIN version_names vn ON vn.version_id = v.id WHERE v.version_group_id = vg.id) AS game
     FROM machines m
     JOIN version_groups vg ON vg.id = m.version_group_id
     JOIN move_names mn ON mn.move_id = m.move_id
     ORDER BY vg."order" DESC`
  );
  // The two newest games, with a move taught in both said once
  const shown = new Map<number, { move: string; games: string[] }[]>();
  const counted = new Map<number, number>();
  const moves = new Map<number, Set<string>>();
  for (const r of rows) {
    moves.set(r.item_id, (moves.get(r.item_id) ?? new Set()).add(r.move));
    const slots = counted.get(r.item_id) ?? 0;
    if (slots >= 2) continue;
    counted.set(r.item_id, slots + 1);
    const list = shown.get(r.item_id) ?? [];
    const last = list[list.length - 1];
    if (last?.move === r.move) last.games.push(shortGameName(r.game));
    else list.push({ move: r.move, games: [shortGameName(r.game)] });
    shown.set(r.item_id, list);
  }
  return new Map(
    [...shown].map(([id, list]) => [
      id,
      {
        summary: list.map((e) => `${e.move} in ${e.games.join(' and ')}`).join(' · '),
        // Search also finds older moves: TM24 taught Thunderbolt for years
        search: [...(moves.get(id) ?? [])].join(' '),
      },
    ])
  );
}

/** "Scarlet: The Indigo Disk/Violet: The Indigo Disk" → "The Indigo Disk". */
export function shortGameName(names: string) {
  const parts = names.split('/');
  if (parts.length < 2) return names;
  const suffixes = parts.map((p) => p.split(': ')[1]);
  return suffixes.every((x) => x && x === suffixes[0]) ? suffixes[0]! : names;
}

/**
 * Every word must match the name (anywhere), or start a word of the category, pocket or
 * effect: "stone" finds the evolution stones, "berry hp" the healing berries.
 */
export function matchesItemQuery(item: ItemSummary, words: string[]) {
  return words.every((word) => item.searchName.includes(word) || item.searchText.includes(` ${word}`));
}

/** Compares names with their numbers as numbers, so TM9 sorts before TM10. */
function naturalCompare(a: string, b: string) {
  const pa = a.toLowerCase().split(/(\d+)/);
  const pb = b.toLowerCase().split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue;
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (i % 2 === 1 && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return pa[i] < pb[i] ? -1 : 1;
  }
  return pa.length - pb.length;
}

/** Game text breaks lines where the bag screen ran out of room; join them back up. */
function cleanText(text: string | null) {
  return text ? text.replace(/\s+/g, ' ').trim() : null;
}

/** A labelled part of an item's effect text, e.g. "Held in battle" and what happens then. */
export type EffectSection = {
  label: string | null;
  blocks: ({ kind: 'text'; text: string } | { kind: 'list'; items: string[] })[];
};

/**
 * PokéAPI writes item effects as Markdown definition lists ("Used on a party Pokémon\n:   …")
 * with indented paragraphs and "*" bullet lists under each term. This turns them into sections.
 */
export function parseEffect(text: string | null): EffectSection[] {
  if (!text) return [];
  const sections: EffectSection[] = [];
  for (const raw of text.split(/\n\s*\n/)) {
    let body = raw;
    const term = /^([^\n]+)\n:\s+([\s\S]*)$/.exec(raw);
    if (term) {
      sections.push({ label: term[1].trim(), blocks: [] });
      body = term[2];
    } else if (sections.length === 0) {
      sections.push({ label: null, blocks: [] });
    }
    const section = sections[sections.length - 1];

    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines[0]?.startsWith('* ')) {
      // Bullets, each possibly running over several lines
      const items: string[] = [];
      for (const line of lines) {
        if (line.startsWith('* ') || items.length === 0) items.push(line.replace(/^\* /, ''));
        else items[items.length - 1] += ` ${line}`;
      }
      section.blocks.push({ kind: 'list', items: items.map((i) => i.replace(/\s+/g, ' ')) });
      continue;
    }
    const paragraph = lines.join(' ').replace(/\s+/g, ' ');
    if (paragraph) section.blocks.push({ kind: 'text', text: paragraph });
  }
  return sections;
}

/** Drops the full effect when it only says what the one-line effect already does. */
function withoutRepeat(sections: EffectSection[], effect: string | null) {
  const text = sections
    .flatMap((s) => s.blocks.map((b) => (b.kind === 'text' ? b.text : b.items.join(' '))))
    .join(' ');
  return effect && text === effect ? [] : sections;
}

/** Lowercase letters and digits only, so "Let's Go" (Serebii) matches "Let’s Go" (PokéAPI). */
const gameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

let rankCache: Promise<Map<string, number>> | null = null;

/**
 * Each game's place in release order, by name: "Scarlet", and DLC both as "Scarlet: The Teal
 * Mask" and "The Teal Mask", the way Serebii names it.
 */
function gameRanks(db: SQLiteDatabase) {
  rankCache ??= db
    .getAllAsync<{ name: string; order: number }>(
      `SELECT vn.name, vg."order" FROM versions v
       JOIN version_names vn ON vn.version_id = v.id
       JOIN version_groups vg ON vg.id = v.version_group_id`
    )
    .then((rows) => {
      const ranks = new Map<string, number>();
      for (const r of rows) {
        ranks.set(gameKey(r.name), r.order);
        const dlc = r.name.split(': ')[1];
        if (dlc && !r.name.startsWith('Legends')) ranks.set(gameKey(dlc), r.order);
      }
      return ranks;
    });
  return rankCache;
}

/**
 * One entry per game, newest first, with where it's found and where it's sold. Games that
 * aren't main-series (Battle Revolution, Stadium…) are left out.
 */
function groupLocations(
  rows: { kind: 'found' | 'shop'; games: string; location: string }[],
  ranks: Map<string, number>
): ItemLocation[] {
  const byGames = new Map<string, ItemLocation & { rank: number }>();
  for (const r of rows) {
    const rank = Math.max(...r.games.split(' / ').map((g) => ranks.get(gameKey(g)) ?? -1));
    if (rank < 0) continue;
    const entry = byGames.get(r.games) ?? { games: r.games, found: [], shops: [], rank };
    (r.kind === 'found' ? entry.found : entry.shops).push(...r.location.split('\n'));
    byGames.set(r.games, entry);
  }
  return [...byGames.values()]
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _, ...entry }) => entry);
}

export type MachineMove = {
  move: {
    id: number;
    name: string;
    type: DexType;
    category: string;
    power: number | null;
    accuracy: number | null;
    pp: number | null;
  };
  /** Games where the machine teaches this move, newest first. */
  games: string[];
};

export type BerryInfo = {
  firmness: string | null;
  naturalGiftType: DexType | null;
  naturalGiftPower: number | null;
  /** Hours per growth stage. */
  growthTime: number | null;
  maxHarvest: number | null;
  /** Millimetres. */
  size: number | null;
};

export type EvolutionUse = ListedPokemon & { held: boolean };

export type WildHolder = ListedPokemon & {
  /** Percent chance a wild one holds it, in `game`. */
  rarity: number;
  /** The most recent game where it can be found holding the item. */
  game: string;
};

/** Where to get the item in one game (or a pair of games), from Serebii.net. */
export type ItemLocation = {
  /** "Scarlet / Violet". */
  games: string;
  /** Places it can be found or picked up, one line per way of getting it. */
  found: string[];
  /** Shops that sell it. */
  shops: string[];
};

export type ItemDetail = Omit<ItemSummary, 'searchName' | 'searchText'> & {
  details: EffectSection[];
  flavorText: string | null;
  /** Shop price in Pokédollars; 0 when it can't be bought. */
  cost: number;
  flingPower: number | null;
  flingEffect: string | null;
  /** "Consumed when used", "Usable in battle"… */
  flags: string[];
  berry: BerryInfo | null;
  machine: MachineMove[];
  evolutions: EvolutionUse[];
  wildHolders: WildHolder[];
  /** Newest game first. */
  locations: ItemLocation[];
};

/** Flags worth telling a player; the rest describe the bag, not the item. */
const SHOWN_FLAGS = ['consumable', 'usable-overworld', 'usable-in-battle', 'holdable'];

export async function loadItem(db: SQLiteDatabase, id: number): Promise<ItemDetail | null> {
  const item = await db.getFirstAsync<{
    id: number;
    identifier: string;
    name: string;
    category: string;
    pocket: string;
    short_effect: string | null;
    effect: string | null;
    cost: number;
    fling_power: number | null;
    fling_effect: string | null;
  }>(
    `SELECT i.id, i.identifier, n.name, cp.name AS category, pn.name AS pocket,
            p.short_effect, p.effect, i.cost, i.fling_power, fe.effect AS fling_effect
     FROM items i
     JOIN item_names n ON n.item_id = i.id
     JOIN item_categories c ON c.id = i.category_id
     JOIN item_category_prose cp ON cp.item_category_id = c.id
     JOIN item_pocket_names pn ON pn.item_pocket_id = c.pocket_id
     LEFT JOIN item_prose p ON p.item_id = i.id
     LEFT JOIN item_fling_effect_prose fe ON fe.item_fling_effect_id = i.fling_effect_id
     WHERE i.id = ?`,
    id
  );
  if (!item) return null;

  const [flavor, flags, berry, machines, evolutions, holders, locations, ranks] = await Promise.all([
    db.getFirstAsync<{ flavor_text: string }>(
      `SELECT f.flavor_text FROM item_flavor_text f
       JOIN version_groups vg ON vg.id = f.version_group_id
       WHERE f.item_id = ? ORDER BY vg."order" DESC LIMIT 1`,
      id
    ),
    db.getAllAsync<{ identifier: string; description: string }>(
      `SELECT f.identifier, fp.description FROM item_flag_map m
       JOIN item_flags f ON f.id = m.item_flag_id
       JOIN item_flag_prose fp ON fp.item_flag_id = f.id
       WHERE m.item_id = ? ORDER BY f.id`,
      id
    ),
    db.getFirstAsync<{
      firmness: string | null;
      type: string | null;
      type_name: string | null;
      natural_gift_power: number | null;
      growth_time: number | null;
      max_harvest: number | null;
      size: number | null;
    }>(
      `SELECT fn.name AS firmness, t.identifier AS type, tn.name AS type_name,
              b.natural_gift_power, b.growth_time, b.max_harvest, b.size
       FROM berries b
       LEFT JOIN berry_firmness_names fn ON fn.berry_firmness_id = b.firmness_id
       LEFT JOIN types t ON t.id = b.natural_gift_type_id
       LEFT JOIN type_names tn ON tn.type_id = t.id
       WHERE b.item_id = ?`,
      id
    ),
    db.getAllAsync<{
      move_id: number;
      identifier: string;
      name: string;
      type: string;
      type_name: string;
      category: string;
      power: number | null;
      accuracy: number | null;
      pp: number | null;
      game: string;
    }>(
      `SELECT mv.id AS move_id, mv.identifier, mn.name, t.identifier AS type, tn.name AS type_name,
              dc.name AS category, mv.power, mv.accuracy, mv.pp,
              (SELECT GROUP_CONCAT(vn.name, '/') FROM versions v
               JOIN version_names vn ON vn.version_id = v.id WHERE v.version_group_id = vg.id) AS game
       FROM machines m
       JOIN version_groups vg ON vg.id = m.version_group_id
       JOIN moves mv ON mv.id = m.move_id
       JOIN move_names mn ON mn.move_id = mv.id
       JOIN types t ON t.id = mv.type_id
       JOIN type_names tn ON tn.type_id = t.id
       JOIN move_damage_class_prose dc ON dc.move_damage_class_id = mv.damage_class_id
       WHERE m.item_id = ?
       ORDER BY vg."order" DESC`,
      id
    ),
    db.getAllAsync<PokemonListRow & { held: number }>(
      `SELECT ${POKEMON_COLUMNS}, MIN(e.trigger_item_id IS NOT ?) AS held
       FROM pokemon_evolution e
       LEFT JOIN pokemon_forms ef ON ef.id = e.evolved_pokemon_form_id
       JOIN pokemon p ON p.id = COALESCE(ef.pokemon_id, e.evolved_species_id)
       ${POKEMON_JOINS}
       WHERE e.trigger_item_id = ? OR e.held_item_id = ?
       GROUP BY p.id
       ORDER BY p.species_id, p.is_default DESC, p.id`,
      id,
      id,
      id
    ),
    db.getAllAsync<PokemonListRow & { rarity: number; game: string }>(
      `SELECT ${POKEMON_COLUMNS}, pi.rarity, vn.name AS game
       FROM pokemon_items pi
       JOIN pokemon p ON p.id = pi.pokemon_id
       JOIN versions v ON v.id = pi.version_id
       JOIN version_names vn ON vn.version_id = v.id
       JOIN version_groups vg ON vg.id = v.version_group_id
       ${POKEMON_JOINS}
       WHERE pi.item_id = ?
       ORDER BY vg."order" DESC, v.id DESC`,
      id
    ),
    db.getAllAsync<{ kind: 'found' | 'shop'; games: string; location: string }>(
      `SELECT kind, games, location FROM item_locations WHERE item_id = ? ORDER BY kind, sort`,
      id
    ),
    gameRanks(db),
  ]);

  // One entry per move, with every game it's taught in (rows come newest game first)
  const machine = new Map<number, MachineMove>();
  for (const m of machines) {
    const entry = machine.get(m.move_id) ?? {
      move: {
        id: m.move_id,
        name: m.name,
        type: { identifier: m.type, name: m.type_name },
        category: m.category[0].toUpperCase() + m.category.slice(1),
        power: m.power,
        accuracy: m.accuracy,
        pp: m.pp,
      },
      games: [],
    };
    const game = shortGameName(m.game);
    if (!entry.games.includes(game)) entry.games.push(game);
    machine.set(m.move_id, entry);
  }

  const isMachine = machine.size > 0;

  // Each Pokémon once, at its chance in the newest game it holds the item in
  const wild = new Map<number, WildHolder>();
  for (const h of holders) {
    if (isTotemForm(h.form) || wild.has(h.pokemon_id)) continue;
    wild.set(h.pokemon_id, { ...toListedPokemon(h), rarity: h.rarity, game: h.game });
  }

  return {
    locations: groupLocations(locations, ranks),
    id: item.id,
    identifier: item.identifier,
    name: item.name,
    category: item.category,
    pocket: item.pocket,
    // A machine's own text describes one old game's move; its Teaches list replaces it
    effect: isMachine ? 'Teaches a move. Which one depends on the game.' : cleanText(item.short_effect),
    details: isMachine ? [] : withoutRepeat(parseEffect(item.effect), cleanText(item.short_effect)),
    flavorText: isMachine ? null : cleanText(flavor?.flavor_text ?? null),
    cost: item.cost,
    flingPower: item.fling_power,
    flingEffect: item.fling_effect,
    flags: flags.filter((f) => SHOWN_FLAGS.includes(f.identifier)).map((f) => f.description),
    berry: berry
      ? {
          firmness: berry.firmness,
          naturalGiftType:
            berry.type && berry.type_name ? { identifier: berry.type, name: berry.type_name } : null,
          naturalGiftPower: berry.natural_gift_power,
          growthTime: berry.growth_time,
          maxHarvest: berry.max_harvest,
          size: berry.size,
        }
      : null,
    machine: [...machine.values()],
    evolutions: evolutions
      .filter((e) => !isTotemForm(e.form))
      .map((e) => ({ ...toListedPokemon(e), held: e.held === 1 })),
    wildHolders: [...wild.values()].sort((a, b) => a.number - b.number || a.pokemonId - b.pokemonId),
  };
}
