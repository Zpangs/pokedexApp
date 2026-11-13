import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TypeBadge } from '@/components/type-badge';
import { Font, Spacing } from '@/constants/theme';
import type { DexType } from '@/db/queries/national-dex';
import { useTheme } from '@/hooks/use-theme';

export type MoveRowData = {
  id: number;
  name: string;
  type: DexType;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
};

type Props = {
  move: MoveRowData;
  /** Shown in a narrow column before the name: a level ("36", "Evo"), or nothing. */
  lead?: string;
  /** Spoken before the name, e.g. "Level 36". */
  leadLabel?: string;
  /** Fixed height, for lists that use getItemLayout. */
  height?: number;
};

export function moveFacts(move: MoveRowData) {
  return [
    move.category,
    move.power ? `${move.power} power` : null,
    move.accuracy ? `${move.accuracy}% accuracy` : null,
    move.pp ? `${move.pp} PP` : null,
  ].filter((f): f is string => f !== null);
}

/** One move: name over its category, power, accuracy and PP, with its type. Opens its page. */
export const MoveRow = memo(function MoveRow({ move, lead, leadLabel, height }: Props) {
  const theme = useTheme();
  const facts = moveFacts(move);
  const fixed = height !== undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/move/[id]', params: { id: move.id } })}
      style={({ pressed }) => [
        styles.move,
        { borderBottomColor: theme.rule },
        height !== undefined && { height, minHeight: undefined },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
      android_ripple={{ color: theme.backgroundSelected }}
      accessibilityRole="button"
      accessibilityLabel={`${leadLabel ? `${leadLabel}, ` : ''}${move.name}, ${move.type.name} type, ${facts.join(', ')}`}>
      {lead !== undefined && (
        <Text style={[styles.lead, { color: theme.text }]} numberOfLines={1}>
          {lead}
        </Text>
      )}
      <View style={styles.text}>
        {/* Fixed-height rows keep to one line each; others wrap */}
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={fixed ? 1 : undefined}>
          {move.name}
        </Text>
        <Text
          style={[styles.facts, { color: theme.textSecondary }]}
          numberOfLines={fixed ? 1 : undefined}>
          {facts.join(' · ')}
        </Text>
      </View>
      <TypeBadge identifier={move.type.identifier} name={move.type.name} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lead: {
    width: 32,
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
  },
  name: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 24,
  },
  facts: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
