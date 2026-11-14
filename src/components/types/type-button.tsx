import { SymbolView } from 'expo-symbols';
import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { typeColors } from '@/constants/types';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  identifier: string;
  name: string;
  /** Shown after the name, e.g. a damage multiplier ("×2"). */
  suffix?: string;
  onPress: () => void;
  /** For pickers: a check and an outline mark it, so it doesn't rely on color. */
  selected?: boolean;
  /** Spoken instead of the name and suffix. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** A type's name on its color, big enough to tap. */
export function TypeButton({
  identifier,
  name,
  suffix,
  onPress,
  selected,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const theme = useTheme();
  const colors = typeColors(identifier);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.background },
        selected && { borderColor: theme.text, borderWidth: 3 },
        pressed && { opacity: 0.7 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel ?? `${name}${suffix ? ` ${suffix}` : ''}`}
      accessibilityHint={accessibilityHint}>
      {selected ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={18}
          tintColor={colors.text}
        />
      ) : null}
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {name}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.three,
  },
  label: {
    fontFamily: Font.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
});
