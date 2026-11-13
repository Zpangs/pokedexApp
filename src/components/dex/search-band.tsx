import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  query: string;
  onChangeQuery: (query: string) => void;
  total: number;
  shown: number;
};

/** The yellow sign band at the top: title, count and the search field. */
export function SearchBand({ query, onChangeQuery, total, shown }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const searching = query.trim().length > 0;

  return (
    <View style={[styles.band, { backgroundColor: theme.sign, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.onSign }]} accessibilityRole="header">
          National Dex
        </Text>
        <Text style={[styles.count, { color: theme.onSign }]} accessibilityLiveRegion="polite">
          {searching
            ? `${shown.toLocaleString()} of ${total.toLocaleString()}`
            : `${total.toLocaleString()} Pokémon`}
        </Text>
      </View>

      <View style={[styles.field, { backgroundColor: theme.panel }]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={24}
          tintColor={theme.onPanel}
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search name, number or type"
          placeholderTextColor={theme.onPanelSecondary}
          selectionColor={theme.sign}
          cursorColor={theme.sign}
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
    </View>
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
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
