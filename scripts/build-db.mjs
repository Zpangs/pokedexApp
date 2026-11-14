#!/usr/bin/env node
/**
 * Builds the bundled Pokédex database (assets/db/pokedex.db) from PokéAPI's CSV dump.
 *
 * PokéAPI publishes its whole dataset as CSV files in its GitHub repo. We download a pinned
 * commit of those files (cached in .cache/), keep English text only, and import each table
 * as-is, so the schema matches PokéAPI's own (https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).
 * Language columns are dropped, since everything left is English.
 *
 * Usage: npm run build-db [-- --force]
 * Skips the build when assets/db/pokedex.db already matches the current version; --force rebuilds.
 * To update the data, change POKEAPI_COMMIT to a newer commit of PokeAPI/pokeapi and rebuild.
 *
 * PokéAPI has no item locations, so those come from data/item-locations.json (made by
 * scripts/scrape-item-locations.mjs from Serebii.net) and go into the item_locations table.
 */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const POKEAPI_COMMIT = '8a92bfa7dab2f12b84b5d151562f9857c133ff30';
/** Bump when this script's output changes shape, so the app picks up a fresh copy. */
const SCHEMA_VERSION = 2;
const ENGLISH = '9';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'pokeapi-csv', POKEAPI_COMMIT);
const OUT_DB = path.join(ROOT, 'assets', 'db', 'pokedex.db');
const OUT_VERSION = path.join(ROOT, 'src', 'db', 'version.ts');
const ITEM_LOCATIONS = path.join(ROOT, 'data', 'item-locations.json');
const CSV_URL = (table) =>
  `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv/${table}.csv`;

/** Tables to import. Conquest, contest, Pokéathlon and Pal Park data are left out. */
const TABLES = [
  // Pokémon
  'pokemon', 'pokemon_species', 'pokemon_species_names', 'pokemon_species_flavor_text',
  'pokemon_species_prose', 'pokemon_forms', 'pokemon_form_names', 'pokemon_form_types',
  'pokemon_form_generations', 'pokemon_stats', 'pokemon_stats_past', 'pokemon_types',
  'pokemon_types_past', 'pokemon_abilities', 'pokemon_abilities_past', 'pokemon_items',
  'pokemon_egg_groups', 'pokemon_colors', 'pokemon_color_names', 'pokemon_shapes',
  'pokemon_shape_prose', 'pokemon_habitats', 'pokemon_habitat_names', 'egg_groups',
  'egg_group_prose', 'genders', 'growth_rates', 'growth_rate_prose', 'experience',
  // Evolution
  'evolution_chains', 'pokemon_evolution', 'evolution_triggers', 'evolution_trigger_prose',
  // Learnsets
  'pokemon_moves', 'pokemon_move_methods', 'pokemon_move_method_prose',
  'version_group_pokemon_move_methods', 'machines',
  // Pokédexes, regions, games
  'pokedexes', 'pokedex_prose', 'pokedex_version_groups', 'pokemon_dex_numbers', 'regions',
  'region_names', 'generations', 'generation_names', 'version_groups', 'version_group_regions',
  'versions', 'version_names',
  // Locations and encounters
  'locations', 'location_names', 'location_areas', 'location_area_prose',
  'location_area_encounter_rates', 'encounters', 'encounter_slots', 'encounter_methods',
  'encounter_method_prose', 'encounter_conditions', 'encounter_condition_prose',
  'encounter_condition_values', 'encounter_condition_value_prose', 'encounter_condition_value_map',
  // Moves
  'moves', 'move_names', 'move_flavor_text', 'move_effects', 'move_effect_prose',
  'move_changelog', 'move_effect_changelog', 'move_effect_changelog_prose', 'move_damage_classes',
  'move_damage_class_prose', 'move_targets', 'move_target_prose', 'move_meta',
  'move_meta_ailments', 'move_meta_ailment_names', 'move_meta_categories',
  'move_meta_category_prose', 'move_meta_stat_changes', 'move_flags', 'move_flag_map',
  'move_flag_prose',
  // Abilities
  'abilities', 'ability_names', 'ability_prose', 'ability_flavor_text', 'ability_changelog',
  'ability_changelog_prose',
  // Items and berries
  'items', 'item_names', 'item_prose', 'item_flavor_text', 'item_categories',
  'item_category_prose', 'item_pockets', 'item_pocket_names', 'item_flags', 'item_flag_map',
  'item_flag_prose', 'item_fling_effects', 'item_fling_effect_prose', 'berries',
  'berry_firmness', 'berry_firmness_names', 'berry_flavors',
  // Types, stats, natures
  'types', 'type_names', 'type_efficacy', 'type_efficacy_past', 'stats', 'stat_names',
  'natures', 'nature_names',
];

