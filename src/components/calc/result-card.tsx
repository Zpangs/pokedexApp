import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { koText } from '@/db/damage';
import type { CalcOutcome } from '@/hooks/use-calc-result';
import { useTheme } from '@/hooks/use-theme';

const pct = (n: number, hp: number) => Math.floor((n * 1000) / hp) / 10;

function effectivenessText(e: number) {
  if (e >= 4) return 'Super effective ×4';
  if (e >= 2) return 'Super effective ×2';
  if (e === 1) return null;
  if (e > 0.25) return 'Not very effective ×½';
  if (e > 0) return 'Not very effective ×¼';
  return null;
}

/** The answer: damage as a share of the target's HP, the KO chance, and each possible roll. */
export function ResultCard({
  outcome,
  attackerName,
  defenderName,
  prompt,
  conditions = [],
}: {
  outcome: CalcOutcome | null;
  /** The battle conditions in play ("Sun", "Critical hit"). */
  conditions?: string[];
  attackerName?: string;
  defenderName?: string;
  /** Shown while something's missing. */
  prompt: string;
}) {
  const theme = useTheme();
  const [showRolls, setShowRolls] = useState(false);

  if (!outcome) {
    return (
      <View style={[styles.card, { backgroundColor: theme.panel }]}>
        <Text style={[styles.prompt, { color: theme.onPanelSecondary }]}>{prompt}</Text>
      </View>
    );
  }

  const { result, min, max, maxHp, ko, move } = outcome;
  const heading = `${attackerName ?? ''}’s ${move.name} vs. ${defenderName ?? ''}`;
  if (result.none) {
    return (
      <View style={[styles.card, { backgroundColor: theme.panel }]} accessible accessibilityLabel={`${heading}. ${result.none}`}>
        <Text style={[styles.heading, { color: theme.onPanelSecondary }]}>{heading}</Text>
        <Text style={[styles.big, { color: theme.onPanel }]}>No damage</Text>
        <Text style={[styles.line, { color: theme.onPanel }]}>{result.none}</Text>
      </View>
    );
  }

  const hits = result.hitRolls.length;
  const facts = [
    effectivenessText(result.effectiveness),
    hits > 1 ? `${hits} hits` : null,
    ...conditions,
    ...result.notes,
  ].filter(Boolean);
  const range = min === max ? `${pct(min, maxHp)}%` : `${pct(min, maxHp)} – ${pct(max, maxHp)}%`;
  const hpText = min === max ? `${min} of ${maxHp} HP` : `${min} – ${max} of ${maxHp} HP`;
  const kText = koText(ko);
  const rolls = hits === 1 ? result.hitRolls[0] : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.panel }]}>
      <View accessible accessibilityLabel={`${heading}. ${range}, ${hpText}. ${kText}. ${facts.join('. ')}`}>
        <Text style={[styles.heading, { color: theme.onPanelSecondary }]} numberOfLines={2}>
          {heading}
        </Text>
        <Text style={[styles.big, { color: theme.onPanel }]}>{range}</Text>
        <Text style={[styles.line, { color: theme.onPanelSecondary }]}>{hpText}</Text>
        <Text style={[styles.ko, { color: theme.onPanelAccent }]}>{kText}</Text>
        {facts.length ? <Text style={[styles.line, { color: theme.onPanelSecondary }]}>{facts.join(' · ')}</Text> : null}
      </View>
      {rolls ? (
        <Pressable
          onPress={() => setShowRolls((v) => !v)}
          style={styles.rollsButton}
          accessibilityRole="button"
          accessibilityState={{ expanded: showRolls }}>
          <Text style={[styles.rollsLabel, { color: theme.onPanel }]}>
            {showRolls ? 'Hide each roll' : 'Show each roll'}
          </Text>
        </Pressable>
      ) : null}
      {rolls && showRolls ? (
        <Text style={[styles.rolls, { color: theme.onPanelSecondary }]}>{rolls.join(', ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  prompt: {
    fontFamily: Font.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  heading: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  big: {
    fontFamily: Font.extraBold,
    fontSize: 32,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  line: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  ko: {
    fontFamily: Font.extraBold,
    fontSize: 18,
    lineHeight: 24,
  },
  rollsButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  rollsLabel: {
    fontFamily: Font.bold,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  rolls: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
});
