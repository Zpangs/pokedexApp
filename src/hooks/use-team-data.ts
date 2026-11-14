import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import {
  type GameData,
  loadGameData,
  loadMemberOptions,
  loadTeamGames,
  type MemberOptions,
  type TeamGame,
} from '@/db/queries/team-builder';

/** The games a team can be built for. */
export function useTeamGames() {
  const db = useSQLiteContext();
  const [games, setGames] = useState<TeamGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadTeamGames(db).then(setGames, (e: unknown) => setError(String(e)));
  }, [db]);
  return { games, error };
}

/** Everything about one game the builder needs; null while loading. */
export function useGameData(versionGroupId: number | undefined) {
  const db = useSQLiteContext();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (versionGroupId === undefined) return;
    let live = true;
    loadTeamGames(db)
      .then((games) => {
        const game = games.find((g) => g.versionGroupId === versionGroupId);
        if (!game) throw new Error('This game is no longer in the data');
        return loadGameData(db, game);
      })
      .then(
        (d) => live && setData(d),
        (e: unknown) => live && setError(String(e))
      );
    return () => {
      live = false;
    };
  }, [db, versionGroupId]);
  return { data: data?.game.versionGroupId === versionGroupId ? data : null, error };
}

/** Abilities, moves and stats for each of these Pokémon in the game, keyed by Pokémon id. */
export function useMemberOptions(data: GameData | null, pokemonIds: number[]) {
  const db = useSQLiteContext();
  const [options, setOptions] = useState<Map<number, MemberOptions>>(new Map());
  const idsKey = pokemonIds.join(',');
  useEffect(() => {
    if (!data) return;
    let live = true;
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    Promise.all(ids.map((id) => loadMemberOptions(db, data, id).then((o) => [id, o] as const))).then(
      (entries) => live && setOptions(new Map(entries))
    );
    return () => {
      live = false;
    };
  }, [db, data, idsKey]);
  return options;
}
