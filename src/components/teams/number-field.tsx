import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A small number box. It can be emptied while typing; the value is clamped to `min`–`max` and
 * saved when editing ends.
 */
export function NumberField({
  value,
  min = 0,
  max,
  onCommit,
  accessibilityLabel,
  width = 64,
}: {
  value: number;
  min?: number;
  max: number;
  onCommit: (value: number) => void;
  accessibilityLabel: string;
  width?: number;
}) {
  const theme = useTheme();
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = Number(text);
    if (text.trim() !== '' && Number.isFinite(n)) onCommit(Math.max(min, Math.min(max, Math.round(n))));
    setText(null);
  };
  return (
    <TextInput
      value={text ?? String(value)}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
      onEndEditing={commit}
      onBlur={commit}
      keyboardType="number-pad"
      selectTextOnFocus
      maxLength={3}
      style={[
        styles.field,
        { width, color: theme.text, borderColor: theme.rowRule, backgroundColor: theme.backgroundElement },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`${min} to ${max}`}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    textAlign: 'center',
    fontFamily: Font.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
});
