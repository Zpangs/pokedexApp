import { Image } from 'expo-image';
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
  normalize,
  type TeamAbility,
  type TeamMove,
  type TeamPokemon,
} from '@/db/queries/team-builder';
import type { BattleType } from '@/db/queries/types';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

export type PickerOption = {
  key: string;
  /** null clears the choice ("No item"). */
  value: number | null;
  search: string;
  /** Pokémon get a full Pokémon row; everything else draws its own content. */
  pokemon?: TeamPokemon;
  render: () => ReactNode;
};

/**
 * A full-screen list to choose one thing from, with a search field. Only what exists in the
 * game is ever passed in; the current choice gets a check mark.
 */
export function Picker({
  title,
  options,
  current,
  onChoose,
  searchable = true,
  placeholder = 'Name',
  gameName,
  pokemonHint,
}: {
  title: string;
  options: PickerOption[] | null;
  current: number | null | undefined;
  onChoose: (value: number | null) => void;
  searchable?: boolean;
  placeholder?: string;
  gameName?: string;
  pokemonHint?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const shown = useMemo(() => {
    const words = queryWords(deferred);
    if (!options || words.length === 0) return options;
    return options.filter((o) => o.value !== null && words.every((w) => o.search.includes(w)));
  }, [options, deferred]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title={title} showTitle />
      {searchable ? (
        <SignBand style={styles.band}>
          <View style={[styles.field, { backgroundColor: theme.field }]}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={theme.onPanel} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
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
          body={`Only what exists in ${gameName ?? 'this game'} is listed.`}
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
                onPress={() => onChoose(item.value)}
                trailing={item.value === current ? 'Current' : undefined}
                accessibilityHint={pokemonHint}
              />
            ) : (
              <Pressable
                onPress={() => onChoose(item.value)}
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

// ── Option lists ──────────────────────────────────────────────────────────────────────────

export function pokemonOptions(data: GameData): PickerOption[] {
  return data.pokemon.map((p) => ({
    key: String(p.pokemonId),
    value: p.pokemonId,
    search: `${p.searchName} ${p.number} ${normalize(p.types.map((t) => t.name).join(' '))}`,
    pokemon: p,
    render: () => null,
  }));
}

export function moveOptions(
  moves: TeamMove[],
  { chosen = [], index = 0, damagingOnly = false }: { chosen?: (number | null)[]; index?: number; damagingOnly?: boolean } = {}
): PickerOption[] {
  return [
    ...(damagingOnly ? [] : [{ key: 'none', value: null, search: '', render: () => <PlainOption label="No move" /> }]),
    ...moves
      .filter((m) => !damagingOnly || m.category !== 'Status')
      .map((m) => ({
        key: String(m.id),
        value: m.id,
        search: `${m.searchName} ${normalize(m.type.name)} ${m.category.toLowerCase()}`,
        render: () => <MoveOption move={m} elsewhere={chosen.some((c, i) => c === m.id && i !== index)} />,
      })),
  ];
}

export function itemOptions(data: GameData): PickerOption[] {
  return [
    { key: 'none', value: null, search: '', render: () => <PlainOption label="No item" /> },
    ...data.items.map((i) => ({
      key: String(i.id),
      value: i.id,
      search: `${normalize(i.name)} ${normalize(i.effect ?? '')}`,
      render: () => <ItemOption name={i.name} identifier={i.identifier} effect={i.effect} />,
    })),
  ];
}

export function natureOptions(data: GameData): PickerOption[] {
  return [
    { key: 'none', value: null, search: '', render: () => <PlainOption label="Not set" /> },
    ...data.natures.map((n) => ({
      key: String(n.id),
      value: n.id,
      search: normalize(n.name),
      render: () => <OptionText title={n.name} detail={n.raises ? `+${n.raises}  −${n.lowers}` : 'No stat change'} />,
    })),
  ];
}

export function abilityOptions(abilities: TeamAbility[]): PickerOption[] {
  return abilities.map((a) => ({
    key: String(a.id),
    value: a.id,
    search: normalize(a.name),
    render: () => <OptionText title={a.isHidden ? `${a.name} (Hidden)` : a.name} detail={a.effect} />,
  }));
}

export function typeOptions(types: BattleType[]): PickerOption[] {
  return types.map((t) => ({
    key: String(t.id),
    value: t.id,
    search: normalize(t.name),
    render: () => <TypeBadge identifier={t.identifier} name={t.name} />,
  }));
}

// ── Option rows ───────────────────────────────────────────────────────────────────────────

export function PlainOption({ label }: { label: string }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.textSecondary }]}>{label}</Text>;
}

export function OptionText({ title, detail }: { title: string; detail?: string | null }) {
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
