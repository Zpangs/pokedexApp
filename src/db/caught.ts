import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

/**
 * Which Pokémon you've caught, per dex: each dex is its own checklist, so a Paldea run doesn't
 * tick off Kanto. Keyed by species (the National Dex number), so a regional form counts as its
 * species. Lives in the device's own database next to the teams, apart from the bundled data.
 */

let db: SQLiteDatabase | null = null;

function open() {
  if (db) return db;
  db = openDatabaseSync('teams.db');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS caught (
      pokedex_id INTEGER NOT NULL,
      species_id INTEGER NOT NULL,
      caught_at INTEGER NOT NULL,
      PRIMARY KEY (pokedex_id, species_id)
    );
  `);
  return db;
}

const EMPTY: ReadonlySet<number> = new Set();

/** Loaded checklists. A dex's set is replaced, never mutated, so React sees each change. */
const sets = new Map<number, ReadonlySet<number>>();
const listeners = new Set<() => void>();

function load(pokedexId: number): ReadonlySet<number> {
  const cached = sets.get(pokedexId);
  if (cached) return cached;
  let set: ReadonlySet<number> = EMPTY;
  try {
    const rows = open().getAllSync<{ species_id: number }>(
      'SELECT species_id FROM caught WHERE pokedex_id = ?',
      pokedexId
    );
    set = new Set(rows.map((r) => r.species_id));
  } catch {
    // Shows as nothing caught rather than breaking the Dex
  }
  sets.set(pokedexId, set);
  return set;
}

export function setCaught(pokedexId: number, speciesId: number, caught: boolean) {
  const next = new Set(load(pokedexId));
  if (caught) next.add(speciesId);
  else next.delete(speciesId);
  sets.set(pokedexId, next);
  listeners.forEach((l) => l());
  try {
    if (caught) {
      open().runSync(
        'INSERT OR REPLACE INTO caught (pokedex_id, species_id, caught_at) VALUES (?, ?, ?)',
        pokedexId,
        speciesId,
        Date.now()
      );
    } else {
      open().runSync(
        'DELETE FROM caught WHERE pokedex_id = ? AND species_id = ?',
        pokedexId,
        speciesId
      );
    }
  } catch {
    // Still ticked for this session
  }
}

export function toggleCaught(pokedexId: number, speciesId: number) {
  setCaught(pokedexId, speciesId, !load(pokedexId).has(speciesId));
}

/** The species caught in a dex (National Dex numbers). */
export function useCaught(pokedexId: number): ReadonlySet<number> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => load(pokedexId)
  );
}
