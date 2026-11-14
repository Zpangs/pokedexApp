import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  ability: { id: number; name: string; effect: string | null };
  /** Fixed height, for lists that use getItemLayout; the effect then keeps to two lines. */
  height?: number;
};

/** One ability: its name over what it does. Opens its page. */
export const AbilityRow = memo(function AbilityRow({ ability, height }: Props) {
  const theme = useTheme();
  const fixed = height !== undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/ability/[id]', params: { id: ability.id } })}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.rule },
        fixed && { height },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="button"
      accessibilityLabel={`${ability.name}${ability.effect ? `. ${ability.effect}` : ''}`}>
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={fixed ? 1 : undefined}>
          {ability.name}
        </Text>
        {ability.effect ? (
          <Text
            style={[styles.effect, { color: theme.textSecondary }]}
            numberOfLines={fixed ? 2 : undefined}>
            {ability.effect}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    gap: Spacing.half,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  effect: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
