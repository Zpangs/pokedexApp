import { StyleSheet, Text, View } from 'react-native';

import { Font, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A panel sign heading a section of the detail page. Sticks to the top while you scroll it. */
export function SectionSign({ title, detail }: { title: string; detail?: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.sign, { backgroundColor: theme.panel }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}>
      <Text style={[styles.title, { color: theme.onPanelAccent }]} numberOfLines={1}>
        {title}
      </Text>
      {/* At large text sizes the detail wraps onto its own line instead of being cut off */}
      {detail ? (
        <Text style={[styles.detail, { color: theme.onPanelSecondary }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    columnGap: Spacing.three,
  },
  title: {
    fontFamily: Font.extraBold,
    fontSize: 17,
    lineHeight: 22,
  },
  detail: {
    flexGrow: 1,
    flexShrink: 0,
    textAlign: 'right',
    fontFamily: Font.medium,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
