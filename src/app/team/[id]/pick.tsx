import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { AppBar } from '@/components/pokemon/app-bar';
import { PokemonRow } from '@/components/pokemon/pokemon-row';
import { SignBand } from '@/components/sign-band';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { queryWords } from '@/db/queries/national-dex';
import {
  type GameData,
  loadMemberOptions,
  normalize,
  type TeamMove,
  type TeamPokemon,
} from '@/db/queries/team-builder';
import { sprites } from '@/db/sprites';
import { newMember, saveTeam, type Team, TEAM_SIZE, updateMember, useTeam } from '@/db/teams';
import { useGameData, useMemberOptions } from '@/hooks/use-team-data';
import { useTheme } from '@/hooks/use-theme';

type Kind = 'pokemon' | 'move' | 'item' | 'nature';

type Option = {
  key: string;
  /** null clears the choice ("No item"). */
  value: number | null;
  search: string;
  /** Pokémon get a full Pokémon row; everything else draws its own content. */
  pokemon?: TeamPokemon;
  render: () => ReactNode;
};

const TITLES: Record<Kind, string> = {
  pokemon: 'Choose a Pokémon',
  move: 'Choose a move',
  item: 'Choose an item',
  nature: 'Choose a nature',
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
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const team = useTeam(id);
  const { data } = useGameData(team?.versionGroupId);
  const member = slot !== undefined ? team?.members[slot] : undefined;
  const options = useMemberOptions(data, member ? [member.pokemonId] : []).get(member?.pokemonId ?? -1);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const current =
    kind === 'pokemon'
      ? member?.pokemonId
      : kind === 'move'
        ? member?.moves[moveIndex]
        : kind === 'item'
          ? member?.itemId
          : member?.natureId;

  const all = useMemo(
    () => (data ? buildOptions(kind, data, options?.moves ?? null, member?.moves ?? [], moveIndex) : null),
    [kind, data, options, member?.moves, moveIndex]
  );
  const shown = useMemo(() => {
    const words = queryWords(deferred);
    if (!all || words.length === 0) return all;
    return all.filter((o) => o.value !== null && words.every((w) => o.search.includes(w)));
  }, [all, deferred]);

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

  const searchable = kind !== 'nature';
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={TITLES[kind] ?? 'Choose'} showTitle />
      {searchable ? (
        <SignBand style={styles.band}>
          <View style={[styles.field, { backgroundColor: theme.field }]}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={theme.onPanel} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={kind === 'pokemon' ? 'Name, number or type' : kind === 'move' ? 'Name, type or category' : 'Name or effect'}
              placeholderTextColor={theme.onPanelSecondary}
              selectionColor={theme.onPanelAccent}
              cursorColor={theme.onPanelAccent}
              style={[styles.input, { color: theme.onPanel }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search"
            />
          </View>
        </SignBand>
      ) : null}
      {!shown ? null : shown.length === 0 ? (
        <Notice
          icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
          title="Nothing matches"
          body={`Only what exists in ${data?.game.name ?? 'this game'} is listed.`}
        />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(o) => o.key}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.three }}
          renderItem={({ item }) =>
            item.pokemon ? (
              <PokemonRow
                pokemon={item.pokemon}
                onPress={() => choose(item.value)}
                trailing={item.value === current ? 'Current' : undefined}
                accessibilityHint="Puts it on the team"
              />
            ) : (
              <Pressable
                onPress={() => choose(item.value)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.rule },
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === (current ?? null) }}>
                <View style={styles.rowBody}>{item.render()}</View>
                {item.value === (current ?? null) ? (
                  <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={24} tintColor={theme.text} />
                ) : null}
              </Pressable>
            )
          }
        />
      )}
    </View>
  );
}

function buildOptions(
  kind: Kind,
  data: GameData,
  moves: TeamMove[] | null,
  chosenMoves: (number | null)[],
  moveIndex: number
): Option[] | null {
  switch (kind) {
    case 'pokemon':
      return data.pokemon.map((p) => ({
        key: String(p.pokemonId),
        value: p.pokemonId,
        search: `${p.searchName} ${p.number} ${normalize(p.types.map((t) => t.name).join(' '))}`,
        pokemon: p,
        render: () => null,
      }));
    case 'move':
      if (!moves) return null;
      return [
        { key: 'none', value: null, search: '', render: () => <PlainOption label="No move" /> },
        ...moves.map((m) => ({
          key: String(m.id),
          value: m.id,
          search: `${m.searchName} ${normalize(m.type.name)} ${m.category.toLowerCase()}`,
          render: () => (
            <MoveOption move={m} elsewhere={chosenMoves.some((c, i) => c === m.id && i !== moveIndex)} />
          ),
        })),
      ];
    case 'item':
      return [
        { key: 'none', value: null, search: '', render: () => <PlainOption label="No item" /> },
        ...data.items.map((i) => ({
          key: String(i.id),
          value: i.id,
          search: `${normalize(i.name)} ${normalize(i.effect ?? '')}`,
          render: () => <ItemOption name={i.name} identifier={i.identifier} effect={i.effect} />,
        })),
      ];
    case 'nature':
      return [
        { key: 'none', value: null, search: '', render: () => <PlainOption label="Not set" /> },
        ...data.natures.map((n) => ({
          key: String(n.id),
          value: n.id,
          search: normalize(n.name),
          render: () => (
            <OptionText
              title={n.name}
              detail={n.raises ? `+${n.raises}  −${n.lowers}` : 'No stat change'}
            />
          ),
        })),
      ];
    default:
      return [];
  }
}

function PlainOption({ label }: { label: string }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.textSecondary }]}>{label}</Text>;
}

function OptionText({ title, detail }: { title: string; detail?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.optionText}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {detail ? <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

function MoveOption({ move, elsewhere }: { move: TeamMove; elsewhere: boolean }) {
  const facts = [
    move.category,
    move.power ? `${move.power} power` : null,
    move.accuracy ? `${move.accuracy}%` : null,
    move.pp ? `${move.pp} PP` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.optionRow}>
      <OptionText title={move.name} detail={elsewhere ? `${facts} · Already chosen` : facts} />
      <TypeBadge identifier={move.type.identifier} name={move.type.name} />
    </View>
  );
}

function ItemOption({ name, identifier, effect }: { name: string; identifier: string; effect: string | null }) {
  return (
    <View style={styles.optionRow}>
      <Image source={sprites.item(identifier)} style={styles.icon} contentFit="contain" transition={0} />
      <OptionText title={name} detail={effect} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: Font.medium,
    fontSize: 17,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  optionText: {
    flex: 1,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  detail: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  icon: {
    width: 32,
    height: 32,
  },
});
