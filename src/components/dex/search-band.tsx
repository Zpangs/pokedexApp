import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignBand } from '@/components/sign-band';
import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** "National Dex", "Paldea Dex"… Tapping it opens the Pokédex picker. */
  title: string;
  /** The games the dex belongs to, under the title. */
  games?: string;
  onPressTitle: () => void;
  query: string;
  onChangeQuery: (query: string) => void;
  /** Undefined while the Dex is still loading. */
  total: number | undefined;
  shown: number;
};

/** The yellow sign band at the top: title, count and the search field. */
export function SearchBand({ title, games, onPressTitle, query, onChangeQuery, total, shown }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const searching = query.trim().length > 0;

  return (
    <SignBand style={[styles.band, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.titleRow}>
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
        {total !== undefined && (
          <Text style={[styles.count, { color: theme.onSign }]} accessibilityLiveRegion="polite">
            {searching
              ? `${shown.toLocaleString()} of ${total.toLocaleString()}`
              : `${total.toLocaleString()} Pokémon`}
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
          placeholder="Name, number or type"
          placeholderTextColor={theme.onPanelSecondary}
          selectionColor={theme.onPanelAccent}
          cursorColor={theme.onPanelAccent}
          style={[styles.input, { color: theme.onPanel }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search Pokémon by name, number or type"
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
