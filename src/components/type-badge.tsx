import { StyleSheet, Text, View } from 'react-native';

import { Colors, Font } from '@/constants/theme';
import { typeColors } from '@/constants/types';

type Props = {
  identifier: string;
  name: string;
  /** Shown after the name, e.g. a damage multiplier ("×2"). */
  suffix?: string;
  /** On the yellow sign band: outline the badge so yellow types (Electric) keep their edge. */
  onBand?: boolean;
};

/** A type's name on its color. Always shows the name, so it works without color vision. */
export function TypeBadge({ identifier, name, suffix, onBand }: Props) {
  const colors = typeColors(identifier);
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.background },
        onBand && { borderWidth: 1, borderColor: Colors.light.onSign },
      ]}>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {name}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 1,
  },
  label: {
    fontFamily: Font.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
});
