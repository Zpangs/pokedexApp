import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import type { CalcPickKind } from '@/components/calc/side-editor';
import { GameList } from '@/components/teams/game-list';
import {
  abilityOptions,
  itemOptions,
  moveOptions,
  natureOptions,
  OptionText,
  Picker,
  type PickerOption,
  pokemonOptions,
  typeOptions,
} from '@/components/teams/picker';
import { Spacing } from '@/constants/theme';
import {
  type CalcRole,
  getCalc,
  loadIntoCalc,
  newSide,
  setCalcGame,
  setSide,
  sideFromMember,
  updateSide,
  useCalc,
} from '@/db/calc-state';
import { loadMemberOptions, normalize } from '@/db/queries/team-builder';
import { sprites } from '@/db/sprites';
import { useTeams } from '@/db/teams';
import { useGameData, useMemberOptions, useTeamGames } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

const TITLES: Record<CalcPickKind, string> = {
  game: 'Choose a game',
  pokemon: 'Choose a Pokémon',
  move: 'Choose a move',
  item: 'Choose an item',
  nature: 'Choose a nature',
  ability: 'Choose an ability',
  tera: 'Choose a Tera type',
  member: 'Choose from a team',
};

const PLACEHOLDERS: Partial<Record<CalcPickKind, string>> = {
  pokemon: 'Name, number or type',
  move: 'Name, type or category',
  item: 'Name or effect',
  member: 'Pokémon or team',
};

/** Chooses one thing for the damage calculator's attacker or defender. */
export default function CalcPickScreen() {
  const params = useLocalSearchParams<{ kind: CalcPickKind; role?: CalcRole }>();
  const kind = params.kind;
  const role: CalcRole = params.role === 'defender' ? 'defender' : 'attacker';
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const state = useCalc();
  const { games } = useTeamGames();
  const { data } = useGameData(state.versionGroupId ?? undefined);
  const teams = useTeams();
  const side = state[role];
  const options = useMemberOptions(data, side ? [side.pokemonId] : []).get(side?.pokemonId ?? -1);

  // Team members, the current game's teams first
  const members = useMemo(
    () =>
      [...teams]
        .sort((a, b) => Number(b.versionGroupId === state.versionGroupId) - Number(a.versionGroupId === state.versionGroupId))
        .flatMap((team) => team.members.map((member) => ({ team, member }))),
    [teams, state.versionGroupId]
  );

  const names = usePokemonNames(kind === 'member' ? members.map((m) => m.member.pokemonId) : []);

  const all = useMemo((): PickerOption[] | null => {
    if (kind === 'member') {
      if (!names) return null;
      return members.map(({ team, member }, i) => {
        const game = games?.find((g) => g.versionGroupId === team.versionGroupId)?.name ?? '';
        const name = names.get(member.pokemonId) ?? 'Pokémon';
        return {
          key: `${team.id}:${i}`,
          value: i,
          search: normalize(`${name} ${member.nickname ?? ''} ${team.name}`),
          render: () => (
            <View style={styles.member}>
              <Image source={sprites.sprite(member.pokemonId)} style={styles.sprite} contentFit="contain" transition={0} />
              <OptionText
                title={member.nickname ?? name}
                detail={`${member.nickname ? `${name} · ` : ''}${team.name} · ${game}`}
              />
            </View>
          ),
        };
      });
    }
    if (!data) return null;
    switch (kind) {
      case 'pokemon':
        return pokemonOptions(data);
      case 'move':
        return options ? moveOptions(options.moves, { damagingOnly: true }) : null;
      case 'item':
        return itemOptions(data);
      case 'nature':
        return natureOptions(data);
      case 'ability':
        return options ? abilityOptions(options.abilities) : null;
      case 'tera':
        return typeOptions(data.teraTypes);
      default:
        return [];
    }
  }, [kind, data, options, members, games, names]);

  if (kind === 'game') {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <AppBar title={TITLES.game} showTitle />
        {games ? (
          <GameList
            games={games}
            bottomInset={insets.bottom + Spacing.three}
            onPick={(g) => {
              setCalcGame(g.versionGroupId);
              router.back();
            }}
          />
        ) : null}
      </View>
    );
  }

  const current =
    kind === 'pokemon'
      ? side?.pokemonId
      : kind === 'move'
        ? side?.moveId
        : kind === 'item'
          ? side?.itemId
          : kind === 'nature'
            ? side?.natureId
            : kind === 'ability'
              ? side?.abilityId
              : kind === 'tera'
                ? side?.teraTypeId
                : undefined;

  const choose = async (value: number | null) => {
    switch (kind) {
      case 'member': {
        if (value === null) break;
        const { team, member } = members[value];
        loadIntoCalc(team.versionGroupId, role, sideFromMember(member, `From ${team.name}`));
        break;
      }
      case 'pokemon': {
        if (value === null || !data) break;
        const o = await loadMemberOptions(db, data, value);
        const pokemon = data.pokemonById.get(value);
        const calc = getCalc();
        const old = calc[role];
        const other = calc[role === 'attacker' ? 'defender' : 'attacker'];
        // Keep the spread and field state; anything tied to the old Pokémon starts over
        setSide(
          role,
          newSide(value, {
            // A first Pokémon on this side starts at the other side's level
            ...(old
              ? { level: old.level, evs: old.evs, ivs: old.ivs, natureId: old.natureId, boosts: old.boosts }
              : other
                ? { level: other.level }
                : {}),
            abilityId: o.abilities[0]?.id ?? null,
            teraTypeId: data.rules.tera ? (pokemon?.typeIds[0] ?? null) : null,
            moveId: old?.moveId && o.moveById.has(old.moveId) ? old.moveId : null,
          })
        );
        break;
      }
      case 'move':
        updateSide(role, { moveId: value });
        break;
      case 'item':
        updateSide(role, { itemId: value });
        break;
      case 'nature':
        updateSide(role, { natureId: value });
        break;
      case 'ability':
        updateSide(role, { abilityId: value });
        break;
      case 'tera':
        updateSide(role, { teraTypeId: value, terastallized: value !== null });
        break;
    }
    router.back();
  };

  return (
    <Picker
      title={TITLES[kind] ?? 'Choose'}
      options={all}
      current={current}
      onChoose={choose}
      searchable={kind !== 'nature' && kind !== 'ability'}
      placeholder={PLACEHOLDERS[kind]}
      gameName={data?.game.name}
      pokemonHint={`Makes it the ${role}`}
    />
  );
}

/** Names of Pokémon from any game (teams can be from games other than the calculator's). */
function usePokemonNames(ids: number[]) {
  const db = useSQLiteContext();
  const [names, setNames] = useState<Map<number, string> | null>(null);
  const key = [...new Set(ids)].sort((a, b) => a - b).join(',');
  useEffect(() => {
    let live = true;
    const list = key ? key.split(',').map(Number) : [];
    db.getAllAsync<{ id: number; name: string }>(
      `SELECT p.id, COALESCE((SELECT fn.pokemon_name FROM pokemon_forms f
                              JOIN pokemon_form_names fn ON fn.pokemon_form_id = f.id
                              WHERE f.pokemon_id = p.id), sn.name) AS name
       FROM pokemon p JOIN pokemon_species_names sn ON sn.pokemon_species_id = p.species_id
       WHERE p.id IN (${list.map(() => '?').join(',') || 'NULL'})`,
      ...list
    ).then((rows) => live && setNames(new Map(rows.map((r) => [r.id, r.name]))));
    return () => {
      live = false;
    };
  }, [db, key]);
  return names;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sprite: {
    width: 48,
    height: 48,
  },
});