const LANGUAGE_COLUMNS = new Set(['local_language_id', 'language_id']);

/**
 * Indexes for the biggest tables, as lists of columns. Every other table gets an index on each
 * *_id column; on these that would add many MB for lookups the app never makes.
 */
const INDEX_OVERRIDES = {
  // A Pokémon's learnset in a given game, and which Pokémon learn a given move
  pokemon_moves: [['pokemon_id', 'version_group_id'], ['move_id']],
  // Where a Pokémon can be found, and what can be found in an area
  encounters: [['pokemon_id'], ['location_area_id']],
  encounter_condition_value_map: [['encounter_id']],
};

async function download(table) {
  const file = path.join(CACHE_DIR, `${table}.csv`);
  if (existsSync(file)) return readFile(file, 'utf8');
  const res = await fetch(CSV_URL(table));
  if (!res.ok) throw new Error(`Downloading ${table}.csv failed: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(file, text);
  return text;
}

async function downloadAll(tables, concurrency = 8) {
  const results = new Map();
  const queue = [...tables];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let table = queue.shift(); table; table = queue.shift()) {
        results.set(table, await download(table));
      }
    })
  );
  return results;
}

/** RFC 4180 CSV parser: handles quoted fields containing commas, quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Game flavor text keeps the cartridge's line breaks, page breaks and hyphenation; flatten them. */
function cleanFlavorText(text) {
  return text
    .replace(/­\s*/g, '') // soft hyphen at a line break: join the word
    .replace(/-\n/g, '-')
    .replace(/[\f\n\r]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function columnType(values) {
  let type = 'INTEGER';
  for (const v of values) {
    if (v === '') continue;
    if (/^-?\d+$/.test(v)) continue;
    if (/^-?\d*\.\d+$/.test(v)) type = 'REAL';
    else return 'TEXT';
  }
  return type;
}

function importTable(db, table, csv) {
  const [header, ...allRows] = parseCsv(csv);
  const langIdx = header.findIndex((c) => LANGUAGE_COLUMNS.has(c));
  const rows = langIdx === -1 ? allRows : allRows.filter((r) => r[langIdx] === ENGLISH);

  const keep = header.map((c, i) => i).filter((i) => !LANGUAGE_COLUMNS.has(header[i]));
  const columns = keep.map((i) => header[i]);
  const flavorIdx = columns.indexOf('flavor_text');
  const types = keep.map((i) => columnType(rows.map((r) => r[i] ?? '')));

  const defs = columns.map((c, j) =>
    c === 'id' && types[j] === 'INTEGER' ? `"id" INTEGER PRIMARY KEY` : `"${c}" ${types[j]}`
  );
  db.exec(`CREATE TABLE "${table}" (${defs.join(', ')})`);

  const insert = db.prepare(
    `INSERT INTO "${table}" VALUES (${columns.map(() => '?').join(', ')})`
  );
  for (const r of rows) {
    const values = keep.map((i, j) => {
      const v = r[i] ?? '';
      if (v === '') return null;
      if (types[j] === 'INTEGER') return Number.parseInt(v, 10);
      if (types[j] === 'REAL') return Number.parseFloat(v);
      return j === flavorIdx ? cleanFlavorText(v) : v;
    });
    insert.run(...values);
  }

  const indexes =
    INDEX_OVERRIDES[table] ?? columns.filter((c) => c.endsWith('_id')).map((c) => [c]);
  for (const cols of indexes) {
    db.exec(
      `CREATE INDEX "${table}__${cols.join('__')}" ON "${table}" (${cols.map((c) => `"${c}"`).join(', ')})`
    );
  }
  return rows.length;
}

/**
 * Where to find items, per game: one row per line of Serebii's Locations ("found") and
 * Shopping Details ("shop") tables, in its order (oldest game first).
 */
function importItemLocations(db, json) {
  db.exec(`CREATE TABLE item_locations (
    item_id INTEGER, kind TEXT, sort INTEGER, games TEXT, location TEXT)`);
  db.exec('CREATE INDEX item_locations__item_id ON item_locations (item_id)');
  if (!json) return 0;
  const ids = new Map(db.prepare('SELECT identifier, id FROM items').all().map((r) => [r.identifier, r.id]));
  const insert = db.prepare('INSERT INTO item_locations VALUES (?, ?, ?, ?, ?)');
  let count = 0;
  for (const [identifier, { found, shops }] of Object.entries(JSON.parse(json).items)) {
    const id = ids.get(identifier);
    if (id === undefined) continue;
    for (const [kind, rows] of [['found', found], ['shop', shops]]) {
      rows.forEach((row, sort) => {
        insert.run(id, kind, sort, row.games.join(' / '), row.where.join('\n'));
        count++;
      });
    }
  }
  return count;
}

function builtVersion() {
  if (!existsSync(OUT_DB)) return null;
  try {
    const db = new DatabaseSync(OUT_DB, { readOnly: true });
    const row = db.prepare("SELECT value FROM meta WHERE key = 'version'").get();
    db.close();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const started = Date.now();
  const locations = existsSync(ITEM_LOCATIONS) ? await readFile(ITEM_LOCATIONS, 'utf8') : null;
  const locationsHash = createHash('sha1').update(locations ?? '').digest('hex').slice(0, 7);
  const version = `${SCHEMA_VERSION}-${POKEAPI_COMMIT.slice(0, 7)}-${locationsHash}`;
  if (!process.argv.includes('--force') && builtVersion() === version) {
    console.log(`${path.relative(ROOT, OUT_DB)} is up to date (version ${version}).`);
    return;
  }
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_DB), { recursive: true });

  console.log(`Fetching ${TABLES.length} CSV files from PokeAPI/pokeapi@${POKEAPI_COMMIT.slice(0, 7)}…`);
  const csvs = await downloadAll(TABLES);

  const tmp = `${OUT_DB}.tmp`;
  await rm(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');

  db.exec('BEGIN');
  let total = 0;
  for (const table of TABLES) total += importTable(db, table, csvs.get(table));
  total += importItemLocations(db, locations);

  db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)');
  const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
  meta.run('version', version);
  meta.run('pokeapi_commit', POKEAPI_COMMIT);
  meta.run('built_at', new Date().toISOString());
  db.exec('COMMIT');

  db.exec('ANALYZE; VACUUM;');
  db.close();
  await rename(tmp, OUT_DB);

  await writeFile(
    OUT_VERSION,
    `// Generated by scripts/build-db.mjs. Do not edit.\nexport const DB_VERSION = '${version}';\n`
  );

  const { size } = await stat(OUT_DB);
  console.log(
    `Wrote ${path.relative(ROOT, OUT_DB)}: ${TABLES.length} tables, ${total.toLocaleString()} rows, ` +
      `${(size / 1024 / 1024).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(1)}s (version ${version})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
