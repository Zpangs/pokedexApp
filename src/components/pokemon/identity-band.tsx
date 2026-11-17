import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SignBand } from '@/components/sign-band';
import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import { formatDexNumber } from '@/db/queries/national-dex';
import type { DexType } from '@/db/queries/national-dex';
import type { Variety } from '@/db/queries/pokemon-detail';
import { sprites } from '@/db/sprites';
import { useSignTheme } from '@/hooks/use-dex-theme';

type Props = {
  number: number;
  name?: string;
  genus?: string;
  types?: DexType[];
  pokemonId: number | null;
  varieties: Variety[];
  onSelectVariety: (pokemonId: number) => void;
  /** The caught toggle for the selected dex; null when the Pokémon isn't in that dex. */
  caught: { dexName: string; caught: boolean; onToggle: () => void } | null;
};

/** The yellow band at the top of a Pokémon's page: number, name, types, artwork and forms. */
export function IdentityBand({
  number,
  name,
  genus,
  types,
  pokemonId,
  varieties,
  onSelectVariety,
  caught,
}: Props) {
  const theme = useSignTheme();

  return (
    <SignBand colors={theme.gradient} style={styles.band}>
      <View style={styles.top}>
        <View style={styles.text}>
          <Text
            style={[styles.number, { color: theme.onSign }]}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel={`Number ${number}`}>
            {formatDexNumber(number)}
          </Text>
          {name ? (
            <Text style={[styles.name, { color: theme.onSign }]} accessibilityRole="header">
              {name}
            </Text>
          ) : null}
          {genus ? <Text style={[styles.genus, { color: theme.onSign }]}>{genus}</Text> : null}
          {types ? (
            <View style={styles.badges}>
              {types.map((t) => (
                <TypeBadge key={t.identifier} identifier={t.identifier} name={t.name} onBand />
              ))}
            </View>
          ) : null}
        </View>
        {pokemonId !== null ? (
          <Image
            source={sprites.artwork(pokemonId)}
            style={styles.artwork}
            contentFit="contain"
            transition={150}
            accessibilityLabel={name ? `${name} artwork` : undefined}
          />
        ) : (
          <View style={styles.artwork} />
        )}
      </View>

      {caught ? (
        <Pressable
          onPress={caught.onToggle}
          style={({ pressed }) => [
            styles.caught,
            { borderColor: theme.onSign },
            caught.caught && { backgroundColor: theme.field, borderColor: theme.field },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: caught.caught }}
          accessibilityLabel={`Caught in the ${caught.dexName} Dex`}>
          <SymbolView
            name={
              caught.caught
                ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
            }
            size={22}
            tintColor={caught.caught ? theme.onPanel : theme.onSign}
          />
          <Text
            style={[styles.caughtLabel, { color: caught.caught ? theme.onPanel : theme.onSign }]}
            numberOfLines={1}>
            {caught.caught ? `Caught · ${caught.dexName} Dex` : `Mark caught · ${caught.dexName} Dex`}
          </Text>
        </Pressable>
      ) : null}

      {varieties.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.forms}
          style={styles.formsScroller}>
          {varieties.map((v) => {
            const selected = v.pokemonId === pokemonId;
            return (
              <Pressable
                key={v.pokemonId}
                onPress={() => onSelectVariety(v.pokemonId)}
                style={[
                  styles.chip,
                  { borderColor: theme.onSign },
                  selected && { backgroundColor: theme.field },
                ]}
                hitSlop={{ top: 4, bottom: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${v.name} form`}>
                <Text
                  style={[styles.chipLabel, { color: selected ? theme.onPanel : theme.onSign }]}
                  numberOfLines={1}>
                  {v.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SignBand>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  number: {
    fontFamily: Font.extraBold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: Font.extraBold,
    fontSize: 28,
    lineHeight: 34,
  },
  genus: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  artwork: {
    width: 140,
    height: 140,
  },
  caught: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    minHeight: 44,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderRadius: 8,
    maxWidth: '100%',
  },
  caughtLabel: {
    flexShrink: 1,
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  formsScroller: {
    marginTop: Spacing.three,
    marginHorizontal: -Spacing.three,
  },
  forms: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderRadius: 8,
  },
  chipLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
  },
});
