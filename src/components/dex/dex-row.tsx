import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CaughtButton } from '@/components/dex/caught-button';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { type DexEntry, formatDexNumber } from '@/db/queries/national-dex';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

/** The dex number is already display size, so it stops growing before the name does. */
const NUMBER_MAX_SCALE = 1.3;

type Props = {
  entry: DexEntry;
  height: number;
  fontScale: number;
  /** 4 for National numbers, 3 for regional ones. */
  digits?: number;
  caught: boolean;
  /** Called with the species (National Dex number). Stable, so rows stay memoized. */
  onToggleCaught: (speciesId: number) => void;
};

/** One Pokémon: big dex number, sprite, then the name over its type badges. Opens its page. */
export const DexRow = memo(function DexRow({
  entry,
  height,
  fontScale,
  digits = 4,
  caught,
  onToggleCaught,
}: Props) {
  const theme = useTheme();
  const types = entry.types.map((t) => t.name).join(' and ');
  // A regional form (Alolan Raichu) opens on that form; default forms share the species id
  const form = entry.pokemonId === entry.number ? undefined : String(entry.pokemonId);

  return (
    // Not <Link asChild>: it drops a style function, and the row loses its layout
    <Pressable
      onPress={() =>
        router.push({ pathname: '/pokemon/[number]', params: { number: entry.number, form } })
      }
      style={({ pressed }) => [
        styles.row,
        { height, borderBottomColor: theme.rowRule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="button"
      accessibilityLabel={`Number ${entry.dexNumber}, ${entry.name}, ${types} type${caught ? ', caught' : ''}`}>
      <Text
        style={[
          styles.number,
          {
            color: theme.text,
            minWidth: 18 * digits * Math.min(Math.max(fontScale, 1), NUMBER_MAX_SCALE),
          },
        ]}
        maxFontSizeMultiplier={NUMBER_MAX_SCALE}
        numberOfLines={1}>
        {formatDexNumber(entry.dexNumber, digits)}
      </Text>
      <Image
        source={sprites.sprite(entry.pokemonId)}
        style={styles.sprite}
        contentFit="contain"
        recyclingKey={String(entry.pokemonId)}
        transition={0}
      />
      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {entry.name}
        </Text>
        <View style={styles.badges}>
          {entry.types.map((t) => (
            <TypeBadge key={t.identifier} identifier={t.identifier} name={t.name} />
          ))}
        </View>
      </View>
      <CaughtButton
        caught={caught}
        name={entry.name}
        onToggle={() => onToggleCaught(entry.number)}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    borderBottomWidth: 2,
  },
  number: {
    fontFamily: Font.extraBold,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  sprite: {
    width: 56,
    height: 56,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  badges: {
    flexDirection: 'row',
    flexShrink: 1,
    gap: Spacing.one,
  },
});
