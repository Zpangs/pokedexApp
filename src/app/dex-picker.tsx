import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/pokemon/app-bar';
import { dexPalette } from '@/constants/dex-palettes';
import { Font, Spacing } from '@/constants/theme';
import { loadPokedexes, NATIONAL_DEX_ID, type PokedexOption } from '@/db/queries/pokedexes';
import { selectDex, useSelectedDex } from '@/hooks/use-selected-dex';
import { DexThemeScope } from '@/hooks/use-dex-theme';
import { useTheme } from '@/hooks/use-theme';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

type Item =
  | { kind: 'sign'; key: string; generationId: number }
  | { kind: 'dex'; key: string; dex: PokedexOption };

/** Every Pokédex the Dex tab can show, grouped by the generation of its first game. */
/** Signs on this screen take the selected Pokédex's colours. */
export default function DexPickerScreen() {
  return (
    <DexThemeScope>
      <DexPickerScreenContent />
    </DexThemeScope>
  );
}

function DexPickerScreenContent() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const selected = useSelectedDex();
  const [dexes, setDexes] = useState<PokedexOption[] | null>(null);

  useEffect(() => {
    loadPokedexes(db).then(setDexes);
  }, [db]);

  const { items, stickyIndices } = useMemo(() => {
    const items: Item[] = [];
    const stickyIndices: number[] = [];
    let generation = 0;
    for (const dex of dexes ?? []) {
      if (dex.id !== NATIONAL_DEX_ID && dex.generationId !== generation) {
        generation = dex.generationId;
        stickyIndices.push(items.length);
        items.push({ kind: 'sign', key: `gen-${generation}`, generationId: generation });
      }
      items.push({ kind: 'dex', key: `dex-${dex.id}`, dex });
    }
    return { items, stickyIndices };
  }, [dexes]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <AppBar title="Choose a Pokédex" showTitle />
      {dexes && (
        <FlatList
          // Sticky headers must not shift inside a mounted list on Android (see the Dex tab)
          key={stickyIndices.join(',')}
          removeClippedSubviews={false}
          data={items}
          keyExtractor={(item) => item.key}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
          renderItem={({ item }) =>
            item.kind === 'sign' ? (
              <View
                style={[styles.sign, { backgroundColor: theme.panel }]}
                accessible
                accessibilityRole="header">
                <Text style={[styles.signText, { color: theme.onPanelAccent }]}>
                  Gen {NUMERALS[item.generationId - 1] ?? item.generationId}
                </Text>
              </View>
            ) : (
              <DexOption
                dex={item.dex}
                selected={item.dex.id === selected}
                onPress={() => {
                  selectDex(item.dex.id);
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
              />
            )
          }
        />
      )}
    </View>
  );
}

type OptionProps = { dex: PokedexOption; selected: boolean; onPress: () => void };

function DexOption({ dex, selected, onPress }: OptionProps) {
  const theme = useTheme();
  const games = dex.id === NATIONAL_DEX_ID ? 'Every Pokémon, every game' : dex.games;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderBottomColor: theme.rowRule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${dex.name} Dex, ${games}, ${dex.size} Pokémon`}>
      {/* A preview of the colours the Dex takes on with this dex */}
      <LinearGradient colors={dexPalette(dex.id).gradient} style={styles.swatch} />
      <View style={styles.check}>
        {selected && (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={26}
            tintColor={theme.text}
          />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.text }]}>{dex.name}</Text>
        <Text style={[styles.games, { color: theme.textSecondary }]}>{games}</Text>
      </View>
      <Text style={[styles.size, { color: theme.textSecondary }]}>{dex.size.toLocaleString()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  sign: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  signText: {
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
    borderBottomWidth: 2,
  },
  swatch: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
  },
  check: {
    width: 56,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  games: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  size: {
    fontFamily: Font.medium,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    marginLeft: Spacing.two,
  },
});
