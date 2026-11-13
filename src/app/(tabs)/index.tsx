import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DexRow } from '@/components/dex/dex-row';
import { GenerationSign } from '@/components/dex/generation-sign';
import { SearchBand } from '@/components/dex/search-band';
import { BottomTabInset, Font, Spacing } from '@/constants/theme';
import {
  type DexEntry,
  type DexGeneration,
  loadNationalDex,
  matchesQuery,
  queryWords,
} from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'generation'; key: string; generation: DexGeneration; matches?: number }
  | { kind: 'entry'; key: string; entry: DexEntry };

type Dex = Awaited<ReturnType<typeof loadNationalDex>>;

export default function NationalDexScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [dex, setDex] = useState<Dex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    loadNationalDex(db).then(setDex, (e: unknown) => setError(String(e)));
  }, [db]);

  // Fixed heights keep scrolling and jumping cheap. They grow with the system font size:
  // a row holds the name (24) over the badges (16), and a sign holds one line (22).
  const scale = Math.max(1, fontScale);
  const rowHeight = Math.max(72, Math.ceil(40 * scale + 28));
  const signHeight = Math.max(44, Math.ceil(22 * scale + 22));

  const { items, stickyIndices, offsets, shown } = useMemo(() => {
    const words = queryWords(deferredQuery);
    const searching = words.length > 0;
    const items: Item[] = [];
    const stickyIndices: number[] = [];
    let shown = 0;

    for (const generation of dex?.generations ?? []) {
      const entries = (dex?.entries ?? []).filter(
        (e) => e.generationId === generation.id && (!searching || matchesQuery(e, words))
      );
      if (entries.length === 0) continue;
      shown += entries.length;
      stickyIndices.push(items.length);
      items.push({
        kind: 'generation',
        key: `gen-${generation.id}`,
        generation,
        matches: searching ? entries.length : undefined,
      });
      for (const entry of entries) items.push({ kind: 'entry', key: `p-${entry.number}`, entry });
    }

    const offsets: number[] = [];
    let y = 0;
    for (const item of items) {
      offsets.push(y);
      y += item.kind === 'generation' ? signHeight : rowHeight;
    }
    return { items, stickyIndices, offsets, shown };
  }, [dex, deferredQuery, rowHeight, signHeight]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <SearchBand
        query={query}
        onChangeQuery={setQuery}
        total={dex?.entries.length}
        shown={shown}
      />

      {!dex && !error ? null : error ? (
        <Notice
          icon={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }}
          title="The Pokédex data didn't load"
          body={`Rebuild it with npm run build-db, then restart the app. (${error})`}
        />
      ) : dex && items.length === 0 ? (
        <Notice
          icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
          title={`No Pokémon match “${query.trim()}”`}
          body="Try part of a name, a number like 25, or a type like fire. Combine them to narrow down, like “fire fly”."
        />
      ) : (
        <FlatList
          // Sticky headers crash on Android ("addViewAt: failed to insert view") when they shift
          // inside a mounted list or when views are clipped, so remount when the signs change
          // and keep clipping off.
          key={stickyIndices.join(',')}
          removeClippedSubviews={false}
          data={items}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'generation' ? (
              <GenerationSign
                generation={item.generation}
                height={signHeight}
                matches={item.matches}
              />
            ) : (
              <DexRow entry={item.entry} height={rowHeight} fontScale={fontScale} />
            )
          }
          getItemLayout={(_, index) => ({
            index,
            offset: offsets[index] ?? 0,
            length: items[index]?.kind === 'generation' ? signHeight : rowHeight,
          })}
          stickyHeaderIndices={stickyIndices}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          windowSize={11}
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
        />
      )}
    </View>
  );
}

type NoticeProps = {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  title: string;
  body: string;
};

function Notice({ icon, title, body }: NoticeProps) {
  const theme = useTheme();
  return (
    <View style={styles.notice}>
      <SymbolView name={icon} size={40} tintColor={theme.text} />
      <Text style={[styles.noticeTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  noticeTitle: {
    fontFamily: Font.bold,
    fontSize: 20,
    lineHeight: 26,
    marginTop: Spacing.two,
  },
  noticeBody: {
    fontFamily: Font.regular,
    fontSize: 16,
    lineHeight: 24,
  },
});
