import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A labelled set of pills; exactly one is chosen. */
export function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.block, { borderBottomColor: theme.rule }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: theme.text, borderColor: theme.text }
                  : { borderColor: theme.rowRule },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}>
              <Text style={[styles.chipLabel, { color: selected ? theme.background : theme.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** − value + buttons for a number in a small range, like a stat stage. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  format = (n) => String(n),
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  format?: (n: number) => string;
}) {
  const theme = useTheme();
  const button = (delta: number, icon: 'remove' | 'add') => {
    const disabled = value + delta < min || value + delta > max;
    return (
      <Pressable
        onPress={() => !disabled && onChange(value + delta)}
        style={({ pressed }) => [
          styles.stepButton,
          { borderColor: theme.rowRule, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${icon === 'add' ? 'Raise' : 'Lower'} ${label}`}
        accessibilityState={{ disabled }}>
        <SymbolView
          name={icon === 'add' ? { ios: 'plus', android: 'add', web: 'add' } : { ios: 'minus', android: 'remove', web: 'remove' }}
          size={20}
          tintColor={theme.text}
        />
      </Pressable>
    );
  };
  return (
    <View style={styles.stepper}>
      {button(-1, 'remove')}
      <Text
        style={[styles.stepValue, { color: theme.text }]}
        accessibilityLabel={`${label}: ${format(value)}`}
        accessibilityLiveRegion="polite">
        {format(value)}
      </Text>
      {button(1, 'add')}
    </View>
  );
}

export function SwitchRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.row, { borderBottomColor: theme.rule }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={detail}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} importantForAccessibility="no" />
    </Pressable>
  );
}

/** A row with a label on the left and a control (a number field…) on the right. */
export function InlineRow({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.rule }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontFamily: Font.bold,
    fontSize: 15,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  stepValue: {
    minWidth: 32,
    textAlign: 'center',
    fontFamily: Font.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: Font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  rowDetail: {
    fontFamily: Font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
