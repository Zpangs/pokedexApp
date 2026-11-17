import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignBand } from '@/components/sign-band';
import { Font, Spacing } from '@/constants/theme';
import { useSignTheme } from '@/hooks/use-dex-theme';

type Props = {
  /** "National Dex", "Paldea Dex"… Tapping it opens the Pokédex picker. */
  title: string;
  /** The games the dex belongs to, under the title. */
  games?: string;
  /** Without it, the title is plain text. */
  onPressTitle?: () => void;
  /** What's being counted, e.g. "Pokémon" or "moves". */
  noun?: string;
  placeholder?: string;
  searchLabel?: string;
  query: string;
  onChangeQuery: (query: string) => void;
  /** Undefined while the Dex is still loading. */
  total: number | undefined;
  shown: number;
  /** Filters narrow the list like a search does, so the count shows "12 of 1,025". */
  filtered?: boolean;
  /** Under the search field, e.g. filter chips. */
  children?: ReactNode;
};

/** The yellow sign band at the top: title, count and the search field. */
export function SearchBand({
  title,
  games,
  onPressTitle,
  noun = 'Pokémon',
  placeholder = 'Name, number or type',
  searchLabel = 'Search Pokémon by name, number or type',
  query,
  onChangeQuery,
  total,
  shown,
  filtered = false,
  children,
}: Props) {
  const theme = useSignTheme();
  const insets = useSafeAreaInsets();
  const searching = query.trim().length > 0;

  return (
    <SignBand colors={theme.gradient} style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.titleRow}>
        {onPressTitle ? (
          <Pressable
            onPress={onPressTitle}
            style={({ pressed }) => [styles.titleButton, pressed && { opacity: 0.6 }]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`${title}${games ? `, ${games}` : ''}`}
            accessibilityHint="Choose another Pokédex">
            <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
              {title}
            </Text>
            <SymbolView
              name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
              size={28}
              tintColor={theme.onSign}
            />
          </Pressable>
        ) : (
          <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
            {title}
          </Text>
        )}
        {total !== undefined && (
          <Text style={[styles.count, { color: theme.onSign }]} accessibilityLiveRegion="polite">
            {searching || filtered
              ? `${shown.toLocaleString()} of ${total.toLocaleString()}`
              : `${total.toLocaleString()} ${noun}`}
          </Text>
        )}
      </View>
      {games ? (
        <Text style={[styles.games, { color: theme.onSign }]} numberOfLines={2}>
          {games}
        </Text>
      ) : null}

      <View style={[styles.field, { backgroundColor: theme.field }]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={24}
          tintColor={theme.onPanel}
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.onPanelSecondary}
          selectionColor={theme.onPanelAccent}
          cursorColor={theme.onPanelAccent}
          style={[styles.input, { color: theme.onPanel }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={searchLabel}
        />
        {searching && (
          <Pressable
            onPress={() => onChangeQuery('')}
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={22}
              tintColor={theme.onPanel}
            />
          </Pressable>
        )}
      </View>
      {children}
    </SignBand>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.two,
    rowGap: Spacing.one,
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: Spacing.one,
    minHeight: 44,
  },
  title: {
    flexShrink: 1,
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  count: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  games: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    marginTop: -Spacing.one,
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
  clear: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
