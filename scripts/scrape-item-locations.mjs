#!/usr/bin/env node
/**
 * Fills a gap in PokéAPI: where to find each item in each game. Reads the "Locations" and
 * "Shopping Details" tables from Serebii.net's ItemDex and writes data/item-locations.json,
 * which build-db.mjs loads into the item_locations table. The app itself stays offline.
 *
 * Run it by hand when you want fresher data (it isn't part of the normal build):
 *   node scripts/scrape-item-locations.mjs [--refetch] [--limit N]
 *
 * One request at a time with a pause in between, and pages are cached in .cache/serebii-items/,
 * so re-running only fetches what's missing (--refetch ignores the cache). Bulbapedia would be
 * the other source, but it blocks scripts behind a browser check.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'assets', 'db', 'pokedex.db');
const CACHE_DIR = path.join(ROOT, '.cache', 'serebii-items');
const OUT = path.join(ROOT, 'data', 'item-locations.json');
const DELAY_MS = 1200;
const REFETCH = process.argv.includes('--refetch');
/** --limit N: only the first N items, for trying out changes to the parser. */
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;

/** The same items the app lists (see src/db/queries/items.ts). */
function listedItems() {
  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = db
    .prepare(
      `SELECT i.identifier, n.name FROM items i
       JOIN item_names n ON n.item_id = i.id
       JOIN item_categories c ON c.id = i.category_id
       WHERE c.identifier NOT IN ('unused', 'dynamax-crystals')
         AND (EXISTS (SELECT 1 FROM item_prose p WHERE p.item_id = i.id)
              OR EXISTS (SELECT 1 FROM item_flavor_text f WHERE f.item_id = i.id))
       ORDER BY i.id`
    )
    .all();
  db.close();
  return rows;
}

/** Serebii page names that don't follow its usual spelling. */
const SLUG_ALIASES = { 'Colress Machine': 'colressmchn' };

/**
 * Serebii's possible page names for an item, most likely first. It drops spaces and
 * apostrophes but usually keeps periods and hyphens ("exp.share", "never-meltice"), with
 * exceptions ("tripass", "datacard1"), and writes ♀/♂ as f/m.
 */
function slugs(name) {
  if (SLUG_ALIASES[name]) return [SLUG_ALIASES[name]];
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9.-]/g, '');
  const variants = [
    base,
    base.replace(/\./g, ''),
    base.replace(/-/g, ''),
    base.replace(/[.-]/g, ''),
    base.replace(/0+(\d)/g, '$1'),
  ];
  return [...new Set(variants)];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The page's HTML, or null when Serebii has no page under any of the item's possible names. */
async function fetchPage(name) {
  for (const slug of slugs(name)) {
    const html = await fetchSlug(slug);
    if (html) return html;
  }
  return null;
}

async function fetchSlug(slug) {
  const file = path.join(CACHE_DIR, `${slug}.html`);
  if (!REFETCH && existsSync(file)) {
    const cached = await readFile(file, 'latin1');
    return cached === '404' ? null : cached;
  }
  await sleep(DELAY_MS);
  const res = await fetch(`https://www.serebii.net/itemdex/${slug}.shtml`, {
    headers: { 'User-Agent': 'personal-pokedex-app (one-off item location import)' },
  });
  if (res.status === 404) {
    await writeFile(file, '404');
    return null;
  }
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  // Serebii serves Latin-1
  const html = Buffer.from(await res.arrayBuffer()).toString('latin1');
  await writeFile(file, html, 'latin1');
  return html;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', Eacute: 'É' };

function text(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rows of a Serebii dextable whose header cell reads `title`: each row is the games (one cell
 * each) and what the last cell says, split into lines with repeated places said once.
 */
function table(html, title) {
  const start = html.search(new RegExp(`class="fooevo">${title}<`));
  if (start === -1) return [];
  const end = html.indexOf('</table>', start);
  const body = html.slice(start, end);
  const rows = [];
  for (const [, row] of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g)];
    const info = cells.find(([, cls]) => cls === 'fooinfo');
    if (!info) continue;
    const games = cells.filter(([, cls]) => cls !== 'fooinfo' && cls !== 'fooevo').map(([, , g]) => text(g));
    if (games.length === 0) continue;
    const where = info[2]
      .split(/<br\s*\/?>/)
      .map((line) => {
        // "Bridge Field, Bridge Field, Giant's Cap" → "Bridge Field, Giant's Cap"
        const parts = text(line).split(/,\s*/).filter(Boolean);
        return [...new Set(parts)].join(', ');
      })
      .filter(Boolean);
    if (where.length > 0) rows.push({ games, where });
  }
  return rows;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT), { recursive: true });
  const items = listedItems().slice(0, LIMIT);
  const out = {};
  const missing = [];
  for (const [i, item] of items.entries()) {
    const html = await fetchPage(item.name);
    if (i % 50 === 0) console.log(`${i}/${items.length} ${item.name}`);
    if (!html) {
      missing.push(item.name);
      continue;
    }
    const found = table(html, 'Locations');
    const shops = table(html, 'Shopping Details');
    if (found.length || shops.length) out[item.identifier] = { found, shops };
  }

  await writeFile(
    OUT,
    `${JSON.stringify(
      {
        source: 'Serebii.net ItemDex (https://www.serebii.net/itemdex/)',
        scrapedAt: new Date().toISOString().slice(0, 10),
        items: out,
      },
      null,
      1
    )}\n`
  );
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${Object.keys(out).length} of ${items.length} items have locations; ` +
      `${missing.length} have no Serebii page.`
  );
  if (missing.length) console.log(`No page: ${missing.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
