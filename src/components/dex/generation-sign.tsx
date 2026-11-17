import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { type DexGeneration, formatDexNumber } from '@/db/queries/national-dex';
import { useSignTheme } from '@/hooks/use-dex-theme';

type Props = { generation: DexGeneration; height: number; matches?: number };

/**
 * The panel "gate" sign heading each generation. It sticks to the top of the list,
 * so you always know which generation you're scrolling through.
 */
export const GenerationSign = memo(function GenerationSign({ generation, height, matches }: Props) {
  const theme = useSignTheme();
  const range = `${formatDexNumber(generation.first)}–${formatDexNumber(generation.last)}`;
  const detail = matches === undefined ? range : `${matches} found`;
  const spokenDetail =
    matches === undefined ? `numbers ${generation.first} to ${generation.last}` : `${matches} found`;

  return (
    <View
      style={[styles.sign, { height, backgroundColor: theme.panel }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Generation ${generation.numeral}, ${generation.region}, ${spokenDetail}`}>
      <Text style={[styles.gen, { color: theme.onPanelAccent }]} numberOfLines={1}>
        Gen {generation.numeral}
      </Text>
      <Text style={[styles.region, { color: theme.onPanel }]} numberOfLines={1}>
        {generation.region}
      </Text>
      <Text style={[styles.detail, { color: theme.onPanelSecondary }]} numberOfLines={1}>
        {detail}
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
  },
  region: {
    flexShrink: 0,
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  // The range gives way first when large text runs out of room
  detail: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
