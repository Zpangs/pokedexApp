import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { SearchBand } from '@/components/dex/search-band';
import { ItemRow } from '@/components/items/item-row';
import { Notice } from '@/components/notice';
import { BottomTabInset, Font, Spacing } from '@/constants/theme';
import { type ItemSummary, loadItems, matchesItemQuery } from '@/db/queries/items';
import { queryWords } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Row =
  | { kind: 'pocket'; key: string; pocket: string; count: number }
  | { kind: 'item'; key: string; item: ItemSummary };

/** Every item by bag pocket, searchable by name, category and what it does. */
export default function ItemsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    loadItems(db).then(setItems, (e: unknown) => setError(String(e)));
  }, [db]);

  // Fixed heights keep scrolling and jumping cheap; they grow with the system font size.
  // A row holds the name (24) over two lines of effect (20 each); a sign holds one line (22).
  const scale = Math.max(1, fontScale);
  const rowHeight = Math.max(84, Math.ceil(66 * scale + 18));
  const signHeight = Math.max(44, Math.ceil(22 * scale + 22));

  const { rows, stickyIndices, offsets, shown } = useMemo(() => {
    const words = queryWords(deferredQuery);
    const matches = (items ?? []).filter((i) => words.length === 0 || matchesItemQuery(i, words));

    // Pocket signs, like the bag in the games (items arrive sorted by pocket)
    const rows: Row[] = [];
    const stickyIndices: number[] = [];
    let sign = null as Extract<Row, { kind: 'pocket' }> | null;
    for (const item of matches) {
      if (sign?.pocket !== item.pocket) {
        stickyIndices.push(rows.length);
        sign = { kind: 'pocket', key: `p-${item.pocket}`, pocket: item.pocket, count: 0 };
        rows.push(sign);
      }
      sign.count++;
      rows.push({ kind: 'item', key: `i-${item.id}`, item });
    }

    const offsets: number[] = [];
    let y = 0;
    for (const row of rows) {
      offsets.push(y);
      y += row.kind === 'pocket' ? signHeight : rowHeight;
    }
    return { rows, stickyIndices, offsets, shown: matches.length };
  }, [items, deferredQuery, rowHeight, signHeight]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SearchBand
        title="Items"
        noun="items"
        placeholder="Name, kind or effect"
        searchLabel="Search items by name, kind or effect"
        query={query}
        onChangeQuery={setQuery}
        total={items?.length}
        shown={shown}
      />

      {!items && !error ? null : error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The item data didn't load"
          body={`Rebuild it with npm run build-db, then restart the app. (${error})`}
        />
      ) : rows.length === 0 ? (
        <Notice
          icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
          title={`No items match “${query.trim()}”`}
          body="Try part of a name, a kind like berry or evolution, or a word from what it does, like paralysis. Combine words to narrow down, like “berry hp”."
        />
      ) : (
        <FlatList
          // Sticky headers must not shift inside a mounted list on Android (see the Dex tab)
          key={stickyIndices.join(',')}
          removeClippedSubviews={false}
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'pocket' ? (
              <View
                style={[styles.sign, { height: signHeight, backgroundColor: theme.panel }]}
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${item.pocket}, ${item.count} ${item.count === 1 ? 'item' : 'items'}`}>
                <Text style={[styles.pocket, { color: theme.onPanelAccent }]}>{item.pocket}</Text>
                <Text style={[styles.count, { color: theme.onPanelSecondary }]}>{item.count}</Text>
              </View>
            ) : (
              <ItemRow item={item.item} height={rowHeight} />
            )
          }
          getItemLayout={(_, index) => ({
            index,
            offset: offsets[index] ?? 0,
            length: rows[index]?.kind === 'pocket' ? signHeight : rowHeight,
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
  pocket: {
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
