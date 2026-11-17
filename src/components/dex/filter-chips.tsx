import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { typeColors } from '@/constants/types';
import type { DexGeneration, DexType } from '@/db/queries/national-dex';
import { useSignTheme } from '@/hooks/use-dex-theme';

/** Up to two types: a Pokémon must have both, so Water + Flying finds Gyarados. */
export const MAX_TYPES = 2;

type Props = {
  types: DexType[];
  selectedTypes: string[];
  onToggleType: (identifier: string) => void;
  /** Only on the National Dex; a regional dex is one game's run. */
  generations: DexGeneration[] | null;
  selectedGeneration: number | null;
  onSelectGeneration: (id: number | null) => void;
  /** Show only the Pokémon not caught yet. */
  missingOnly: boolean;
  onToggleMissing: () => void;
  onClear: () => void;
};

/** Rows of filter chips set into the search band, under the search field. */
export function FilterChips({
  types,
  selectedTypes,
  onToggleType,
  generations,
  selectedGeneration,
  onSelectGeneration,
  missingOnly,
  onToggleMissing,
  onClear,
}: Props) {
  const theme = useSignTheme();
  const active = selectedTypes.length > 0 || selectedGeneration !== null || missingOnly;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
        contentContainerStyle={styles.row}
        accessibilityLabel="Filter by type">
        {/* Always there, so the chips don't shift under your thumb when a filter turns on */}
        <Pressable
          onPress={onClear}
          disabled={!active}
          style={({ pressed }) => [
            styles.chip,
            styles.clear,
            { backgroundColor: theme.field, borderColor: theme.field },
            !active && styles.inactive,
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !active }}
          accessibilityLabel="Clear filters">
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={16}
            tintColor={theme.onPanel}
          />
          <Text style={[styles.label, { color: theme.onPanel }]}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={onToggleMissing}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: theme.onSign },
            missingOnly && { backgroundColor: theme.field, borderColor: theme.field },
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          accessibilityState={{ selected: missingOnly }}
          accessibilityLabel="Not caught yet">
          <Text style={[styles.label, { color: missingOnly ? theme.onPanel : theme.onSign }]}>
            Not caught
          </Text>
        </Pressable>
        {types.map((t) => {
          const on = selectedTypes.includes(t.identifier);
          const colors = typeColors(t.identifier);
          return (
            <Pressable
              key={t.identifier}
              onPress={() => onToggleType(t.identifier)}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: theme.onSign },
                on && { backgroundColor: colors.background, borderWidth: 2 },
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.name} type`}>
              <Text style={[styles.label, { color: on ? colors.text : theme.onSign }]}>{t.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {generations ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.scroller}
          contentContainerStyle={styles.row}
          accessibilityLabel="Filter by generation">
          {generations.map((g) => {
            const on = g.id === selectedGeneration;
            return (
              <Pressable
                key={g.id}
                onPress={() => onSelectGeneration(on ? null : g.id)}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.onSign },
                  on && { backgroundColor: theme.field, borderColor: theme.field },
                  pressed && styles.pressed,
                ]}
                hitSlop={{ top: 4, bottom: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Generation ${g.numeral}, ${g.region}`}>
                <Text style={[styles.label, { color: on ? theme.onPanel : theme.onSign }]}>
                  Gen {g.numeral}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the band's edges so chips scroll off-screen instead of being clipped by padding
  scroller: {
    marginHorizontal: -Spacing.three,
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three - 2,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  label: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  inactive: {
    opacity: 0.4,
  },
});
