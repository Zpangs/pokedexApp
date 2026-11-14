import type { GameData, MemberOptions } from './queries/team-builder';
import { effectiveness } from './queries/types';
import type { BattleType } from './queries/types';
import type { Team } from './teams';

export type DefenseRow = {
  /** The attacking type. */
  type: BattleType;
  weak: number;
  /** Of those weak, how many take ×4. */
  double: number;
  resist: number;
  immune: number;
  /** More members weak than resisting or immune: a hole in the team. */
  problem: boolean;
};

/**
 * How the team takes each attacking type, by the members' own types in this game. Abilities
 * (Levitate…), items and Tera are left out.
 */
export function teamDefense(team: Team, data: GameData): DefenseRow[] {
  const members = team.members.map((m) => data.pokemonById.get(m.pokemonId)).filter((p) => p !== undefined);
  return data.types.map((type) => {
    let weak = 0;
    let double = 0;
    let resist = 0;
    let immune = 0;
    for (const p of members) {
      const m = effectiveness(data.chart, type.id, p.typeIds);
      if (m === 0) immune++;
      else if (m > 1) {
        weak++;
        if (m >= 4) double++;
      }
      else if (m < 1) resist++;
    }
    return { type, weak, double, resist, immune, problem: weak >= 2 && weak > resist + immune };
  });
}

export type CoverageRow = {
  /** The defending type. */
  type: BattleType;
  /** The best multiplier any member's attacking move gets against it. */
  best: number;
};

/** The best hit the team's damaging moves get on each single type. */
export function teamCoverage(team: Team, data: GameData, options: Map<number, MemberOptions>): CoverageRow[] {
  const attackTypes = new Set<number>();
  for (const m of team.members) {
    const o = options.get(m.pokemonId);
    for (const id of m.moves) {
      const move = id ? o?.moveById.get(id) : undefined;
      if (move && move.category !== 'Status') attackTypes.add(move.typeId);
    }
  }
  return data.types.map((type) => ({
    type,
    best: attackTypes.size
      ? Math.max(...[...attackTypes].map((a) => effectiveness(data.chart, a, [type.id])))
      : 0,
  }));
}
