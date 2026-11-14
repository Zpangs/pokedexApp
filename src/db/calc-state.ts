import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { type Boosts, NO_BOOSTS, type Status, type Terrain, type Weather } from './damage';
import type { StatSpread } from './queries/team-builder';
import type { TeamMember } from './teams';

/**
 * The damage calculator's setup: the game, both Pokémon and the field. Remembered between
 * launches, so the last calculation is still there.
 */

export type CalcRole = 'attacker' | 'defender';

export type CalcSide = {
  pokemonId: number;
  abilityId: number | null;
  itemId: number | null;
  natureId: number | null;
  level: number;
  evs: StatSpread;
  ivs: StatSpread;
  teraTypeId: number | null;
  terastallized: boolean;
  boosts: Boosts;
  status: Status;
  /** Current HP as a share of the maximum, 1–100. */
  hpPercent: number;
  /** The move it uses when attacking. */
  moveId: number | null;
  /** Its moves on the team it was loaded from, for quick switching. */
  teamMoves: number[];
  /** "From Rain team", when loaded from a team. */
  source: string | null;
};

export type CalcField = {
  doubles: boolean;
  weather: Weather;
  terrain: Terrain;
  crit: boolean;
  screen: boolean;
  helpingHand: boolean;
  /** Hits for moves that hit 2–5 times. */
  hits: number;
};

export type CalcState = {
  versionGroupId: number | null;
  attacker: CalcSide | null;
  defender: CalcSide | null;
  field: CalcField;
};

const DEFAULT_FIELD: CalcField = {
  doubles: false,
  weather: 'none',
  terrain: 'none',
  crit: false,
  screen: false,
  helpingHand: false,
  hits: 3,
};

const KEY = 'damage-calc';
const listeners = new Set<() => void>();

function read(): CalcState {
  const empty: CalcState = { versionGroupId: null, attacker: null, defender: null, field: DEFAULT_FIELD };
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw) as Partial<CalcState>;
    return {
      versionGroupId: saved.versionGroupId ?? null,
      attacker: saved.attacker ? { ...newSide(saved.attacker.pokemonId), ...saved.attacker } : null,
      defender: saved.defender ? { ...newSide(saved.defender.pokemonId), ...saved.defender } : null,
      field: { ...DEFAULT_FIELD, ...saved.field },
    };
  } catch {
    return empty;
  }
}

let state = read();

function commit(next: CalcState) {
  state = next;
  try {
    Storage.setItemSync(KEY, JSON.stringify(next));
  } catch {
    // Forgotten next launch, but the calculation still updates
  }
  listeners.forEach((l) => l());
}

export function newSide(pokemonId: number, defaults: Partial<CalcSide> = {}): CalcSide {
  return {
    pokemonId,
    abilityId: null,
    itemId: null,
    natureId: null,
    level: 50,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    teraTypeId: null,
    terastallized: false,
    boosts: { ...NO_BOOSTS },
    status: 'none',
    hpPercent: 100,
    moveId: null,
    teamMoves: [],
    source: null,
    ...defaults,
  };
}

/** A team member as a calculator side, with its first move ready to use. */
export function sideFromMember(member: TeamMember, source: string): CalcSide {
  const moves = member.moves.filter((m): m is number => m !== null);
  return newSide(member.pokemonId, {
    abilityId: member.abilityId,
    itemId: member.itemId,
    natureId: member.natureId,
    level: member.level,
    evs: { ...member.evs },
    ivs: { ...member.ivs },
    teraTypeId: member.teraTypeId,
    moveId: moves[0] ?? null,
    teamMoves: moves,
    source,
  });
}

/** Switches game; Pokémon are kept and checked against the new game once it has loaded. */
export function setCalcGame(versionGroupId: number) {
  if (versionGroupId === state.versionGroupId) return;
  commit({ ...state, versionGroupId });
}

export function setSide(role: CalcRole, side: CalcSide | null) {
  commit({ ...state, [role]: side });
}

export function updateSide(role: CalcRole, change: Partial<CalcSide>) {
  const side = state[role];
  if (side) commit({ ...state, [role]: { ...side, ...change } });
}

export function updateField(change: Partial<CalcField>) {
  commit({ ...state, field: { ...state.field, ...change } });
}

export function swapSides() {
  commit({ ...state, attacker: state.defender, defender: state.attacker });
}

/** Opens a team member in the calculator, in its team's game. */
export function loadIntoCalc(versionGroupId: number, role: CalcRole, side: CalcSide) {
  const keepOther = versionGroupId === state.versionGroupId;
  commit({
    ...state,
    versionGroupId,
    attacker: role === 'attacker' ? side : keepOther ? state.attacker : null,
    defender: role === 'defender' ? side : keepOther ? state.defender : null,
  });
}

export function getCalc() {
  return state;
}

export function useCalc() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}
