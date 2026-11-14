import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { type DexType, formatDexNumber } from '@/db/queries/national-dex';
import { sprites } from '@/db/sprites';
import { useTheme } from '@/hooks/use-theme';

export type PokemonRowData = {
  /** National Dex number. */
  number: number;
  /** The species' default form or a specific form. */
  pokemonId: number;
  name: string;
  types: DexType[];
};

type Props = {
  pokemon: PokemonRowData;
  /** Short text at the end of the row: a level ("Lv 36"), "Gen V"… */
  trailing?: string;
  /** Spoken after the name and types, e.g. "level 36". */
  trailingLabel?: string;
};

/** A Pokémon in a list: sprite, name, number and types. Opens its page (on that form). */
export const PokemonRow = memo(function PokemonRow({ pokemon, trailing, trailingLabel }: Props) {
  const theme = useTheme();
  const form = pokemon.pokemonId === pokemon.number ? undefined : String(pokemon.pokemonId);
  const spoken = trailingLabel ?? trailing;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/pokemon/[number]', params: { number: pokemon.number, form } })
      }
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.rule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="button"
      accessibilityLabel={`${pokemon.name}, ${pokemon.types.map((t) => t.name).join(' and ')} type${
        spoken ? `, ${spoken}` : ''
      }`}>
      <Image
        source={sprites.sprite(pokemon.pokemonId)}
        style={styles.sprite}
        contentFit="contain"
        recyclingKey={String(pokemon.pokemonId)}
        transition={0}
      />
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {pokemon.name}
          <Text style={[styles.number, { color: theme.textSecondary }]}>
            {'  '}
            {formatDexNumber(pokemon.number)}
          </Text>
        </Text>
        <View style={styles.badges}>
          {pokemon.types.map((t) => (
            <TypeBadge key={t.identifier} identifier={t.identifier} name={t.name} />
          ))}
        </View>
      </View>
      {trailing ? <Text style={[styles.trailing, { color: theme.text }]}>{trailing}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sprite: {
    width: 48,
    height: 48,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  number: {
    fontFamily: Font.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  trailing: {
    fontFamily: Font.extraBold,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
});
