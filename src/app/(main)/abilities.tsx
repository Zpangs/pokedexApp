import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AbilityRow } from '@/components/abilities/ability-row';
import { SearchBand } from '@/components/dex/search-band';
import { Notice } from '@/components/notice';
import { MenuButtonInset, Font, Spacing } from '@/constants/theme';
import { type AbilitySummary, loadAbilities, matchesAbilityQuery } from '@/db/queries/abilities';
import { queryWords } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'letter'; key: string; letter: string; count: number }
  | { kind: 'ability'; key: string; ability: AbilitySummary };

/** Every ability A to Z, searchable by name and by what it does. */
export default function AbilitiesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [abilities, setAbilities] = useState<AbilitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    loadAbilities(db).then(setAbilities, (e: unknown) => setError(String(e)));
  }, [db]);

  // Fixed heights keep scrolling and jumping cheap; they grow with the system font size.
  // A row holds the name (24) over two lines of effect (20 each); a sign holds one line (22).
  const scale = Math.max(1, fontScale);
  const rowHeight = Math.max(84, Math.ceil(66 * scale + 18));
  const signHeight = Math.max(44, Math.ceil(22 * scale + 22));

  const { items, stickyIndices, offsets, shown } = useMemo(() => {
    const words = queryWords(deferredQuery);
    const matches = (abilities ?? []).filter(
      (a) => words.length === 0 || matchesAbilityQuery(a, words)
    );

    // Letter signs, like the generation signs on the Dex tab
    const byLetter = new Map<string, AbilitySummary[]>();
    for (const ability of matches) {
      const first = ability.searchName[0]?.toUpperCase() ?? '#';
      const letter = /[A-Z]/.test(first) ? first : '#';
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), ability]);
    }

    const items: Item[] = [];
    const stickyIndices: number[] = [];
    for (const [letter, list] of byLetter) {
      stickyIndices.push(items.length);
      items.push({ kind: 'letter', key: `l-${letter}`, letter, count: list.length });
      for (const ability of list) items.push({ kind: 'ability', key: `a-${ability.id}`, ability });
    }

    const offsets: number[] = [];
    let y = 0;
    for (const item of items) {
      offsets.push(y);
      y += item.kind === 'letter' ? signHeight : rowHeight;
    }
    return { items, stickyIndices, offsets, shown: matches.length };
  }, [abilities, deferredQuery, rowHeight, signHeight]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SearchBand
        title="Abilities"
        noun="abilities"
        placeholder="Name or effect"
        searchLabel="Search abilities by name or effect"
        query={query}
        onChangeQuery={setQuery}
        total={abilities?.length}
        shown={shown}
      />

      {!abilities && !error ? null : error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The ability data didn't load"
          body={`Rebuild it with npm run build-db, then restart the app. (${error})`}
        />
      ) : items.length === 0 ? (
        <Notice
          icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
          title={`No abilities match “${query.trim()}”`}
          body="Try part of a name, or a word from what it does, like sleep or weather. Combine words to narrow down, like “rain speed”."
        />
      ) : (
        <FlatList
          // Sticky headers must not shift inside a mounted list on Android (see the Dex tab)
          key={stickyIndices.join(',')}
          removeClippedSubviews={false}
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'letter' ? (
              <View
                style={[styles.sign, { height: signHeight, backgroundColor: theme.panel }]}
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${item.letter}, ${item.count} ${item.count === 1 ? 'ability' : 'abilities'}`}>
                <Text style={[styles.letter, { color: theme.onPanelAccent }]}>{item.letter}</Text>
                <Text style={[styles.count, { color: theme.onPanelSecondary }]}>{item.count}</Text>
              </View>
            ) : (
              <AbilityRow ability={item.ability} height={rowHeight} />
            )
          }
          getItemLayout={(_, index) => ({
            index,
            offset: offsets[index] ?? 0,
            length: items[index]?.kind === 'letter' ? signHeight : rowHeight,
          })}
          stickyHeaderIndices={stickyIndices}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={16}
          windowSize={11}
          contentContainerStyle={{ paddingBottom: MenuButtonInset + Spacing.three }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  sign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  letter: {
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
  },
  count: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
