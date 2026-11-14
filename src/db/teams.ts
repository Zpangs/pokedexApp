import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { StatSpread } from './queries/team-builder';

/**
 * Saved teams. They live in their own database on the device (teams.db), apart from the
 * bundled Pokédex data, so updating the app's data never touches them.
 */

export type TeamMember = {
  pokemonId: number;
  nickname: string | null;
  abilityId: number | null;
  itemId: number | null;
  natureId: number | null;
  /** Always four slots; null is an empty slot. */
  moves: (number | null)[];
  level: number;
  evs: StatSpread;
  ivs: StatSpread;
  teraTypeId: number | null;
  gigantamax: boolean;
};

export type Team = {
  id: number;
  name: string;
  versionGroupId: number;
  /** Up to six, in party order. */
  members: TeamMember[];
  updatedAt: number;
};

export const TEAM_SIZE = 6;

export function newMember(pokemonId: number, defaults: Partial<TeamMember> = {}): TeamMember {
  return {
    pokemonId,
    nickname: null,
    abilityId: null,
    itemId: null,
    natureId: null,
    moves: [null, null, null, null],
    level: 50,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    teraTypeId: null,
    gigantamax: false,
    ...defaults,
  };
}

let db: SQLiteDatabase | null = null;

function open() {
  if (db) return db;
  db = openDatabaseSync('teams.db');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version_group_id INTEGER NOT NULL,
      members TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

type Row = { id: number; name: string; version_group_id: number; members: string; updated_at: number };

function toTeam(r: Row): Team {
  let members: TeamMember[] = [];
  try {
    members = (JSON.parse(r.members) as Partial<TeamMember>[]).map((m) => newMember(m.pokemonId ?? 0, m));
  } catch {
    // A damaged row still opens, empty, instead of breaking the list
  }
  return { id: r.id, name: r.name, versionGroupId: r.version_group_id, members, updatedAt: r.updated_at };
}

// An in-memory copy kept in step with the database, so every screen reads the same teams
let teams: Team[] | null = null;
const listeners = new Set<() => void>();

function all(): Team[] {
  teams ??= open()
    .getAllSync<Row>(`SELECT * FROM teams ORDER BY updated_at DESC`)
    .map(toTeam);
  return teams;
}

function changed(next: Team[]) {
  teams = [...next].sort((a, b) => b.updatedAt - a.updatedAt);
  listeners.forEach((l) => l());
}

export function createTeam(name: string, versionGroupId: number, members: TeamMember[] = []): number {
  const now = Date.now();
  const result = open().runSync(
    `INSERT INTO teams (name, version_group_id, members, updated_at) VALUES (?, ?, ?, ?)`,
    name,
    versionGroupId,
    JSON.stringify(members),
    now
  );
  const id = Number(result.lastInsertRowId);
  changed([...all(), { id, name, versionGroupId, members, updatedAt: now }]);
  return id;
}

/** Saves a changed copy of a team. */
export function saveTeam(team: Team) {
  const next = { ...team, updatedAt: Date.now() };
  open().runSync(
    `UPDATE teams SET name = ?, members = ?, updated_at = ? WHERE id = ?`,
    next.name,
    JSON.stringify(next.members),
    next.updatedAt,
    next.id
  );
  changed(all().map((t) => (t.id === next.id ? next : t)));
}

export function updateMember(team: Team, index: number, change: Partial<TeamMember>) {
  saveTeam({ ...team, members: team.members.map((m, i) => (i === index ? { ...m, ...change } : m)) });
}

export function deleteTeam(id: number) {
  open().runSync(`DELETE FROM teams WHERE id = ?`, id);
  changed(all().filter((t) => t.id !== id));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTeams(): Team[] {
  return useSyncExternalStore(subscribe, all);
}

export function useTeam(id: number): Team | undefined {
  return useSyncExternalStore(subscribe, () => all().find((t) => t.id === id));
}
