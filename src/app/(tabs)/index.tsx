import { router } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DexRow } from '@/components/dex/dex-row';
import { GenerationSign } from '@/components/dex/generation-sign';
import { SearchBand } from '@/components/dex/search-band';
import { Notice } from '@/components/notice';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  type DexEntry,
  type DexGeneration,
  loadNationalDex,
  matchesQuery,
  queryWords,
} from '@/db/queries/national-dex';
import {
  loadPokedexes,
  loadRegionalDex,
  NATIONAL_DEX_ID,
  type PokedexOption,
} from '@/db/queries/pokedexes';
import { useSelectedDex } from '@/hooks/use-selected-dex';
import { useTheme } from '@/hooks/use-theme';

type Item =
  | { kind: 'generation'; key: string; generation: DexGeneration; matches?: number }
  | { kind: 'entry'; key: string; entry: DexEntry };

/** National Dex entries are split into generations; a regional dex is one run in its own order. */
type Dex = { id: number; entries: DexEntry[]; generations: DexGeneration[] | null };

/** Loaded dexes, so switching back and forth is instant. */
const loaded = new Map<number, Dex>();

async function loadDex(db: SQLiteDatabase, id: number): Promise<Dex> {
  const cached = loaded.get(id);
  if (cached) return cached;
  const dex: Dex =
    id === NATIONAL_DEX_ID
      ? { id, ...(await loadNationalDex(db)) }
      : { id, entries: await loadRegionalDex(db, id), generations: null };
  loaded.set(id, dex);
  return dex;
}

export default function DexScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const selectedId = useSelectedDex();
  const [options, setOptions] = useState<PokedexOption[]>([]);
  const [loadedDex, setDex] = useState<Dex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    loadPokedexes(db).then(setOptions, () => {});
  }, [db]);

  useEffect(() => {
    let live = true;
    loadDex(db, selectedId).then(
      (d) => live && setDex(d),
      (e: unknown) => live && setError(String(e))
    );
    return () => {
      live = false;
    };
  }, [db, selectedId]);

  // While another dex loads, show nothing rather than the old one under the new title
  const dex = loadedDex?.id === selectedId ? loadedDex : null;
  // An unknown id (a dex removed from the data) falls back to the National Dex's name
  const option = options.find((o) => o.id === selectedId);
  const regional = selectedId !== NATIONAL_DEX_ID;

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

    if (dex && !dex.generations) {
      for (const entry of dex.entries) {
        if (searching && !matchesQuery(entry, words)) continue;
        shown += 1;
        items.push({ kind: 'entry', key: `p-${entry.dexNumber}-${entry.number}`, entry });
      }
    }

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
        title={`${regional ? (option?.name ?? '') : 'National'} Dex`}
        games={regional ? option?.games : undefined}
        onPressTitle={() => router.push('/dex-picker')}
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
              <DexRow
                entry={item.entry}
                height={rowHeight}
                fontScale={fontScale}
                digits={regional ? 3 : 4}
              />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
