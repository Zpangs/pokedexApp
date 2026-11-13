import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { type DexGeneration, formatDexNumber } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

type Props = { generation: DexGeneration; height: number; matches?: number };

/**
 * The black "gate" sign heading each generation. It sticks to the top of the list,
 * so you always know which generation you're scrolling through.
 */
export const GenerationSign = memo(function GenerationSign({ generation, height, matches }: Props) {
  const theme = useTheme();
  const range = `${formatDexNumber(generation.first)}–${formatDexNumber(generation.last)}`;

  return (
    <View
      style={[styles.sign, { height, backgroundColor: theme.panel }]}
      accessibilityRole="header"
      accessibilityLabel={`Generation ${generation.numeral}, ${generation.region}`}>
      <Text style={[styles.gen, { color: theme.onPanelAccent }]} numberOfLines={1}>
        Gen {generation.numeral}
      </Text>
      <Text style={[styles.region, { color: theme.onPanel }]} numberOfLines={1}>
        {generation.region}
      </Text>
      <Text style={[styles.range, { color: theme.onPanelSecondary }]} numberOfLines={1}>
        {matches === undefined ? range : `${matches} found`}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  sign: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  gen: {
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
    minWidth: 72,
  },
  region: {
    flex: 1,
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  range: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
