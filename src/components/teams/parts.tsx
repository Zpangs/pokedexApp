import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { sprites } from '@/db/sprites';
import { TEAM_SIZE } from '@/db/teams';
import { useTheme } from '@/hooks/use-theme';

/** A full-width button: solid sign red for the main action, outlined for the rest. */
export function ActionButton({
  label,
  icon,
  onPress,
  primary,
  destructive,
  accessibilityHint,
  style,
}: {
  label: string;
  icon?: SymbolViewProps['name'];
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const color = primary ? theme.onSign : destructive ? theme.sign : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary
          ? { backgroundColor: theme.sign, borderColor: theme.sign }
          : { borderColor: destructive ? theme.sign : theme.text },
        pressed && { opacity: 0.7 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}>
      {icon ? <SymbolView name={icon} size={22} tintColor={color} /> : null}
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** A setting on a team member: what it is, its value, and a chevron to change it. */
export function ChoiceRow({
  label,
  value,
  detail,
  onPress,
  trailing,
  accessibilityHint,
}: {
  label: string;
  value: string;
  detail?: string | null;
  onPress: () => void;
  trailing?: ReactNode;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { borderBottomColor: theme.rule },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`}
      accessibilityHint={accessibilityHint}>
      <View style={styles.choiceText}>
        <Text style={[styles.choiceLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.choiceValue, { color: theme.text }]}>{value}</Text>
        {detail ? <Text style={[styles.choiceDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
      </View>
      {trailing}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={22}
        tintColor={theme.textSecondary}
      />
    </Pressable>
  );
}

/** The team's six slots as small sprites, empty slots as outlined circles. */
export function TeamSprites({ pokemonIds, size = 44 }: { pokemonIds: number[]; size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.sprites} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: TEAM_SIZE }, (_, i) =>
        pokemonIds[i] ? (
          <Image
            key={i}
            source={sprites.sprite(pokemonIds[i])}
            style={{ width: size, height: size }}
            contentFit="contain"
            transition={0}
          />
        ) : (
          <View
            key={i}
            style={[
              styles.emptySlot,
              { width: size * 0.6, height: size * 0.6, margin: size * 0.2, borderColor: theme.rowRule },
            ]}
          />
        )
      )}
    </View>
  );
}

/** A small heading inside a section. */
export function GroupLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 26,
    borderWidth: 2,
  },
  actionLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  choiceText: {
    flex: 1,
  },
  choiceLabel: {
    fontFamily: Font.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  choiceValue: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  choiceDetail: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sprites: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptySlot: {
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  groupLabel: {
    fontFamily: Font.bold,
    fontSize: 14,
    lineHeight: 20,
    paddingTop: Spacing.two,
  },
});
