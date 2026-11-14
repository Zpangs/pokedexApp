import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  item: { id: number; identifier: string; name: string; effect: string | null };
  /** Fixed height, for lists that use getItemLayout; the effect then keeps to two lines. */
  height?: number;
};

/** One item: bag icon, name and what it does. Opens its page. */
export const ItemRow = memo(function ItemRow({ item, height }: Props) {
  const theme = useTheme();
  const fixed = height !== undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.rule },
        fixed && { height },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.effect ? `. ${item.effect}` : ''}`}>
      <Image
        source={sprites.item(item.identifier)}
        style={styles.icon}
        contentFit="contain"
        recyclingKey={item.identifier}
        transition={0}
      />
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={fixed ? 1 : undefined}>
          {item.name}
        </Text>
        {item.effect ? (
          <Text
            style={[styles.effect, { color: theme.textSecondary }]}
            numberOfLines={fixed ? 2 : undefined}>
            {item.effect}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
  },
  text: {
    flex: 1,
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
