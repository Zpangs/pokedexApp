import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The fixed yellow bar above a Pokémon's page: Back, plus the Pokémon's number and name once
 * the identity band has scrolled away, so you always know whose page you're on.
 */
export function AppBar({ title, showTitle }: { title: string; showTitle: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: theme.sign, paddingTop: insets.top }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={24}
          tintColor={theme.onSign}
        />
      </Pressable>
      <Text
        style={[styles.title, { color: theme.onSign, opacity: showTitle ? 1 : 0 }]}
        numberOfLines={1}
        importantForAccessibility={showTitle ? 'auto' : 'no-hide-descendants'}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.three,
  },
  back: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: Font.extraBold,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
});
