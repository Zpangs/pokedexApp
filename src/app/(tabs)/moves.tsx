import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SearchBand } from '@/components/dex/search-band';
import { Notice } from '@/components/notice';
import { MoveRow } from '@/components/moves/move-row';
import { BottomTabInset, Font, Spacing } from '@/constants/theme';
import { loadMoves, matchesMoveQuery, type MoveSummary } from '@/db/queries/moves';
import { queryWords } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'letter'; key: string; letter: string; count: number }
  | { kind: 'move'; key: string; move: MoveSummary };

/** Every move A to Z, searchable by name, type and category. */
export default function MovesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [moves, setMoves] = useState<MoveSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    loadMoves(db).then(setMoves, (e: unknown) => setError(String(e)));
  }, [db]);

  // Fixed heights keep scrolling and jumping cheap; they grow with the system font size.
  // A row holds the name (24) over the facts (18); a sign holds one line (22).
  const scale = Math.max(1, fontScale);
  const rowHeight = Math.max(64, Math.ceil(42 * scale + 22));
  const signHeight = Math.max(44, Math.ceil(22 * scale + 22));

  const { items, stickyIndices, offsets, shown } = useMemo(() => {
    const words = queryWords(deferredQuery);
    const matches = (moves ?? []).filter((m) => words.length === 0 || matchesMoveQuery(m, words));

    // Letter signs, like the generation signs on the Dex tab
    const byLetter = new Map<string, MoveSummary[]>();
    for (const move of matches) {
      const first = move.searchName[0]?.toUpperCase() ?? '#';
      const letter = /[A-Z]/.test(first) ? first : '#';
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), move]);
    }

    const items: Item[] = [];
    const stickyIndices: number[] = [];
    for (const [letter, list] of byLetter) {
      stickyIndices.push(items.length);
      items.push({ kind: 'letter', key: `l-${letter}`, letter, count: list.length });
      for (const move of list) items.push({ kind: 'move', key: `m-${move.id}`, move });
    }

    const offsets: number[] = [];
    let y = 0;
    for (const item of items) {
      offsets.push(y);
      y += item.kind === 'letter' ? signHeight : rowHeight;
    }
    return { items, stickyIndices, offsets, shown: matches.length };
  }, [moves, deferredQuery, rowHeight, signHeight]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SearchBand
        title="Moves"
        noun="moves"
        placeholder="Name, type or category"
        searchLabel="Search moves by name, type or category"
        query={query}
        onChangeQuery={setQuery}
        total={moves?.length}
        shown={shown}
      />

      {!moves && !error ? null : error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The move data didn't load"
          body={`Rebuild it with npm run build-db, then restart the app. (${error})`}
        />
      ) : items.length === 0 ? (
        <Notice
          icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
          title={`No moves match “${query.trim()}”`}
          body="Try part of a name, a type like fire, or a category like special. Combine them to narrow down, like “fire special”."
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
                accessibilityLabel={`${item.letter}, ${item.count} moves`}>
                <Text style={[styles.letter, { color: theme.onPanelAccent }]}>{item.letter}</Text>
                <Text style={[styles.count, { color: theme.onPanelSecondary }]}>{item.count}</Text>
              </View>
            ) : (
              <MoveRow move={item.move} height={rowHeight} />
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
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
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
