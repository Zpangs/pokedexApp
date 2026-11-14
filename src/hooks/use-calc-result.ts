import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import type { CalcRole, CalcSide, CalcState } from '@/db/calc-state';
import {
  calculate,
  type Combatant,
  type DamageMove,
  type DamageResult,
  type KoChance,
  koChance,
} from '@/db/damage';
import { type BattlePokemon, loadBattlePokemon, loadMoveInfo, type MoveInfo } from '@/db/queries/calc';
import {
  type GameData,
  loadMemberOptions,
  type MemberOptions,
  spreadStats,
  type StatSpread,
  type TeamAbility,
  type TeamMove,
} from '@/db/queries/team-builder';

/** One side as loaded: its learnset and abilities, its battle form and its stats. */
export type LoadedSide = {
  side: CalcSide;
  options: MemberOptions;
  battle: BattlePokemon;
  stats: StatSpread;
  ability: TeamAbility | null;
  combatant: Combatant;
};

export type CalcOutcome = {
  move: TeamMove;
  info: MoveInfo;
  result: DamageResult;
  /** Damage over all hits of one use. */
  min: number;
  max: number;
  maxHp: number;
  ko: KoChance | null;
};

export function useCalcResult(state: CalcState, data: GameData | null) {
  const attacker = useLoadedSide(data, state.attacker);
  const defender = useLoadedSide(data, state.defender);
  const db = useSQLiteContext();
  const moveId = state.attacker?.moveId ?? null;
  const [info, setInfo] = useState<{ id: number; info: MoveInfo | null } | null>(null);
  useEffect(() => {
    if (moveId === null) return;
    let live = true;
    loadMoveInfo(db, moveId).then((i) => live && setInfo({ id: moveId, info: i }));
    return () => {
      live = false;
    };
  }, [db, moveId]);
  const moveInfo = info && info.id === moveId ? info.info : null;

  const outcome = useMemo((): CalcOutcome | null => {
    if (!data || !attacker || !defender || moveId === null || !moveInfo) return null;
    const move = attacker.options.moveById.get(moveId);
    if (!move || move.category === 'Status') return null;
    const damageMove: DamageMove = {
      identifier: moveInfo.identifier,
      name: move.name,
      typeId: move.typeId,
      category: move.category === 'Physical' ? 'Physical' : 'Special',
      power: move.power,
      flags: moveInfo.flags,
      minHits: moveInfo.minHits,
      maxHits: moveInfo.maxHits,
      spread: moveInfo.spread,
      secondary: moveInfo.secondary,
      recoil: moveInfo.recoil,
    };
    const field = { ...state.field, gen: data.game.generation };
    if (data.game.generation < 3) field.doubles = false;
    const result = calculate(data.chart, attacker.combatant, defender.combatant, damageMove, field);
    const min = result.hitRolls.reduce((s, r) => s + Math.min(...r), 0);
    const max = result.hitRolls.reduce((s, r) => s + Math.max(...r), 0);
    const def = defender.combatant;
    const full = def.hp === def.stats.hp;
    const holdsOn =
      full &&
      ((data.game.generation >= 5 && def.ability === 'sturdy' && !moldBreaks(attacker.combatant.ability)) ||
        (data.game.generation >= 4 && def.item === 'focus-sash'));
    return {
      move,
      info: moveInfo,
      result,
      min,
      max,
      maxHp: def.stats.hp,
      ko: result.none ? null : koChance(result.hitRolls, def.hp, holdsOn),
    };
  }, [data, attacker, defender, moveId, moveInfo, state.field]);

  return { attacker, defender, outcome };
}

const moldBreaks = (ability: string | null) =>
  ability === 'mold-breaker' || ability === 'teravolt' || ability === 'turboblaze';

function useLoadedSide(data: GameData | null, side: CalcSide | null): LoadedSide | null {
  const db = useSQLiteContext();
  const pokemonId = side?.pokemonId;
  const itemId = side?.itemId ?? null;
  const [loaded, setLoaded] = useState<{
    key: string;
    options: MemberOptions;
    battle: BattlePokemon | null;
  } | null>(null);
  const key = `${data?.game.versionGroupId}:${pokemonId}:${itemId}`;

  useEffect(() => {
    if (!data || pokemonId === undefined) return;
    let live = true;
    Promise.all([loadMemberOptions(db, data, pokemonId), loadBattlePokemon(db, data, pokemonId, itemId)]).then(
      ([options, battle]) => live && setLoaded({ key, options, battle })
    );
    return () => {
      live = false;
    };
  }, [db, data, pokemonId, itemId, key]);

  return useMemo(() => {
    if (!data || !side || !loaded || loaded.key !== key || !loaded.battle) return null;
    const { options, battle } = loaded;
    const { rules } = data;
    const stats = spreadStats(battle.baseStats, side, data, battle.shedinja);
    const ability = rules.abilities
      ? (battle.forcedAbility ?? options.abilities.find((a) => a.id === side.abilityId) ?? options.abilities[0] ?? null)
      : null;
    const item = rules.heldItems && side.itemId !== null ? data.itemById.get(side.itemId) : undefined;
    const hp = battle.shedinja ? 1 : Math.max(1, Math.floor((stats.hp * side.hpPercent) / 100));
    const combatant: Combatant = {
      name: battle.name,
      species: battle.species,
      level: side.level,
      types: battle.types,
      tera: rules.tera && side.terastallized ? side.teraTypeId : null,
      stats,
      boosts: side.boosts,
      ability: ability?.identifier ?? null,
      abilityName: ability?.name ?? null,
      item: item?.identifier ?? null,
      status: side.status,
      hp,
      weightKg: battle.weightKg,
      nfe: battle.nfe,
    };
    return { side, options, battle, stats, ability, combatant };
  }, [data, side, loaded, key]);
}

/** The stats that matter for this move, on each side. */
export function relevantStats(role: CalcRole, move: TeamMove | undefined, moveIdentifier: string | undefined, gen: number) {
  const special = gen === 1 ? 'spa' : 'spd';
  if (!move || move.category === 'Status') {
    return role === 'attacker' ? (['atk', 'spa'] as const) : (['hp', 'def', special] as const);
  }
  const physical = move.category === 'Physical';
  const id = moveIdentifier ?? '';
  const speed = id === 'gyro-ball' || id === 'electro-ball';
  if (role === 'attacker') {
    const key = id === 'body-press' ? 'def' : physical ? 'atk' : 'spa';
    if (id === 'foul-play') return speed ? (['spe'] as const) : ([] as const);
    return speed ? ([key, 'spe'] as const) : ([key] as const);
  }
  const key = physical || ['psyshock', 'psystrike', 'secret-sword'].includes(id) ? 'def' : special;
  const keys: ('hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe')[] = ['hp', key];
  if (id === 'foul-play') keys.push('atk');
  if (speed) keys.push('spe');
  return keys;
}
