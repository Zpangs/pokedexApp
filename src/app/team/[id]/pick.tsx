import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { itemOptions, moveOptions, natureOptions, Picker, pokemonOptions } from '@/components/teams/picker';
import { type GameData, loadMemberOptions } from '@/db/queries/team-builder';
import { newMember, saveTeam, type Team, TEAM_SIZE, updateMember, useTeam } from '@/db/teams';
import { useGameData, useMemberOptions } from '@/hooks/use-team-data';

type Kind = 'pokemon' | 'move' | 'item' | 'nature';

const TITLES: Record<Kind, string> = {
  pokemon: 'Choose a Pokémon',
  move: 'Choose a move',
  item: 'Choose an item',
  nature: 'Choose a nature',
};

const PLACEHOLDERS: Record<Kind, string> = {
  pokemon: 'Name, number or type',
  move: 'Name, type or category',
  item: 'Name or effect',
  nature: 'Name',
};

/**
 * One picker for everything a team member is made of. Only what exists in the team's game is
 * listed; `slot` is the member (absent when adding one), `index` the move slot.
 */
export default function PickScreen() {
  const params = useLocalSearchParams<{ id: string; kind: Kind; slot?: string; index?: string }>();
  const id = Number(params.id);
  const kind = params.kind;
  const slot = params.slot !== undefined ? Number(params.slot) : undefined;
  const moveIndex = Number(params.index ?? 0);
  const db = useSQLiteContext();
  const team = useTeam(id);
  const { data } = useGameData(team?.versionGroupId);
  const member = slot !== undefined ? team?.members[slot] : undefined;
  const options = useMemberOptions(data, member ? [member.pokemonId] : []).get(member?.pokemonId ?? -1);

  const current =
    kind === 'pokemon'
      ? member?.pokemonId
      : kind === 'move'
        ? member?.moves[moveIndex]
        : kind === 'item'
          ? member?.itemId
          : member?.natureId;

  const all = useMemo(() => {
    if (!data) return null;
    switch (kind) {
      case 'pokemon':
        return pokemonOptions(data);
      case 'move':
        return options ? moveOptions(options.moves, { chosen: member?.moves, index: moveIndex }) : null;
      case 'item':
        return itemOptions(data);
      case 'nature':
        return natureOptions(data);
      default:
        return [];
    }
  }, [kind, data, options, member?.moves, moveIndex]);

  const choose = async (value: number | null) => {
    if (!team || !data) return;
    if (kind === 'pokemon' && value !== null) {
      await choosePokemon(team, data, slot, value);
      return;
    }
    if (slot === undefined || !member) return;
    if (kind === 'move') {
      // Picking a move that's already in another slot moves it here
      const moves = member.moves.map((m, i) => (i === moveIndex ? value : m === value ? null : m));
      updateMember(team, slot, { moves });
    } else if (kind === 'item') updateMember(team, slot, { itemId: value });
    else if (kind === 'nature') updateMember(team, slot, { natureId: value });
    router.back();
  };

  async function choosePokemon(team: Team, data: GameData, slot: number | undefined, pokemonId: number) {
    const o = await loadMemberOptions(db, data, pokemonId);
    const pokemon = data.pokemonById.get(pokemonId);
    const fresh = {
      pokemonId,
      abilityId: o.abilities[0]?.id ?? null,
      teraTypeId: data.rules.tera ? (pokemon?.typeIds[0] ?? null) : null,
      gigantamax: false,
    };
    if (slot === undefined) {
      if (team.members.length >= TEAM_SIZE) return;
      saveTeam({ ...team, members: [...team.members, newMember(pokemonId, fresh)] });
      router.replace({
        pathname: '/team/[id]/member/[slot]',
        params: { id: team.id, slot: team.members.length },
      });
    } else {
      // Keep what still fits the new Pokémon; moves it can't learn are dropped
      const old = team.members[slot];
      updateMember(team, slot, {
        ...fresh,
        nickname: null,
        moves: old.moves.map((m) => (m && o.moveById.has(m) ? m : null)),
      });
      router.back();
    }
  }

  return (
    <Picker
      title={TITLES[kind] ?? 'Choose'}
      options={all}
      current={current}
      onChoose={choose}
      searchable={kind !== 'nature'}
      placeholder={PLACEHOLDERS[kind]}
      gameName={data?.game.name}
      pokemonHint="Puts it on the team"
    />
  );
}
