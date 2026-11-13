import { StyleSheet, Text, View } from 'react-native';

import { Font } from '@/constants/theme';
import { typeColors } from '@/constants/types';

/** A type's name on its color. Always shows the name, so it works without color vision. */
export function TypeBadge({ identifier, name }: { identifier: string; name: string }) {
  const colors = typeColors(identifier);
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontFamily: Font.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
});
